#!/usr/bin/env python3
"""Étape 3 : export compact pour le navigateur (web/public/data/).

Par site : <id>.bin (petit-boutiste) + <id>.json (en-tête). Disposition du .bin :
    int16  sun_el[n]    centièmes de degré
    uint16 sun_az[n]    centièmes de degré (0-35999)
    int16  earth_el[n]
    uint16 earth_az[n]
    int16  mask[m]      centièmes de degré, m = 360/pas azimut (720 par défaut)
"""
import json
import sys

import numpy as np

from common import DATA_DIR, OUT, load_sites

SCALE = 100
LIMIT_BYTES = 5 * 1024 * 1024  # NF-04


def encode_site(angles, mask_deg):
    parts = [
        np.round(angles["sun_el"] * SCALE).astype("<i2"),
        (np.round(angles["sun_az"] * SCALE).astype(np.int64) % (360 * SCALE)).astype("<u2"),
        np.round(angles["earth_el"] * SCALE).astype("<i2"),
        (np.round(angles["earth_az"] * SCALE).astype(np.int64) % (360 * SCALE)).astype("<u2"),
        np.round(np.asarray(mask_deg) * SCALE).astype("<i2"),
    ]
    return b"".join(p.tobytes() for p in parts)


def decode_site(blob, n, m):
    """Inverse de encode_site (sert aux tests et à verify_export.py)."""
    o = 0
    out = {}
    for name, dtype, count in [("sun_el", "<i2", n), ("sun_az", "<u2", n), ("earth_el", "<i2", n),
                               ("earth_az", "<u2", n), ("mask", "<i2", m)]:
        out[name] = np.frombuffer(blob, dtype=dtype, count=count, offset=o) / SCALE
        o += count * 2
    return out


def main():
    meta = json.loads((OUT / "meta_run.json").read_text(encoding="utf-8"))
    hz_path = OUT / "horizons.json"
    hz = json.loads(hz_path.read_text(encoding="utf-8")) if hz_path.exists() else {"meta": {}, "sites": {}}
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for old in DATA_DIR.glob("*"):
        old.unlink()

    entries = []
    for s in load_sites():
        f = OUT / f"angles_{s['id']}.npz"
        if not f.exists():
            print(f"  (ignoré, pas de calcul pour {s['id']})")
            continue
        angles = np.load(f)
        h = hz["sites"].get(s["id"], {"relief": False, "coverage": 0.0, "mask": [0.0] * 720})
        blob = encode_site(angles, h["mask"])
        if len(blob) > LIMIT_BYTES:
            raise SystemExit(f"{s['id']} dépasse 5 Mo ({len(blob)} octets) : réduisez la durée.")
        (DATA_DIR / f"{s['id']}.bin").write_bytes(blob)
        head = {"id": s["id"], "n": meta["n"], "mask_n": len(h["mask"]), "scale": SCALE,
                "start": meta["start"], "step_s": meta["step_s"], "relief": h["relief"],
                "relief_coverage": h["coverage"], "bytes": len(blob)}
        (DATA_DIR / f"{s['id']}.json").write_text(json.dumps(head), encoding="utf-8")
        entries.append({"id": s["id"], "file": f"{s['id']}.bin", "relief": h["relief"],
                        "bytes": len(blob)})
        print(f"  {s['id']:<24} {len(blob) / 1024:7.1f} Ko  relief={'oui' if h['relief'] else 'non'}")

    index = {**{k: meta[k] for k in ("generated", "start", "days", "step_s", "n", "backend",
                                      "provisional", "frame", "abcorr", "radius_km", "kernels",
                                      "script_version")},
             "horizon": hz["meta"], "sites": entries}
    (DATA_DIR / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    print(f"Exporté dans {DATA_DIR}")


if __name__ == "__main__":
    sys.exit(main())
