#!/usr/bin/env python3
"""Régénère toutes les données : calcul -> horizon -> export -> vérification.

    python pipeline/run_all.py [--start 2027-01-01 --days 731 --step 3600]
"""
import subprocess
import sys
from pathlib import Path

from common import LDEM_IMG, kernel_report

HERE = Path(__file__).resolve().parent


def run(script, *args):
    cmd = [sys.executable, str(HERE / script), *args]
    print("\n$", " ".join(cmd[1:]))
    subprocess.run(cmd, check=True, cwd=HERE)


if __name__ == "__main__":
    print("=== Fichiers présents ===")
    for pat, path in kernel_report().items():
        print(f"  {'OK ' if path else 'MANQUE'} pipeline/kernels/{pat}")
    print(f"  {'OK ' if LDEM_IMG.exists() else 'MANQUE'} pipeline/lola/{LDEM_IMG.name}")
    run("compute.py", *sys.argv[1:])
    run("horizon.py")
    run("export.py")
    run("verify_export.py")
