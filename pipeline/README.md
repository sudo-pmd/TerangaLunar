# Précalcul SPICE hors ligne

Génère, une fois pour toutes, les séries horaires par site avec les noyaux
officiels, et laisse le navigateur les consommer. L'application reste
entièrement statique : sans ces fichiers, elle retombe d'elle-même sur le
modèle analytique.

## Noyaux nécessaires

Copier dans `pipeline/kernels/` (non versionnés, voir `.gitignore`) :

| Fichier | Rôle |
| --- | --- |
| `naif0012.tls` | secondes intercalaires |
| `pck00011.tpc` | constantes planétaires |
| `moon_de440_250416.tf` | repères lunaires (dont `MOON_ME`) |
| `moon_pa_de440_250416.bpc` | orientation lunaire haute précision |
| `de440s.bsp` | éphéméride planétaire |

Ils sont chargés dans cet ordre (lsk → tpc → tf → bpc → bsp), ce qui est
nécessaire : `MOON_ME` n'existe qu'une fois le `.tf` et le `.bpc` chargés.

Pour le masque de relief, placer le produit LOLA dans `pipeline/lola/`
(`LDEM_80S.IMG` + `LDEM_80S.LBL`).

## Installation

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS / Linux
python -m pip install -r pipeline/requirements.txt
```

## Exécution

```bash
# Une année complète, pas d'une heure, tous les sites
python pipeline/precompute.py --start 2026-01-01 --days 366 --step 3600 --check

# Deux sites seulement, pas de 30 minutes
python pipeline/precompute.py --sites malapert_a,mons_mouton --step 1800

# Avec masque de relief LOLA
python pipeline/precompute.py --dem pipeline/lola/LDEM_80S.IMG --range-km 30

# Vérifier la projection du DEM avant de l'utiliser
python -c "from pipeline.horizon_dem import HorizonModel; print('\n'.join(HorizonModel('pipeline/lola/LDEM_80S.IMG').self_check()))"
```

`--check` affiche, par site, l'élévation solaire maximale et minimale, la plage
d'élévation terrestre et la part ensoleillée : de quoi repérer immédiatement une
erreur de repère ou de conversion.

## Sortie

```
data/precomputed/index.json      liste des sites disponibles + noyaux utilisés
data/precomputed/<site>.json     série d'un site
```

Contrat d'un fichier de site (angles en centièmes de degré, entiers) :

```json
{
  "site": "malapert_a",
  "start": "2026-01-01T00:00:00Z",
  "stepSeconds": 3600,
  "count": 8785,
  "scale": 100,
  "frame": "MOON_ME",
  "ephemeris": "spice-de440s",
  "kernels": ["naif0012.tls", "..."],
  "sunAlt": [123, 118, "..."],
  "sunAz": [28011, 28020, "..."],
  "earthAlt": ["..."],
  "earthAz": ["..."],
  "horizon": { "step": 0.5, "values": ["..."] }
}
```

Une année horaire pèse environ 170 kB par site, très en dessous de la limite de
5 Mo (NF-04). `horizon` est absent quand `--dem` n'est pas fourni : le navigateur
garde alors le profil illustratif de `data/sites.json`.

## Côté navigateur

`assets/js/precomputed.js` charge `index.json` au premier rendu d'une fiche de
site, puis le fichier du site. La série n'est utilisée que si elle couvre
**exactement** la fenêtre demandée ; sinon `buildSeries` recalcule en analytique.
L'encadré « Hypothèses et limites » affiche la source réellement employée
(« SPICE précalculé » ou « série analytique Meeus »).

## Limites de ce module

- `horizon_dem.py` n'a **pas été exécuté** contre un vrai produit LDEM dans ce
  dépôt (le fichier n'y est pas). La projection stéréographique polaire sud est
  écrite d'après le label PDS ; `self_check()` et `--check` sont là pour la
  valider avant usage (pôle au centre de l'image, `lat −89 / lon 0` à ~21 km).
- Sans `--dem`, les masques restent les profils illustratifs : les chiffres
  indiquent une tendance, pas une garantie locale.
- ΔT n'est pas appliquée (`str2et` travaille en UTC converti par le noyau LSK).
