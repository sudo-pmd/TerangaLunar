#!/usr/bin/env python3
"""Offline SPICE precompute for the CLPS Lunar Mission Browser.

Reads data/sites.json, computes Sun and Earth alt/az at each site in the
MOON_ME body-fixed frame with the LT+S correction, and writes one compact JSON
file per site plus an index:

    data/precomputed/index.json
    data/precomputed/<site>.json

The browser loads these when present and silently falls back to its analytical
Meeus model otherwise (see assets/js/precomputed.js).

Kernels expected in --kernel-dir (default pipeline/kernels), loaded in this
order so later files can rely on earlier ones:

    naif0012.tls, pck00011.tpc, moon_de440_250416.tf,
    moon_pa_de440_250416.bpc, de440s.bsp

Example:

    python pipeline/precompute.py --start 2026-01-01 --days 366 --step 3600
    python pipeline/precompute.py --sites malapert_a,mons_mouton --check

Elevations are quantised to 1/100 degree, azimuths likewise (0-35999), which
keeps a full year of hourly samples near 250 kB per site.

The optional --dem argument points at a LOLA LDEM product (.IMG); its .LBL is
read for the projection and scaling. Without it the horizon mask is left out and
the browser keeps using the analytic profile declared in sites.json.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

try:
    import spiceypy as spice
except ImportError:  # pragma: no cover - dependency guard
    sys.exit("spiceypy manquant : python -m pip install -r pipeline/requirements.txt")

SCALE = 100.0
KERNEL_ORDER = ("*.tls", "*.tpc", "*.tf", "*.bpc", "*.bsp")
MOON_RADIUS_KM = 1737.4


def iso(text: str) -> datetime:
    """Parse AAAA-MM-JJ or a full ISO timestamp as UTC."""
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise SystemExit(f"date illisible : {text}")


def load_kernels(kernel_dir: Path) -> list[str]:
    """Load every matching kernel in dependency order and return their names."""
    loaded: list[str] = []
    for pattern in KERNEL_ORDER:
        for path in sorted(kernel_dir.glob(pattern)):
            spice.furnsh(str(path))
            loaded.append(path.name)
    if not any(name.endswith(".bsp") for name in loaded):
        raise SystemExit(
            f"aucun noyau SPK (.bsp) dans {kernel_dir} : placez de440s.bsp "
            "(et les noyaux .tls, .tpc, .tf, .bpc)"
        )
    if not any(name.endswith(".tf") for name in loaded):
        raise SystemExit(f"aucun noyau de repères (.tf) dans {kernel_dir} : MOON_ME restera inconnu")
    return loaded


def local_basis(lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """East / north / up unit vectors of the local horizon at a lunar site."""
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.array([-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)])
    return east, north, up


def site_vector(lat_deg: float, lon_deg: float, height_km: float,
                radius_km: float = MOON_RADIUS_KM) -> np.ndarray:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    return (radius_km + height_km) * np.array(
        [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)]
    )


def alt_az(vec: np.ndarray, east: np.ndarray, north: np.ndarray, up: np.ndarray) -> tuple[float, float]:
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        return 0.0, 0.0
    alt = math.degrees(math.asin(max(-1.0, min(1.0, float(np.dot(vec, up)) / norm))))
    az = math.degrees(math.atan2(float(np.dot(vec, east)), float(np.dot(vec, north)))) % 360.0
    return alt, az


def moon_radii() -> np.ndarray:
    try:
        _, radii = spice.bodvrd("MOON", "RADII", 3)
        return np.array(radii, dtype=float)
    except spice.stypes.SpiceyError:
        return np.array([MOON_RADIUS_KM, MOON_RADIUS_KM, MOON_RADIUS_KM])


def compute_site(site: dict, ets: np.ndarray, radii: np.ndarray) -> dict:
    """Sun and Earth alt/az for one site, in MOON_ME, with LT+S."""
    east, north, up = local_basis(site["lat"], site["lon"])
    observer = site_vector(site["lat"], site["lon"], 0.0, float(radii[0]))

    sun_alt = np.empty(ets.size)
    sun_az = np.empty(ets.size)
    earth_alt = np.empty(ets.size)
    earth_az = np.empty(ets.size)

    for i, et in enumerate(ets):
        sun_pos, _ = spice.spkpos("SUN", float(et), "MOON_ME", "LT+S", "MOON")
        earth_pos, _ = spice.spkpos("EARTH", float(et), "MOON_ME", "LT+S", "MOON")
        s_alt, s_az = alt_az(np.array(sun_pos) - observer, east, north, up)
        e_alt, e_az = alt_az(np.array(earth_pos) - observer, east, north, up)
        sun_alt[i] = s_alt
        sun_az[i] = s_az
        earth_alt[i] = e_alt
        earth_az[i] = e_az

    return {
        "sunAlt": np.rint(sun_alt * SCALE).astype(int).tolist(),
        "sunAz": np.rint(sun_az * SCALE).astype(int).tolist(),
        "earthAlt": np.rint(earth_alt * SCALE).astype(int).tolist(),
        "earthAz": np.rint(earth_az * SCALE).astype(int).tolist(),
    }


def build_horizon(args, site: dict) -> dict | None:
    if not args.dem:
        return None
    from horizon_dem import HorizonModel

    dem = HorizonModel(Path(args.dem))
    values = dem.mask(site["lat"], site["lon"], max_range_km=args.range_km,
                      step_deg=args.azimuth_step, height_m=args.height_m)
    return {
        "step": args.azimuth_step,
        "values": [int(round(v * SCALE)) for v in values],
    }


def write_site(out_dir: Path, site: dict, payload: dict) -> Path:
    target = out_dir / f"{site['id']}.json"
    with target.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    return target


def write_index(out_dir: Path, generated: str, step: int, kernels: list[str]) -> Path:
    entries = []
    for path in sorted(out_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        entries.append(
            {
                "id": data["site"],
                "start": data["start"],
                "count": data["count"],
                "stepSeconds": data["stepSeconds"],
                "ephemeris": data.get("ephemeris", "spice"),
                "bytes": path.stat().st_size,
            }
        )
    index = {
        "generated": generated,
        "frame": "MOON_ME",
        "ephemeris": "spice",
        "kernels": kernels,
        "sites": entries,
    }
    target = out_dir / "index.json"
    with target.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(index, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return target


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Précalcul SPICE des séries par site.")
    parser.add_argument("--sites", default=str(Path(__file__).resolve().parent.parent / "data" / "sites.json"))
    parser.add_argument("--kernel-dir", default=str(Path(__file__).resolve().parent / "kernels"))
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data" / "precomputed"))
    parser.add_argument("--start", default="2026-01-01", help="premier instant (UTC)")
    parser.add_argument("--days", type=int, default=366, help="durée totale en jours")
    parser.add_argument("--step", type=int, default=3600, help="pas en secondes")
    parser.add_argument("--only", default="", help="liste d'identifiants séparés par des virgules")
    parser.add_argument("--dem", default=None, help="produit LOLA LDEM (.IMG)")
    parser.add_argument("--range-km", type=float, default=30.0, help="rayon maximal du masque")
    parser.add_argument("--azimuth-step", type=float, default=0.5)
    parser.add_argument("--height-m", type=float, default=2.0, help="hauteur de l'observateur")
    parser.add_argument("--check", action="store_true", help="affiche des contrôles de sanité")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    kernel_dir = Path(args.kernel_dir)
    if not kernel_dir.is_dir():
        raise SystemExit(f"dossier de noyaux introuvable : {kernel_dir}")

    kernels = load_kernels(kernel_dir)
    radii = moon_radii()
    sites_file = Path(args.sites)
    sites = json.loads(sites_file.read_text(encoding="utf-8"))["sites"]
    wanted = {s.strip() for s in args.only.split(",") if s.strip()}
    if wanted:
        unknown = wanted - {site["id"] for site in sites}
        if unknown:
            raise SystemExit(f"identifiants inconnus : {', '.join(sorted(unknown))}")
        sites = [site for site in sites if site["id"] in wanted]

    start = iso(args.start)
    count = int(round(args.days * 86400 / args.step)) + 1
    et0 = spice.str2et(start.strftime("%Y-%m-%dT%H:%M:%S"))
    ets = et0 + np.arange(count, dtype=float) * args.step

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"{len(sites)} site(s) · {count} échantillons · pas {args.step} s")
    for site in sites:
        print(f"  {site['id']:<16}", end=" ", flush=True)
        payload = {
            "site": site["id"],
            "generated": generated,
            "frame": "MOON_ME",
            "ephemeris": "spice-de440s",
            "start": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "stepSeconds": args.step,
            "count": count,
            "scale": SCALE,
            "kernels": kernels,
        }
        payload.update(compute_site(site, ets, radii))
        horizon = build_horizon(args, site)
        payload["horizon"] = horizon
        path = write_site(out_dir, site, payload)
        size_kb = path.stat().st_size / 1024
        print(f"→ {path.name} ({size_kb:.0f} kB)" + ("" if horizon else " · horizon analytique"))

        if args.check:
            sun_alt = np.array(payload["sunAlt"]) / SCALE
            earth_alt = np.array(payload["earthAlt"]) / SCALE
            print(
                f"       contrôle · Soleil max {sun_alt.max():.2f}° min {sun_alt.min():.2f}°"
                f" · Terre {earth_alt.min():.1f}° … {earth_alt.max():.1f}°"
                f" · part ensoleillée {(sun_alt > 0).mean() * 100:.0f} %"
            )

    index = write_index(out_dir, generated, args.step, kernels)
    print(f"index → {index}")
    spice.kclear()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
