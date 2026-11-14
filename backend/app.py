"""
TerangaLunar — optional Python calculation service.

Serves the same quantities as the in-browser model, but from the official JPL
kernels through SpiceyPy:

    uvicorn backend.app:app --port 8000

It also serves the static site from the repository root, so opening
http://127.0.0.1:8000 gives a page whose /api calls hit this same process. Used
from a plain static host, the frontend simply falls back to its local model.

Kernels expected in pipeline/kernels/ (see pipeline/README.md):
    naif0012.tls, pck00011.tpc, moon_de440_250416.tf,
    moon_pa_de440_250416.bpc, de440s.bsp
"""

from __future__ import annotations

import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
KERNEL_DIR = ROOT / "pipeline" / "kernels"
KERNEL_ORDER = (".tls", ".tpc", ".tf", ".bpc", ".bsp")
FRAME = "MOON_ME"
ABERRATION = "LT+S"

app = FastAPI(
    title="TerangaLunar ephemeris",
    version="1.0.0",
    description=(
        "Sub-solar point and site illumination from DE440s + moon_pa, in the "
        "MOON_ME body-fixed frame. Optional: the static site computes the same "
        "quantities locally."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_lock = threading.Lock()
_state: dict[str, Any] = {"loaded": False, "error": None, "kernels": [], "radii": None}


def _kernels() -> list[Path]:
    if not KERNEL_DIR.is_dir():
        return []
    found = [p for p in KERNEL_DIR.iterdir() if p.is_file()]
    return sorted(found, key=lambda p: (KERNEL_ORDER.index(p.suffix.lower())
                                        if p.suffix.lower() in KERNEL_ORDER else 99,
                                        p.name))


def load_kernels() -> dict[str, Any]:
    """Furnsh the kernel set once; every later call reuses it."""
    with _lock:
        if _state["loaded"]:
            return _state
        if _state["error"]:
            return _state
        try:
            import spiceypy as spice
        except Exception as exc:  # pragma: no cover - optional dependency
            _state["error"] = f"spiceypy unavailable: {exc}"
            return _state

        files = _kernels()
        if not any(p.suffix.lower() == ".bsp" for p in files):
            _state["error"] = f"no .bsp ephemeris in {KERNEL_DIR}"
            return _state

        try:
            for path in files:
                spice.furnsh(str(path))
            _, radii = spice.bodvrd("MOON", "RADII", 3)
        except Exception as exc:  # pragma: no cover - depends on kernels
            _state["error"] = f"kernel load failed: {exc}"
            return _state

        _state.update({
            "loaded": True,
            "error": None,
            "kernels": [p.name for p in files],
            "radii": [float(r) for r in radii],
        })
        return _state


class Health(BaseModel):
    status: str
    ok: bool
    engine: str
    frame: str
    kernels: list[str]
    error: str | None = None


class Subsolar(BaseModel):
    t: str
    lat: float
    lon: float
    frame: str
    source: str
    sunDistanceKm: float


def _et(iso: str) -> float:
    import spiceypy as spice

    text = iso.strip().replace("Z", "")
    if "T" not in text:
        text = f"{text}T00:00:00"
    if len(text) == 16:
        text = f"{text}:00"
    try:
        return float(spice.str2et(text))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"unreadable time {iso!r}: {exc}") from exc


@app.get("/api/health", response_model=Health)
def health() -> Health:
    state = load_kernels()
    ok = bool(state["loaded"])
    return Health(
        status="ok" if ok else "degraded",
        ok=ok,
        engine="spiceypy/DE440s" if ok else "none",
        frame=FRAME,
        kernels=state["kernels"],
        error=state["error"],
    )


@app.get("/api/subsolar", response_model=Subsolar)
def subsolar(t: str = Query(..., description="ISO-8601 UTC instant")) -> Subsolar:
    import spiceypy as spice

    state = load_kernels()
    if not state["loaded"]:
        raise HTTPException(status_code=503, detail=state["error"] or "kernels not loaded")

    et = _et(t)
    try:
        point, _, _ = spice.subslr("Intercept", "MOON", et, FRAME, ABERRATION)
        radii = state["radii"]
        r = math.sqrt(sum((point[i] / radii[i]) ** 2 for i in range(3)))
        unit = [point[i] / radii[i] / r for i in range(3)]
        lat = math.degrees(math.asin(max(-1.0, min(1.0, unit[2]))))
        lon = math.degrees(math.atan2(unit[1], unit[0])) % 360.0
        sun_pos, _ = spice.spkpos("SUN", et, FRAME, ABERRATION, "MOON")
        distance = math.sqrt(sum(v * v for v in sun_pos))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SPICE: {exc}") from exc

    return Subsolar(
        t=t,
        lat=round(lat, 6),
        lon=round(lon, 6),
        frame=FRAME,
        source="spice-subslr",
        sunDistanceKm=round(distance, 3),
    )


@app.get("/api/site")
def site_illumination(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-360, le=360),
    t: str = Query(..., description="ISO-8601 UTC instant"),
) -> dict[str, Any]:
    """Solar incidence and visibility at a point, without terrain."""
    import spiceypy as spice

    state = load_kernels()
    if not state["loaded"]:
        raise HTTPException(status_code=503, detail=state["error"] or "kernels not loaded")

    et = _et(t)
    radii = state["radii"]
    la = math.radians(lat)
    lo = math.radians(lon % 360.0)
    point = [
        radii[0] * math.cos(la) * math.cos(lo),
        radii[0] * math.cos(la) * math.sin(lo),
        radii[2] * math.sin(la),
    ]
    try:
        _, _, _, incidence, _, _ = spice.ilumin(
            "Ellipsoid", "MOON", point, et, FRAME, ABERRATION, "SUN"
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SPICE: {exc}") from exc

    elevation = 90.0 - math.degrees(incidence)
    return {
        "t": t,
        "lat": lat,
        "lon": lon,
        "sunElevationDeg": round(elevation, 6),
        "sunlit": elevation > 0,
        "frame": FRAME,
        "source": "spice-ilumin",
        "note": "local horizon is a sphere: apply the terrain profile separately",
        "generated": datetime.now(timezone.utc).isoformat(),
    }


# Static site last, so /api keeps priority. Optional: the directory may be
# absent when the service is deployed on its own.
if (ROOT / "index.html").is_file():
    app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="site")
