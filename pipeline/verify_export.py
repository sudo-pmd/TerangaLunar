#!/usr/bin/env python3
"""Relit web/public/data et vérifie la cohérence (taille, plages, aller-retour)."""
import json
import sys

import numpy as np

from common import DATA_DIR
from export import LIMIT_BYTES, decode_site


def main():
    idx = json.loads((DATA_DIR / "index.json").read_text(encoding="utf-8"))
    bad = 0
    for e in idx["sites"]:
        head = json.loads((DATA_DIR / f"{e['id']}.json").read_text(encoding="utf-8"))
        blob = (DATA_DIR / e["file"]).read_bytes()
        d = decode_site(blob, head["n"], head["mask_n"])
        errs = []
        if len(blob) != head["bytes"] or len(blob) > LIMIT_BYTES:
            errs.append("taille")
        if not (-90 <= d["sun_el"].min() and d["sun_el"].max() <= 90):
            errs.append("élévation soleil hors plage")
        if d["sun_az"].max() >= 360 or d["earth_az"].max() >= 360:
            errs.append("azimut hors plage")
        if np.isnan(d["mask"]).any() or d["mask"].min() < 0:
            errs.append("masque invalide")
        print(f"  {'OK ' if not errs else 'ERR'} {e['id']:<24} {len(blob) / 1024:6.1f} Ko {', '.join(errs)}")
        bad += bool(errs)
    if idx.get("provisional"):
        print("\n!! Données PROVISOIRES (de440s.bsp absent au calcul).")
    if not any(e["relief"] for e in idx["sites"]):
        print("!! Aucun relief réel (LDEM_80S_80M.IMG absent) : horizons plats.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
