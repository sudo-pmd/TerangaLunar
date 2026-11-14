"""LOLA LDEM horizon masks.

Reads a PDS IMG/LBL pair (for example LDEM_80S.IMG), samples the elevation along
each azimuth from the site and keeps the maximum apparent elevation.

The apparent elevation applies the lunar curvature correction, so a flat plain
stays at 0 deg however far it is sampled:

    h_apparent = h - d^2 / (2 R)
    elevation  = atan((h_apparent - h_site) / d)

This module has not been executed against a real LDEM product in this
repository (the file is not shipped). `HorizonModel.self_check()` prints the two
checks that make the projection trustworthy: the pole must land on the image
centre and (lat -89, lon 0) about 30 km away.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

MOON_RADIUS_M = 1737400.0


def parse_label(lbl_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lbl_path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if stripped.startswith("END"):
            break
        if "=" not in stripped:
            continue
        key, raw = stripped.split("=", 1)
        value = raw.split(" / ")[0].strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        values[key.strip().upper()] = value
    return values


class HorizonModel:
    """Stereographic south-polar DEM with a bilinear sampler."""

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
        self.scale_m = abs(float(self.label["MAP_SCALE"].split()[0])) * 1000.0
        self.line_offset = float(self.label["LINE_PROJECTION_OFFSET"])
        self.sample_offset = float(self.label["SAMPLE_PROJECTION_OFFSET"])
        self.scaling_factor = float(self.label.get("SCALING_FACTOR", 1.0))
        self.offset = float(self.label.get("OFFSET", 0.0))

        radius_km = float(self.label.get("A_AXIS_RADIUS", "1737.4").split()[0])
        self.radius_m = radius_km * 1000.0 if radius_km < 10000 else radius_km

        self.data = self._read_image()
        self.lat_center = float(self.label.get("CENTER_LATITUDE", -90.0).split()[0])
        self.lon_center = float(self.label.get("CENTER_LONGITUDE", 0.0).split()[0])

    def _read_image(self) -> np.ndarray:
        bits = int(self.label.get("SAMPLE_BITS", "16"))
        record_bytes = int(self.label.get("RECORD_BYTES", str(self.samples * bits // 8)))
        image_pointer = self.label.get("^IMAGE", "").split("<")[0].strip()
        start_record = int(image_pointer) if image_pointer else 1
        header = (start_record - 1) * record_bytes
        dtype = np.dtype(">i2" if bits == 16 else ">f4")
        raw = np.fromfile(self.path, dtype=dtype, offset=header)
        expected = self.samples * self.lines
        if raw.size < expected:
            raise SystemExit(
                f"{self.path.name} : {raw.size} échantillons lus, {expected} attendus "
                "(vérifiez RECORD_BYTES et ^IMAGE dans le label)"
            )
        data = raw[:expected].astype(np.float64).reshape(self.lines, self.samples)
        return data * self.scaling_factor + self.offset

    # --- projection -------------------------------------------------------

    def latlon_to_pixel(self, lat_deg: float, lon_deg: float) -> tuple[float, float]:
        """Selenographic coordinates to (sample, line), 0-based floating point."""
        lat = math.radians(lat_deg)
        rho = 2.0 * self.radius_m * math.tan(math.radians(90.0 - abs(lat_deg)) / 2.0)
        angle = math.radians((lon_deg - self.lon_center) % 360.0)
        x = rho * math.sin(angle)
        y = rho * math.cos(angle) * (1.0 if lat_deg < 0 else -1.0)
        sample = self.sample_offset + x / self.scale_m
        line = self.line_offset - y / self.scale_m
        return sample - 0.5, line - 0.5

    def pixel_to_latlon(self, sample: float, line: float) -> tuple[float, float]:
        x = (sample + 0.5 - self.sample_offset) * self.scale_m
        y = (self.line_offset - (line + 0.5)) * self.scale_m
        rho = math.hypot(x, y)
        if rho == 0.0:
            return (self.lat_center, self.lon_center)
        lat = -math.degrees(90.0 - 2.0 * math.atan(rho / (2.0 * self.radius_m)))
        lon = math.degrees(math.atan2(x, y)) + self.lon_center
        return lat, lon % 360.0

    def elevation_at(self, lat_deg: float, lon_deg: float) -> float:
        sample, line = self.latlon_to_pixel(lat_deg, lon_deg)
        if sample < 0 or line < 0 or sample > self.samples - 2 or line > self.lines - 2:
            return float("nan")
        s0 = int(math.floor(sample))
        l0 = int(math.floor(line))
        fs = sample - s0
        fl = line - l0
        block = self.data[l0:l0 + 2, s0:s0 + 2]
        return float(
            block[0, 0] * (1 - fs) * (1 - fl)
            + block[0, 1] * fs * (1 - fl)
            + block[1, 0] * (1 - fs) * fl
            + block[1, 1] * fs * fl
        )

    def self_check(self) -> list[str]:
        notes = []
        lat, lon = self.pixel_to_latlon(self.sample_offset - 0.5, self.line_offset - 0.5)
        notes.append(f"pôle image → lat {lat:.2f}°, lon {lon:.2f}° (attendu ≈ −90°)")
        s, l = self.latlon_to_pixel(-89.0, self.lon_center)
        distance_km = math.hypot(s - self.sample_offset, l - self.line_offset) * self.scale_m / 1000.0
        notes.append(f"(lat −89, lon 0) → {distance_km:.1f} km du centre (attendu ≈ 21 km)")
        return notes

    # --- horizon ----------------------------------------------------------

    def mask(
        self,
        lat_deg: float,
        lon_deg: float,
        max_range_km: float = 30.0,
        step_deg: float = 0.5,
        height_m: float = 2.0,
    ) -> list[float]:
        """Maximum apparent elevation per azimuth, in degrees."""
        site_height = self.elevation_at(lat_deg, lon_deg)
        if not math.isfinite(site_height):
            raise SystemExit(f"site ({lat_deg}, {lon_deg}) hors de l'image LDEM")
        site_height += height_m

        earth_radius = self.radius_m
        count = int(round(360.0 / step_deg))
        result = [0.0] * count
        distances = np.arange(50.0, max_range_km * 1000.0, self.scale_m)

        lat1 = math.radians(lat_deg)
        lon1 = math.radians(lon_deg)
        sin_lat1 = math.sin(lat1)
        cos_lat1 = math.cos(lat1)

        for index in range(count):
            bearing = math.radians(index * step_deg)
            sin_bearing = math.sin(bearing)
            cos_bearing = math.cos(bearing)
            best = 0.0
            for distance in distances:
                # Great-circle step of `distance` metres along `bearing`.
                delta = distance / MOON_RADIUS_M
                sin_delta = math.sin(delta)
                cos_delta = math.cos(delta)
                lat2 = math.asin(
                    sin_lat1 * cos_delta + cos_lat1 * sin_delta * cos_bearing
                )
                lon2 = lon1 + math.atan2(
                    sin_bearing * sin_delta * cos_lat1,
                    cos_delta - sin_lat1 * math.sin(lat2),
                )
                lat2_deg = math.degrees(lat2)
                lon2_deg = math.degrees(lon2) % 360.0
                sample, line = self.latlon_to_pixel(lat2_deg, lon2_deg)
                if sample < 0 or line < 0 or sample > self.samples - 2 or line > self.lines - 2:
                    continue
                height = self.elevation_at(lat2_deg, lon2_deg)
                if not math.isfinite(height):
                    continue
                # Lunar curvature: the horizon drops by d^2 / 2R.
                apparent = height - distance ** 2 / (2.0 * earth_radius)
                elevation = math.degrees(math.atan2(apparent - site_height, distance))
                if elevation > best:
                    best = elevation
            result[index] = best

        return [round(value, 2) for value in result]
