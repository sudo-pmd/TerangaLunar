# Du LDEM au navigateur

Deux scripts, deux buts distincts :

| Script | Entrée | Sortie | Dépendances |
| --- | --- | --- | --- |
| `build_terrain.py` | `lola/LDEM_80S_80M.IMG` + `.LBL` | `data/terrain.json` | numpy |
| `precompute.py` | noyaux SPICE | `data/precomputed/*.json` | spiceypy, numpy |

Le premier est celui qui conte : il transforme le relief réel en masques
d'horizon que le site consomme au démarrage. Le second fige des séries
Soleil/Terre calculées par SPICE pour éviter de les recalculer dans le
navigateur.

## Relief : `build_terrain.py`

```bash
python pipeline/build_terrain.py
# ou explicitement
python pipeline/build_terrain.py --dem pipeline/lola/LDEM_80S_80M.IMG \
    --range-km 30 --step 0.5 --height-m 2
```

Le produit attendu est **LDEM_80S_80M** (LOLA GDR, `LRO-L-LOLA-4-GDR-V1.0`) :
7600 × 7600, 16 bits, 80 m/pixel, stéréographique polaire sud vrai au pôle,
centre à −90° / 0°. Il couvre 80° S à 90° S.

À placer dans `pipeline/lola/`, avec son label :

```
pipeline/lola/LDEM_80S_80M.IMG   111 Mo
pipeline/lola/LDEM_80S_80M.LBL
```

Ce que fait le script, par site :

1. projette (lat, lon) en (échantillon, ligne) — stéréographique, rayon 1737,4 km ;
2. échantillonne l'altitude au point, bilinéaire ;
3. pour chacun des 720 azimuts, marche le long du grand cercle jusqu'à 30 km,
   retire la courbure (`d² / 2R`) et garde l'élévation apparente maximale ;
4. quantifie en centièmes de degré et écrit `data/terrain.json`.

### Trois pièges du label PDS

- `SAMPLE_TYPE = LSB_INTEGER` : les échantillons sont en **petit-boutiste**. Les
  lire en grand-boutiste produit un relief plausible mais faux.
- `SCALING_FACTOR = 0.5` donne une **hauteur** en mètres relative au rayon de
  référence (`OFFSET = 1737400`) : `HEIGHT = DN × 0.5`. Ajouter `OFFSET` ici
  décalerait tout de 1737 km — les différences s'annulent, pas les altitudes
  affichées.
- `^IMAGE` ne contient **que le nom du fichier**, sans numéro d'enregistrement :
  les données commencent à l'octet 1. Et le label contient des `END_OBJECT` avant
  le bloc `IMAGE_MAP_PROJECTION` : seul un `END` seul termine le label.

Le DEM est ouvert en `memmap` : 110 Mo sur disque, une poignée de mégaoctets en
mémoire. C'est volontaire — en `float32` il faudrait 220 Mo, que cette machine
refuse quand un navigateur tourne.

### Contrôles

`HorizonModel.self_check()` affiche la projection avant tout calcul :

```
pôle image → lat -90.000°, lon 0.000° (attendu ≈ −90°) / 0°
(lat −89, lon 0) → 30.4 km du centre (attendu ≈ 30 km)
grille 7600×7600 · 80 m/pixel · rayon 1737.4 km · pas 0.5 m/DN
altitude au point (lat −89, lon 0) : -390 m (réf. 1737 km)
```

Le second point est le test qui compte : un degré d'arc au pôle vaut
`2R·tan(0,5°) ≈ 30,3 km`. S'il en sort 21 km, l'échelle ou le rayon est faux.

### Format de sortie

```json
{
  "generated": "2026-11-14T11:38:00Z",
  "source": "LOLA LDEM 80S 80M (LRO-L-LOLA-4-GDR-V1.0)",
  "dem": "LDEM_80S_80M.IMG",
  "pixelM": 80, "radiusM": 1737400, "rangeKm": 30, "heightM": 2,
  "step": 0.5, "scale": 100,
  "sites": {
    "malapert_a": { "lat": -80.13, "lon": 1.44, "elevation": 2581,
                    "max": 11.2, "min": 0.0, "values": [0, 12, "…"] }
  },
  "skipped": ["mare_crisium (-84.00°) …"]
}
```

`values` contient 720 entiers (centièmes de degré), 0 = horizon horizontal. Les
élévations négatives sont ramenées à 0 : depuis un sommet, l'horizon descend sous
l'horizontale, mais un Soleil rasant reste visible — le plancher à 0 est la
lecture conservatrice.

## Séries SPICE : `precompute.py`

Nécessite `spiceypy` et cinq noyaux dans `pipeline/kernels/` (non versionnés) :

| Fichier | Rôle |
| --- | --- |
| `naif0012.tls` | secondes intercalaires |
| `pck00011.tpc` | constantes planétaires |
| `moon_de440_250416.tf` | repères lunaires, dont `MOON_ME` |
| `moon_pa_de440_250416.bpc` | orientation lunaire |
| `de440s.bsp` | éphéméride planétaire |

```bash
python -m pip install -r pipeline/requirements.txt
python pipeline/precompute.py --start 2026-01-01 --days 366 --step 3600 --check
python pipeline/precompute.py --sites malapert_a,mons_mouton --step 1800
python pipeline/precompute.py --dem pipeline/lola/LDEM_80S_80M.IMG   # masques inclus
```

`--check` affiche par site l'élévation solaire maximale et minimale, la plage
terrestre et la part ensoleillée : de quoi repérer une erreur de repère en une
ligne.

Contrat d'un fichier de site (angles en centièmes de degré) :

```json
{
  "site": "malapert_a", "start": "2026-01-01T00:00:00Z",
  "stepSeconds": 3600, "count": 8785, "scale": 100,
  "frame": "MOON_ME", "ephemeris": "spice-de440s",
  "kernels": ["naif0012.tls", "…"],
  "sunAlt": [123, 118, "…"], "sunAz": [28011, "…"],
  "earthAlt": ["…"], "earthAz": ["…"],
  "horizon": { "step": 0.5, "values": ["…"] }
}
```

Une année horaire pèse ~170 kB par site. Côté navigateur,
`assets/js/precomputed.js` ne sert la série que si elle couvre **exactement** la
fenêtre demandée ; sinon `buildSeries` recalcule en analytique.

## État dans ce dépôt

- `build_terrain.py` **a été exécuté** : quatre sites mesurés (Malapert A 11,2°,
  Mons Mouton 4,1°, crête de Mons Mouton 12,5°, pôle 22,4°), sept hors empreinte.
- `precompute.py` n'a **pas** été exécuté : aucun noyau JPL n'est présent, et
  `spiceypy` n'est pas installé. Le fichier est fourni avec ses garde-fous.
- ΔT n'est pas appliquée (`str2et` travaille en UTC converti par le LSK).
