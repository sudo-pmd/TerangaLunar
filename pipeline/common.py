"""Chemins et utilitaires communs au pipeline CLPS Lunar Mission Browser."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipeline"
KERNELS = PIPE / "kernels"
LOLA = PIPE / "lola"
OUT = PIPE / "out"
WEB_PUBLIC = ROOT / "web" / "public"
SITES_JSON = WEB_PUBLIC / "config" / "sites.json"
DATA_DIR = WEB_PUBLIC / "data"

LDEM_IMG = LOLA / "LDEM_80S_80M.IMG"
LDEM_LBL = LOLA / "LDEM_80S_80M.LBL"

# Ordre de chargement SPICE : leapseconds, constantes, frames, orientation lunaire, éphémérides.
KERNEL_PATTERNS = [
    "naif0012.tls",
    "pck00011.tpc",
    "moon_de440_*.tf",
    "moon_pa_de440_*.bpc",
    "de440s.bsp",
]

SCRIPT_VERSION = "1.0.0"
MOON_RADIUS_KM = 1737.4


def find_kernel(pattern: str):
    """Retourne le fichier NAIF correspondant au motif, ou None."""
    found = sorted(KERNELS.glob(pattern))
    return found[-1] if found else None


def kernel_report():
    """{motif: chemin ou None}"""
    return {p: find_kernel(p) for p in KERNEL_PATTERNS}


def load_sites(only=None):
    sites = json.loads(SITES_JSON.read_text(encoding="utf-8"))
    if isinstance(sites, dict):
        sites = sites.get("sites", [])
    if only:
        wanted = set(only)
        sites = [s for s in sites if s["id"] in wanted]
    return sites
