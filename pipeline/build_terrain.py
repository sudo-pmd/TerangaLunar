#!/usr/bin/env python3
"""Turn the LOLA south-polar DEM into browser-ready horizon masks.

The site itself is static: what the map needs is a small table, one row of
720 elevations per site, which the browser can use in place of the analytic
envelope declared in ``data/sites.json``.

    python pipeline/build_terrain.py \
        --dem pipeline/lola/LDEM_80S_80M.IMG \
        --sites data/sites.json \
        --out data/terrain.json

The output is a single file so a page can load everything at boot:

    { "generated": "...", "dem": {...}, "step": 0.5, "scale": 100,
      "sites": { "malapert_a": { "elevation": -1234, "values": [...] } } }

``values`` are hundredths of a degree, 0 at the south pole's horizon, and are
the apparent elevation of the highest terrain in that direction, curvature
included. No SPICE kernel is needed: this step is pure geometry on the DEM.

Sites outside the DEM footprint (the 80S product stops at 80 deg south) are
skipped and reported, so the map keeps the analytic profile for them instead of
inventing relief.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from horizon_dem import HorizonModel  # noqa: E402

SCALE = 100.0  # hundredths of a degree


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Masques d'horizon depuis un LDEM LOLA.")
    parser.add_argument("--dem", default=str(Path(__file__).resolve().parent / "lola" / "LDEM_80S_80M.IMG"))
    parser.add_argument("--sites", default=str(here / "data" / "sites.json"))
    parser.add_argument("--out", default=str(here / "data" / "terrain.json"))
    parser.add_argument("--range-km", type=float, default=30.0)
    parser.add_argument("--step", type=float, default=0.5, help="pas d'azimut en degrés")
    parser.add_argument("--height-m", type=float, default=2.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    dem_path = Path(args.dem)
    if not dem_path.exists():
        raise SystemExit(f"DEM introuvable : {dem_path}")

    print(f"Lecture {dem_path.name} …", flush=True)
    model = HorizonModel(dem_path)
    for note in model.self_check():
        print(f"  · {note}")

    sites = json.loads(Path(args.sites).read_text(encoding="utf-8"))["sites"]
    payload_sites: dict[str, dict] = {}
    skipped: list[str] = []

    for site in sites:
        if not model.covers(site["lat"]):
            skipped.append(f"{site['id']} ({site['lat']:.2f}°)")
            continue
        print(f"  {site['id']:<16}", end=" ", flush=True)
        elevation = model.elevation_at(site["lat"], site["lon"])
        values = model.mask(
            site["lat"], site["lon"],
            max_range_km=args.range_km,
            step_deg=args.step,
            height_m=args.height_m,
        )
        payload_sites[site["id"]] = {
            "lat": site["lat"],
            "lon": site["lon"],
            "elevation": int(round(elevation)),
            "max": round(max(values), 2),
            "min": round(min(values), 2),
            "values": [int(round(v * SCALE)) for v in values],
        }
        print(f"→ {max(values):5.1f}° max · altitude {elevation:6.0f} m")

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "LOLA LDEM 80S 80M (LRO-L-LOLA-4-GDR-V1.0)",
        "dem": dem_path.name,
        "projection": "polar stereographic, true at the pole",
        "radiusM": round(model.reference_m),
        "pixelM": round(model.scale_m),
        "frame": model.label.get("COORDINATE_SYSTEM_NAME", "MEAN EARTH/POLAR AXIS"),
        "rangeKm": args.range_km,
        "heightM": args.height_m,
        "step": args.step,
        "scale": SCALE,
        "sites": payload_sites,
        "skipped": skipped,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"\n{len(payload_sites)} site(s) écrits dans {out} ({size_kb:.0f} kB)")
    if skipped:
        print("Hors empreinte du DEM, profil analytique conservé : " + ", ".join(skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
