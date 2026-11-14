"""Horizon masks from a LOLA south-polar DEM.

Reads a PDS3 IMG/LBL pair — in practice ``LDEM_80S_80M.IMG`` from the LOLA
Gridded Data Record — and computes, for each azimuth, the highest apparent
elevation of the terrain between a site and a maximum range.

Two details of the PDS label matter and are easy to get wrong:

* ``SAMPLE_TYPE = LSB_INTEGER`` means little-endian 16-bit samples. Reading them
  as big-endian produces a plausible-looking but wrong relief.
* ``SCALING_FACTOR`` converts the digital number to **height in metres**
  relative to the reference radius (``OFFSET``), not to a radius. The label's
  own comment block says ``HEIGHT = DN * SCALING_FACTOR``; adding OFFSET here
  would shift every value by 1737.4 km (differences cancel, but the reported
  elevations would be nonsense).

The apparent elevation applies the lunar curvature correction, so a flat plain
reads 0 deg however far it is sampled:

    h_apparent = h - d^2 / (2 R)
    elevation  = atan((h_apparent - h_site) / d)

Elevations are kept as float32 to stay near 230 MB for the 7600 x 7600 product
instead of 460 MB in float64.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

MOON_RADIUS_M = 1737400.0


def parse_label(lbl_path: Path) -> dict[str, str]:
    """Flatten a PDS3 label into KEY -> first value (comments stripped)."""
    values: dict[str, str] = {}
    for line in lbl_path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        # Only the bare END terminates the label; END_OBJECT / END_GROUP close a
        # block and must not stop the parse before IMAGE_MAP_PROJECTION.
        if stripped == "END":
            break
        if "=" not in stripped or stripped.startswith("/*"):
            continue
        key, raw = stripped.split("=", 1)
        value = raw.split(" / ")[0].strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        values[key.strip().upper()] = value
    return values


def _number(text: str, default: float) -> float:
    """First numeric token of a label value ('80 <m/pix>' -> 80)."""
    token = text.split()[0] if text else ""
    try:
        return float(token)
    except ValueError:
        return default


class HorizonModel:
    """Stereographic south-polar DEM with a vectorised bilinear sampler."""

    def __init__(self, img_path: Path) -> None:
        self.path = Path(img_path)
        lbl = self.path.with_suffix(".LBL")
        if not lbl.exists():
            lbl = self.path.with_suffix(".lbl")
        if not lbl.exists():
            raise SystemExit(f"label introuvable pour {self.path}")
        self.label = parse_label(lbl)

        projection = self.label.get("MAP_PROJECTION_TYPE", "").upper()
        if "STEREOGRAPHIC" not in projection:
            raise SystemExit(
                f"projection non prise en charge ({projection or 'inconnue'}) : "
                "ce module traite les produits stéréographiques polaires sud"
            )

        self.samples = int(self.label["LINE_SAMPLES"])
        self.lines = int(self.label["LINES"])
        self.scale_m = abs(_number(self.label.get("MAP_SCALE", "0"), 0.0))
        if self.scale_m <= 0:
            raise SystemExit("MAP_SCALE absent du label : impossible de projeter")
        self.line_offset = _number(self.label.get("LINE_PROJECTION_OFFSET", "0"), 0.0)
        self.sample_offset = _number(self.label.get("SAMPLE_PROJECTION_OFFSET", "0"), 0.0)
        self.scaling_factor = _number(self.label.get("SCALING_FACTOR", "1"), 1.0)
        # Reference sphere of the product; heights below are relative to it.
        self.reference_m = _number(self.label.get("OFFSET", "0"), MOON_RADIUS_M)
        radius_km = _number(self.label.get("A_AXIS_RADIUS", "1737.4"), 1737.4)
        self.radius_m = radius_km * 1000.0 if radius_km < 10000 else radius_km

        self.lat_center = _number(self.label.get("CENTER_LATITUDE", "-90"), -90.0)
        self.lon_center = _number(self.label.get("CENTER_LONGITUDE", "0"), 0.0)
        self.lat_min = _number(self.label.get("MINIMUM_LATITUDE", "-90"), -90.0)
        self.lat_max = _number(self.label.get("MAXIMUM_LATITUDE", "-80"), -80.0)

        # Digital numbers (int16, memory-mapped); scaling is applied on read.
        self.data = self._read_image()

    # --- I/O --------------------------------------------------------------

    def _read_image(self) -> np.ndarray:
        bits = int(_number(self.label.get("SAMPLE_BITS", "16"), 16))
        sample_type = self.label.get("SAMPLE_TYPE", "").upper()
        endian = "<" if "LSB" in sample_type else ">"
        dtype = np.dtype(f"{endian}i2") if bits == 16 else np.dtype(f"{endian}f4")

        record_bytes = int(_number(
            self.label.get("RECORD_BYTES", str(self.samples * bits // 8)),
            self.samples * bits // 8,
        ))
        pointer = self.label.get("^IMAGE", "").strip()
        # A bare file name means "data starts at byte 1"; "24" would mean the
        # image begins at record 24.
        start_record = int(pointer) if pointer.isdigit() else 1
        header = (start_record - 1) * record_bytes

        expected = self.samples * self.lines
        need = header + expected * dtype.itemsize
        if self.path.stat().st_size < need:
            raise SystemExit(
                f"{self.path.name} : {self.path.stat().st_size} octets, {need} attendus "
                "(vérifiez RECORD_BYTES, ^IMAGE et SAMPLE_TYPE dans le label)"
            )
        # Memory-mapped on purpose: the 7600 x 7600 product is 110 MB on disk
        # and would need 220 MB as float32, which a laptop already busy with a
        # browser may refuse. Reading pages on demand is enough for a horizon
        # sweep and keeps the process under 20 MB.
        return np.memmap(
            self.path, dtype=dtype, mode="r", offset=header,
            shape=(self.lines, self.samples),
        )

    # --- projection -------------------------------------------------------

    def covers(self, lat_deg: float) -> bool:
        return self.lat_min - 0.05 <= lat_deg <= self.lat_max + 0.05

    def latlon_to_pixel(self, lat_deg, lon_deg):
        """Selenographic coordinates -> (sample, line), 0-based, floats."""
        lat = np.radians(np.asarray(lat_deg, dtype=float))
        lon = np.radians(np.asarray(lon_deg, dtype=float))
        rho = 2.0 * self.radius_m * np.tan((np.pi / 2 - np.abs(lat)) / 2)
        angle = np.radians((np.degrees(lon) - self.lon_center) % 360.0)
        x = rho * np.sin(angle)
        y = rho * np.cos(angle) * np.where(lat < 0, 1.0, -1.0)
        return self.sample_offset + x / self.scale_m - 0.5, self.line_offset - y / self.scale_m - 0.5

    def pixel_to_latlon(self, sample: float, line: float) -> tuple[float, float]:
        x = (sample + 0.5 - self.sample_offset) * self.scale_m
        y = (self.line_offset - (line + 0.5)) * self.scale_m
        rho = math.hypot(x, y)
        if rho == 0.0:
            return (self.lat_center, self.lon_center)
        lat = -math.degrees(90.0 - 2.0 * math.atan(rho / (2.0 * self.radius_m)))
        lon = math.degrees(math.atan2(x, y)) + self.lon_center
        return lat, lon % 360.0

    def _sample(self, sample, line):
        """Bilinear elevation for float pixel coordinates (NaN outside)."""
        sample = np.asarray(sample, dtype=float)
        line = np.asarray(line, dtype=float)
        inside = (
            (sample >= 0) & (line >= 0)
            & (sample <= self.samples - 2) & (line <= self.lines - 2)
        )
        out = np.full(sample.shape, np.nan, dtype=np.float64)
        if not inside.any():
            return out

        s = sample[inside]
        l = line[inside]
        s0 = np.floor(s).astype(int)
        l0 = np.floor(l).astype(int)
        fs = s - s0
        fl = l - l0
        block = self.data
        out[inside] = (
            block[l0, s0].astype(np.float32) * (1 - fs) * (1 - fl)
            + block[l0, s0 + 1].astype(np.float32) * fs * (1 - fl)
            + block[l0 + 1, s0].astype(np.float32) * (1 - fs) * fl
            + block[l0 + 1, s0 + 1].astype(np.float32) * fs * fl
        ) * np.float32(self.scaling_factor)
        return out

    def elevation_at(self, lat_deg: float, lon_deg: float) -> float:
        sample, line = self.latlon_to_pixel(lat_deg, lon_deg)
        return float(self._sample(sample, line))

    # --- checks -----------------------------------------------------------

    def self_check(self) -> list[str]:
        """Two assertions that make the projection trustworthy."""
        lat, lon = self.pixel_to_latlon(self.sample_offset - 0.5, self.line_offset - 0.5)
        notes = [f"pôle image → lat {lat:.3f}°, lon {lon:.3f}° (attendu ≈ −90°) / 0°"]

        s, l = self.latlon_to_pixel(-89.0, self.lon_center)
        distance_km = math.hypot(s - self.sample_offset, l - self.line_offset) * self.scale_m / 1000.0
        notes.append(f"(lat −89, lon 0) → {distance_km:.1f} km du centre (attendu ≈ 30 km)")

        radius_km = self.radius_m / 1000.0
        notes.append(
            f"grille {self.lines}×{self.samples} · {self.scale_m:.0f} m/pixel · "
            f"rayon {radius_km:.1f} km · pas {self.scaling_factor} m/DN"
        )

        mid = self.elevation_at(-89.0, 0.0)
        notes.append(f"altitude au point (lat −89, lon 0) : {mid:.0f} m (réf. {self.reference_m / 1000:.0f} km)")
        return notes

    # --- horizon ----------------------------------------------------------

    def mask(
        self,
        lat_deg: float,
        lon_deg: float,
        max_range_km: float = 30.0,
        step_deg: float = 0.5,
        height_m: float = 2.0,
        stride_m: float | None = None,
    ) -> list[float]:
        """Maximum apparent elevation per azimuth, in degrees.

        The ray is walked along the great circle at the site's horizon, every
        ``stride_m`` metres (two DEM pixels by default), and curvature is
        subtracted before the elevation is taken.
        """
        if not self.covers(lat_deg):
            raise SystemExit(
                f"site ({lat_deg}, {lon_deg}) hors de l'image LDEM "
                f"(couvre lat {self.lat_min:.0f} … {self.lat_max:.0f})"
            )
        site_height = self.elevation_at(lat_deg, lon_deg)
        if not math.isfinite(site_height):
            raise SystemExit(f"site ({lat_deg}, {lon_deg}) hors de l'image LDEM")
        site_height += height_m

        stride = stride_m or max(self.scale_m * 2.0, 60.0)
        distances = np.arange(stride, max_range_km * 1000.0, stride)
        count = int(round(360.0 / step_deg))
        radius = self.radius_m

        lat1 = math.radians(lat_deg)
        lon1 = math.radians(lon_deg)
        sin_lat1 = math.sin(lat1)
        cos_lat1 = math.cos(lat1)

        result = []
        delta = distances / radius
        sin_delta = np.sin(delta)
        cos_delta = np.cos(delta)
        curvature = distances ** 2 / (2.0 * radius)

        for index in range(count):
            bearing = math.radians(index * step_deg)
            sin_b = math.sin(bearing)
            cos_b = math.cos(bearing)

            lat2 = np.arcsin(sin_lat1 * cos_delta + cos_lat1 * sin_delta * cos_b)
            lon2 = lon1 + np.arctan2(
                sin_b * sin_delta * cos_lat1,
                cos_delta - sin_lat1 * np.sin(lat2),
            )
            sample, line = self.latlon_to_pixel(np.degrees(lat2), np.degrees(lon2) % 360.0)
            heights = self._sample(sample, line)
            valid = np.isfinite(heights)
            if not valid.any():
                result.append(0.0)
                continue

            apparent = heights[valid] - curvature[valid]
            elevations = np.degrees(np.arctan2(apparent - site_height, distances[valid]))
            result.append(max(0.0, float(elevations.max())))

        return [round(value, 2) for value in result]
