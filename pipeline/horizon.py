#!/usr/bin/env python3
"""Étape 2 : masque d'horizon (élévation maximale du relief par azimut) depuis LOLA LDEM 80S.

Usage :
    python pipeline/horizon.py                  # détecte l'orientation puis calcule tous les sites
    python pipeline/horizon.py --check-orientation
    python pipeline/horizon.py --mast 2.0 --dmax 150 --az-step 0.5

Sans pipeline/lola/LDEM_80S_80M.IMG, ou pour un site au nord de 80°S, l'horizon est plat (0°).
Le masque ne descend jamais sous l'horizontale locale (choix conservateur).
"""
import argparse
import json
import re
import sys

import numpy as np

from common import LDEM_IMG, LDEM_LBL, OUT, load_sites

# Cratères polaires connus (latitude planétocentrique, longitude Est) : leur fond est bas.
CHECK_CRATERS = [("Cabeus", -84.9, -35.5), ("Haworth", -87.5, -5.0), ("Shoemaker", -88.1, 44.9),
                 ("Faustini", -87.3, 77.0), ("de Gerlache", -88.5, -87.1),
                 ("Sverdrup", -88.5, -152.0), ("Amundsen", -84.5, 82.8)]

# 8 variantes (échange x/y, signe x, signe y) : l'orientation réelle du fichier est auto-détectée.
ORIENTS = [(sw, sx, sy) for sw in (0, 1) for sx in (1, -1) for sy in (1, -1)]
DEFAULT_ORIENT = ORIENTS.index((0, 1, -1))  # lon 0° en haut, Est à droite


def parse_lbl(path):
    txt = open(path, encoding="latin-1").read()

    def num(key, default=None):
        m = re.search(rf"^\s*{key}\s*=\s*([-+0-9.eE]+)", txt, re.M)
        return float(m.group(1)) if m else default

    return {
        "lines": int(num("LINES")), "samples": int(num("LINE_SAMPLES")),
        "scale_dn": num("SCALING_FACTOR", 1.0), "offset_m": num("OFFSET", 0.0),
        "map_m": num("MAP_SCALE"), "line0": num("LINE_PROJECTION_OFFSET"),
        "sample0": num("SAMPLE_PROJECTION_OFFSET"),
        "radius_m": float(re.search(r"A_AXIS_RADIUS\s*=\s*([0-9.]+)", txt).group(1)) * 1000.0,
        "max_lat": num("MAXIMUM_LATITUDE", -80.0),
    }


class Dem:
    """Modèle d'altitude en projection stéréographique polaire sud (sphérique, vrai au pôle)."""

    def __init__(self, array, scale_m=80.0, radius_m=1737400.0, center=None, height_scale=0.5,
                 height_offset=0.0, orient=DEFAULT_ORIENT, max_lat=-80.0):
        self.a = array
        self.n_lines, self.n_samples = array.shape
        self.scale_m = scale_m
        self.R = radius_m
        self.r0, self.c0 = center if center else ((self.n_lines - 1) / 2, (self.n_samples - 1) / 2)
        self.hs, self.ho = height_scale, height_offset  # hauteur = DN*hs + ho (m, rel. sphère R)
        self.orient = orient
        self.max_lat = max_lat

    @classmethod
    def from_files(cls, img=LDEM_IMG, lbl=LDEM_LBL, orient=DEFAULT_ORIENT):
        p = parse_lbl(lbl)
        arr = np.memmap(img, dtype="<i2", mode="r", shape=(p["lines"], p["samples"]))
        return cls(arr, p["map_m"], p["radius_m"], (p["line0"], p["sample0"]), p["scale_dn"],
                   p["offset_m"] - p["radius_m"], orient, p["max_lat"])

    # --- projection -------------------------------------------------------------------
    def project(self, lat_deg, lon_deg):
        """(lat, lon) -> (col, row) fractionnaires, indices à partir de 0."""
        theta = np.radians(np.asarray(lat_deg) + 90.0)
        rho = 2 * self.R * np.tan(theta / 2)
        lo = np.radians(lon_deg)
        a, b = rho * np.sin(lo), rho * np.cos(lo)
        sw, sx, sy = ORIENTS[self.orient]
        u, v = (b, a) if sw else (a, b)
        return self.c0 + sx * u / self.scale_m, self.r0 + sy * v / self.scale_m

    def unproject(self, col, row):
        sw, sx, sy = ORIENTS[self.orient]
        u, v = sx * (np.asarray(col) - self.c0) * self.scale_m, sy * (np.asarray(row) - self.r0) * self.scale_m
        a, b = (v, u) if sw else (u, v)
        rho = np.hypot(a, b)
        lat = np.degrees(2 * np.arctan(rho / (2 * self.R))) - 90.0
        return lat, np.degrees(np.arctan2(a, b))

    def height(self, lat_deg, lon_deg):
        """Altitude (m, relative à la sphère de référence), interpolation bilinéaire ; NaN hors zone."""
        lat = np.asarray(lat_deg, dtype=float)
        col, row = self.project(lat, lon_deg)
        c, r = np.floor(col).astype(np.int64), np.floor(row).astype(np.int64)
        ok = (lat <= self.max_lat) & (c >= 0) & (r >= 0) & (c < self.n_samples - 1) & (r < self.n_lines - 1)
        c, r = np.clip(c, 0, self.n_samples - 2), np.clip(r, 0, self.n_lines - 2)
        fc, fr = col - c, row - r
        g = lambda rr, cc: np.asarray(self.a[rr, cc], dtype=float)
        v = ((1 - fc) * (1 - fr) * g(r, c) + fc * (1 - fr) * g(r, c + 1)
             + (1 - fc) * fr * g(r + 1, c) + fc * fr * g(r + 1, c + 1))
        return np.where(ok, v * self.hs + self.ho, np.nan)


def detect_orientation(dem):
    """Score de chaque orientation : écart réduit moyen de l'altitude au centre des cratères
    connus par rapport à la région (plus c'est négatif, mieux c'est)."""
    sample = np.asarray(dem.a[::25, ::25], dtype=float) * dem.hs
    med, std = np.median(sample), sample.std() or 1.0
    scores = []
    for k in range(len(ORIENTS)):
        d = Dem(dem.a, dem.scale_m, dem.R, (dem.r0, dem.c0), dem.hs, dem.ho, k, dem.max_lat)
        h = np.array([d.height(la, lo) for _, la, lo in CHECK_CRATERS], dtype=float)
        scores.append(float(np.nanmean((h - med) / std)))
    best = int(np.argmin(scores))
    return best, scores


def horizon_mask(dem, lat, lon, mast_m=2.0, az_step=0.5, dmax_m=150000.0, step_m=160.0):
    """Élévation maximale du relief (degrés) pour chaque azimut. Retourne (masque, couverture 0-1)."""
    R = dem.R
    az = np.radians(np.arange(0, 360, az_step))[:, None]
    d = np.arange(step_m, dmax_m, step_m)[None, :]
    delta = d / R
    la1, lo1 = np.radians(lat), np.radians(lon)
    la2 = np.arcsin(np.sin(la1) * np.cos(delta) + np.cos(la1) * np.sin(delta) * np.cos(az))
    if abs(np.cos(la1)) < 1e-9:  # pôle exact : azimut compté depuis le méridien 0
        lo2 = lo1 + az + 0 * delta
    else:
        lo2 = lo1 + np.arctan2(np.sin(az) * np.sin(delta) * np.cos(la1),
                               np.cos(delta) - np.sin(la1) * np.sin(la2))
    h = dem.height(np.degrees(la2), np.degrees(lo2))
    h0 = dem.height(np.array([lat]), np.array([lon]))[0]
    if np.isnan(h0):
        return np.zeros(az.shape[0]), 0.0
    h0 += mast_m
    elev = np.arctan2((R + h) * np.cos(delta) - (R + h0), (R + h) * np.sin(delta))
    with np.errstate(all="ignore"):
        mask = np.nanmax(np.where(np.isnan(elev), -np.inf, elev), axis=1)
    mask = np.where(np.isfinite(mask), np.degrees(mask), 0.0)
    return np.maximum(mask, 0.0), float(np.mean(~np.isnan(h)))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--check-orientation", action="store_true")
    ap.add_argument("--orient", type=int, default=-1, help="force l'orientation (0-7)")
    ap.add_argument("--mast", type=float, default=2.0, help="hauteur de l'atterrisseur (m)")
    ap.add_argument("--dmax", type=float, default=150.0, help="rayon de recherche (km)")
    ap.add_argument("--az-step", type=float, default=0.5)
    ap.add_argument("--sites", default="")
    args = ap.parse_args(argv)

    OUT.mkdir(parents=True, exist_ok=True)
    sites = load_sites([s for s in args.sites.split(",") if s])
    result = {"meta": {"mast_m": args.mast, "dmax_km": args.dmax, "az_step_deg": args.az_step,
                       "source": None, "resolution_m": None, "orient": None}, "sites": {}}
    n_az = int(round(360 / args.az_step))

    if not LDEM_IMG.exists():
        print(f"!! {LDEM_IMG} absent : horizon plat pour tous les sites.\n"
              "   Copiez LDEM_80S_80M.IMG dans pipeline/lola/ (voir A_COPIER_ICI.txt).")
        for s in sites:
            result["sites"][s["id"]] = {"relief": False, "coverage": 0.0, "mask": [0.0] * n_az}
    else:
        dem = Dem.from_files()
        best, scores = detect_orientation(dem)
        if args.check_orientation:
            for k, sc in enumerate(scores):
                print(f"orientation {k} {ORIENTS[k]} : score {sc:+.2f}{'  <== meilleure' if k == best else ''}")
            return 0
        k = args.orient if args.orient >= 0 else best
        srt = sorted(scores)
        if args.orient < 0 and (srt[0] > -0.8 or srt[1] - srt[0] < 0.4):
            print("!! Orientation incertaine, vérifiez avec --check-orientation")
        print(f"orientation retenue : {k} {ORIENTS[k]}")
        dem.orient = k
        result["meta"].update(source="LRO LOLA LDEM_80S_80M", resolution_m=dem.scale_m, orient=k)
        for s in sites:
            if s["lat"] > dem.max_lat:
                print(f"  {s['id']:<24} hors LDEM 80S (lat {s['lat']}) : horizon plat")
                result["sites"][s["id"]] = {"relief": False, "coverage": 0.0, "mask": [0.0] * n_az}
                continue
            mask, cov = horizon_mask(dem, s["lat"], s["lon"], args.mast, args.az_step, args.dmax * 1000)
            print(f"  {s['id']:<24} horizon max {mask.max():5.2f}°  moyen {mask.mean():5.2f}°  couverture {cov:.0%}")
            result["sites"][s["id"]] = {"relief": cov > 0.5, "coverage": round(cov, 3),
                                        "mask": [round(float(x), 3) for x in mask]}
    (OUT / "horizons.json").write_text(json.dumps(result), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
