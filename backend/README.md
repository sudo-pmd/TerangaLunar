# Service de calcul Python (optionnel)

FastAPI + SpiceyPy. Il calcule le point subsolaire et l'illumination d'un point
avec les noyaux officiels du JPL, et sert le site statique sur la même origine.

## Installation

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate    # macOS / Linux
python -m pip install -r backend/requirements.txt
```

## Noyaux

Copier dans `pipeline/kernels/` (non versionnés) :

`naif0012.tls`, `pck00011.tpc`, `moon_de440_250416.tf`,
`moon_pa_de440_250416.bpc`, `de440s.bsp`

L'ordre de chargement est géré par `backend/app.py` : `tls → tpc → tf → bpc → bsp`.

## Lancer

```bash
uvicorn backend.app:app --port 8000
```

- http://127.0.0.1:8000 — le site, avec `/api` sur la même origine
- http://127.0.0.1:8000/docs — documentation interactive
- http://127.0.0.1:8000/api/health — état des noyaux

Pendant le développement, `node scripts/serve.mjs` redirige déjà `/api` vers le
port 8000 : les deux peuvent tourner ensemble.

## Points d'entrée

| Route | Réponse |
| --- | --- |
| `GET /api/health` | noyaux chargés, repère, moteur ; `503` si les noyaux manquent |
| `GET /api/subsolar?t=2026-03-01T12:00:00Z` | latitude/longitude subsolaire (`subslr`), distance du Soleil |
| `GET /api/site?lat=-80.13&lon=1.44&t=…` | élévation solaire et visibilité (`ilumin`), sans relief |

Exemple :

```bash
curl "http://127.0.0.1:8000/api/subsolar?t=2026-03-01T12:00:00Z"
```

```json
{"t":"2026-03-01T12:00:00Z","lat":-0.42,"lon":141.7,"frame":"MOON_ME",
 "source":"spice-subslr","sunDistanceKm":148…}
```

## Ce que fait le frontend

`assets/js/live.js` interroge `/api/health` une fois par session :

- service présent → la carte 3D affiche le point subsolaire SPICE, rafraîchi
  toutes les 5 secondes, et l'espace scientifique indique « éphéméride SPICE » ;
- service absent (204 ou erreur réseau) → rien n'est affiché comme en panne, le
  calcul analytique local reste la source.

## Limites

Ce service n'apporte **pas** le relief : `/api/site` suppose une surface
sphérique. Le masque de terrain reste celui du navigateur (ou celui produit par
`pipeline/horizon_dem.py`).

Aucune donnée n'est stockée ni journalisée. CORS est ouvert en lecture seule pour
permettre un hébergement séparé du site statique.
