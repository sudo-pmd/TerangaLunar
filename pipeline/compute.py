#!/usr/bin/env python3
"""Étape 1 : azimut / élévation du Soleil et de la Terre vus de chaque site.

Repère MOON_ME, correction de lumière LT+S (section 7 du cahier des charges).

Usage (depuis le dossier racine du projet) :
    python pipeline/compute.py                       # 2027-01-01, 731 jours, pas de 1 h
    python pipeline/compute.py --start 2027-06-01 --days 365
    python pipeline/compute.py --step 1800           # option 30 minutes
    python pipeline/compute.py --sites ref_pole,im2_mons_mouton
    python pipeline/compute.py --backend astropy     # MODE PROVISOIRE (sans de440s.bsp)

Si de440s.bsp est absent, le mode « astropy » (éphémérides approchées) est utilisé
automatiquement et les données sont marquées PROVISOIRES. L'orientation de la Lune
reste calculée avec les vrais fichiers moon_pa_de440 / moon_de440.
"""
import argparse
import datetime as dt
import json
import sys
import time

import numpy as np
import spiceypy as spice

from common import (MOON_RADIUS_KM, OUT, SCRIPT_VERSION, find_kernel, kernel_report,
                    load_sites)


def load_kernels():
    """Charge les noyaux SPICE présents. Retourne True si de440s.bsp est chargé."""
    spice.kclear()
    has_bsp = False
    for pattern, path in kernel_report().items():
        if path is None:
            if pattern != "de440s.bsp":
                raise SystemExit(f"Noyau obligatoire absent : pipeline/kernels/{pattern}")
            continue
        spice.furnsh(str(path))
        has_bsp = has_bsp or pattern == "de440s.bsp"
    return has_bsp


def moon_radius_km():
    try:
        _, radii = spice.bodvrd("MOON", "RADII", 3)
        return float(radii[0])
    except Exception:  # pck00011 absent ou non chargé
        return MOON_RADIUS_KM


def time_grid(start_iso: str, days: float, step_s: int):
    """Grille régulière en temps éphéméride (TDB). start_iso = 'AAAA-MM-JJ' (UTC)."""
    et0 = spice.str2et(f"{start_iso} 00:00:00 UTC")
    n = int(round(days * 86400 / step_s))
    return et0 + np.arange(n) * float(step_s)


def vectors_spice(ets):
    """Soleil et Terre vus du centre de la Lune, dans MOON_ME, avec LT+S (km)."""
    sun, _ = spice.spkpos("SUN", ets, "MOON_ME", "LT+S", "MOON")
    earth, _ = spice.spkpos("EARTH", ets, "MOON_ME", "LT+S", "MOON")
    return np.asarray(sun), np.asarray(earth)


def vectors_provisional(ets):
    """MODE PROVISOIRE : éphémérides intégrées d'astropy (précision de l'ordre du km
    pour la Lune, sans correction LT+S) + rotation lunaire SPICE réelle."""
    from astropy.coordinates import get_body_barycentric, solar_system_ephemeris
    from astropy.time import Time
    import astropy.units as u

    t = Time(2451545.0 + np.asarray(ets) / 86400.0, format="jd", scale="tdb")
    with solar_system_ephemeris.set("builtin"):
        sun = get_body_barycentric("sun", t)
        earth = get_body_barycentric("earth", t)
        moon = get_body_barycentric("moon", t)
    v_sun = (sun - moon).xyz.to(u.km).value.T
    v_earth = (earth - moon).xyz.to(u.km).value.T
    rot = np.array([spice.pxform("J2000", "MOON_ME", float(e)) for e in ets])
    return (np.einsum("nij,nj->ni", rot, v_sun),
            np.einsum("nij,nj->ni", rot, v_earth))


def local_basis(lat_deg, lon_deg):
    """Base locale (est, nord, zénith) en coordonnées MOON_ME. Au pôle exact,
    le nord pointe vers la longitude 0 (azimut compté depuis ce méridien)."""
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    return east, north, up


def az_el(vec_center, lat_deg, lon_deg, radius_km):
    """Azimut (0=Nord, 90=Est, sens horaire) et élévation en degrés vus du site.
    vec_center : (n,3) positions depuis le centre de la Lune."""
    east, north, up = local_basis(lat_deg, lon_deg)
    site = up * radius_km
    rel = vec_center - site
    norm = np.linalg.norm(rel, axis=1)
    e, n, z = rel @ east, rel @ north, rel @ up
    el = np.degrees(np.arcsin(np.clip(z / norm, -1, 1)))
    az = np.degrees(np.arctan2(e, n)) % 360.0
    return az, el


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--start", default="2027-01-01", help="date de début UTC AAAA-MM-JJ")
    ap.add_argument("--days", type=float, default=731, help="durée en jours (2 ans = 731)")
    ap.add_argument("--step", type=int, default=3600, help="pas en secondes (3600 ou 1800)")
    ap.add_argument("--sites", default="", help="liste d'identifiants séparés par des virgules")
    ap.add_argument("--backend", choices=["auto", "spice", "astropy"], default="auto")
    args = ap.parse_args(argv)

    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    has_bsp = load_kernels()
    backend = args.backend
    if backend == "auto":
        backend = "spice" if has_bsp else "astropy"
    if backend == "spice" and not has_bsp:
        raise SystemExit("de440s.bsp introuvable : copiez-le dans pipeline/kernels/ "
                         "(voir pipeline/kernels/A_COPIER_ICI.txt) ou utilisez --backend astropy.")
    provisional = backend != "spice"
    if provisional:
        print("!! MODE PROVISOIRE : de440s.bsp absent, éphémérides approchées (astropy).")

    radius = moon_radius_km()
    ets = time_grid(args.start, args.days, args.step)
    print(f"{len(ets)} pas de {args.step}s, backend={backend}, rayon={radius} km")
    sun, earth = (vectors_spice if backend == "spice" else vectors_provisional)(ets)

    sites = load_sites([s for s in args.sites.split(",") if s])
    for s in sites:
        az_s, el_s = az_el(sun, s["lat"], s["lon"], radius)
        az_e, el_e = az_el(earth, s["lat"], s["lon"], radius)
        np.savez_compressed(OUT / f"angles_{s['id']}.npz", sun_az=az_s, sun_el=el_s,
                            earth_az=az_e, earth_el=el_e)
        print(f"  {s['id']:<24} soleil max {el_s.max():6.2f}°  terre [{el_e.min():6.1f}, {el_e.max():6.1f}]°")

    meta = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "start": f"{args.start}T00:00:00Z",
        "days": args.days,
        "step_s": args.step,
        "n": int(len(ets)),
        "backend": backend,
        "provisional": provisional,
        "frame": "MOON_ME",
        "abcorr": "LT+S" if backend == "spice" else "NONE (provisoire)",
        "radius_km": radius,
        "kernels": [p.name for p in kernel_report().values() if p],
        "script_version": SCRIPT_VERSION,
    }
    (OUT / "meta_run.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Terminé en {time.time() - t0:.1f} s")


if __name__ == "__main__":
    sys.exit(main())
