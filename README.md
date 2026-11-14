# TerangaLunar

**Space & Lunar Missions** — le cycle jour/nuit au pôle Sud de la Lune, en direct,
et les vraies fenêtres d'atterrissage des missions CLPS.

Le site est public : aucun compte, aucun serveur indispensable. Il se lit à deux
niveaux — une découverte guidée pour le grand public, un espace scientifique pour
vérifier chaque chiffre.

---

## Les pages

| Route | Page | Public |
| --- | --- | --- |
| `#/` | La Lune, plein écran. Rien d'autre. | tous |
| `#/map` | Le globe 3D en plein écran, et un menu vertical qui ouvre une section à la fois : ombre, point d'étude, sites, orbite, pôle Sud | tous |
| `#/learn` | Visite guidée en 4 étapes interactives | tous |
| `#/sites` | Catalogue filtrable des 11 points | tous |
| `#/science` | Métriques, hypothèses, données, API | scientifique |
| `#/site/<id>` | Fiche d'un site : horizon, frise, seuils, export | scientifique |
| `#/dates` | Meilleures dates de départ sur l'année | scientifique |
| `#/compare` | Comparaison de 2 ou 3 sites | scientifique |
| `#/discover` | Glossaire, FAQ, repères | tous |
| `#/help` | Méthode, sources, licences | tous |

Chaque page a sa propre URL ; un lien reproduit la même vue. Un point d'étude se
partage aussi : `#/map?lat=-84.5&lon=12.3`.

La navigation tient dans un dock vertical à droite, avec le passage FR/EN en bas.
Pas d'en-tête : sur l'accueil, la Lune occupe tout l'écran.

## Chargement

`index.html` contient l'écran de chargement — le logo, une roue, et une seule
ligne qui dit ce qui est en cours (« Relief lunaire… », « Scène 3D… ») : il est
visible avant même le premier module JavaScript. Il disparaît quand la
configuration, les masques de relief et la texture 4K sont prêts — avec un délai
minimal pour éviter un clignotement, et un plafond de 9 s pour ne jamais rester
bloqué sur une texture lente.

## Ce que calcule le moteur

1. **Éphéméride** — séries de Meeus (ch. 25 et 47), ~0,01° pour le Soleil et 10″
   pour la Lune.
2. **Repère lunaire** — `MOON_ME` reconstruit depuis l'état de Cassini : pôle à
   1,5424° de l'écliptique, méridien d'origine vers la Terre moyenne. Libration
   en longitude et en latitude comprise.
3. **Géométrie locale** — élévation et azimut du Soleil et de la Terre depuis
   chaque site, au-dessus du masque d'horizon.
4. **Agrégation** — part ensoleillée, plus longue nuit continue, fenêtres de
   communication, note pondérée énergie / communications.

`node scripts/selftest.mjs` exécute **35 vérifications** indépendantes :
élongation à la nouvelle Lune du 8 avril 2024 (0,02°), élévation solaire
maximale au pôle (1,64°), plage de la Terre (−7,0° à +6,7°), libration (7,9° /
6,8°), nuit équatoriale (14,8 jours), contrat des séries précalculées.

## Le relief est mesuré, plus illustré

`pipeline/build_terrain.py` lit le produit PDS **LDEM_80S_80M** (LOLA, 80 m/pixel,
stéréographique polaire sud, 7600 × 7600, 16 bits) et écrit `data/terrain.json` :
pour chaque site polaire, 720 élévations apparentes (une tous les 0,5° d'azimut),
courbure lunaire comprise.

```bash
python pipeline/build_terrain.py            # relit pipeline/lola/LDEM_80S_80M.IMG
```

Résultat sur les quatre sites couverts par l'empreinte du DEM :

| Site | Altitude | Horizon maximal |
| --- | --- | --- |
| Malapert A | 2 581 m | 11,2° |
| Mons Mouton | 5 319 m | 4,1° |
| Crête de Mons Mouton | 6 012 m | 12,5° |
| Pôle Sud (référence) | 603 m | 22,4° |

Les sept autres points (équateur, face visible, face cachée) sont hors de
l'empreinte 80° S : ils gardent le profil analytique de `data/sites.json`, et
chaque fiche l'écrit noir sur blanc (`isMeasured()` dans `assets/js/horizon.js`).

Deux détails du label PDS valent d'être connus, ils sont expliqués dans
`pipeline/horizon_dem.py` : `LSB_INTEGER` impose du petit-boutiste, et
`SCALING_FACTOR` donne une hauteur en mètres (pas un rayon). Le DEM est lu en
`memmap` : 110 Mo sur disque, quelques mégaoctets en mémoire.

## La scène 3D

- **Texture** : `assets/img/moon.jpg`, 4096 × 2048 (mosaïque LROC), précédée de
  `assets/img/low/moon.jpg` pour le premier rendu.
- **Relief** : `assets/img/ldem_3_8bit.jpg` module les sommets (amplitude
  exagérée ×3 environ, sans quoi 5 km sur 1737 km ne se voient pas) et incline la
  normale pour que les crêtes accrochent la lumière rasante. L'inclinaison est
  calculée dans le repère du corps, pas par dérivées d'écran : celles-ci
  explosaient aux pôles, où la projection équirectangulaire écrase la longitude.
- **Terminateur** : `dot(normale, direction subsolaire)` dans le fragment shader,
  donc il est toujours là où l'éphéméride le place, quelle que soit la carte.
- **Marqueurs** : sprites dessinés au canvas (halo, anneau, cœur), toujours face
  caméra, taille constante à l'écran, animés au survol.
- **Point d'étude** : un clic sur le globe (ou deux coordonnées) pose un
  réticule et affiche l'élévation du Soleil et de la Terre à cet endroit précis.
- **Vue du pôle Sud** : la même scène, caméra sous la Lune (`view: 'south'`), en
  bas de la page carte.

## Dimensions réelles

Le diagramme Soleil–Terre–Lune respecte les **rayons** : Lune 1737 km, Terre
6371 km (×3,67), Soleil ×109 Terres. Les distances, elles, sont comprimées — et le
diagramme l'écrit. Faire glisser la Lune autour de la Terre change la phase, donc
l'horloge et le terminateur : un tour complet vaut un mois synodique.

## Ajouter un site

Éditez `data/sites.json`, rien d'autre : le schéma est validé au chargement et
les champs manquants produisent un message lisible. Si le site tombe dans
l'empreinte du LDEM, relancez `build_terrain.py` pour lui donner un masque mesuré.

```json
{
  "id": "mon_site", "mission": "TO-XX", "company": "Opérateur",
  "name": "Nom", "nameFr": "Nom", "lat": -84.5, "lon": 12.3,
  "status": "planned", "type": "polar", "date": "2027",
  "precision": "approximate", "source": "https://…",
  "horizon": { "max": 1.0, "floor": -5.0, "az": 180, "rough": 0.4 }
}
```

## Service de calcul Python (optionnel)

`backend/app.py` expose `/api/health`, `/api/subsolar` et `/api/site` avec
SpiceyPy et les noyaux officiels. Le site l'utilise s'il répond, et retombe sinon
sur le calcul local — l'espace scientifique affiche lequel des deux a servi.

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.app:app --port 8000
```

## Précalcul SPICE hors ligne (optionnel)

```bash
python pipeline/precompute.py --start 2026-01-01 --days 366 --step 3600 --check
```

Écrit `data/precomputed/index.json` et un fichier par site (~170 kB/an). La série
n'est utilisée que si elle couvre exactement la fenêtre demandée.

## Lancer le site

```bash
node scripts/serve.mjs 4173    # http://127.0.0.1:4173
node scripts/selftest.mjs      # 35 vérifications
```

N'importe quel hébergeur statique convient. `scripts/serve.mjs` relaie `/api`
vers le service Python s'il tourne, et répond `204` sinon (pas de 404 en console).

## Publier sur GitHub Pages

Le site est entièrement statique : aucun build, aucune compilation. Ce qui est
dans le dossier est ce qui est publié, tel quel.

### Ce qui empêchait la carte de s'afficher en ligne

| Cause | Effet | Ce qui est en place |
| --- | --- | --- |
| Three.js chargé depuis jsdelivr | si le CDN est filtré (proxy, réseau d'entreprise, CSP), le module ne charge pas : le globe reste vide et la carte 3D disparaît | Three.js est **livré avec le site** (`assets/vendor/three/`), l'import map pointe sur des chemins relatifs |
| `pipeline/lola/LDEM_80S_80M.IMG` (110 Mo) | GitHub refuse tout fichier de plus de 100 Mo : le `push` échoue | `pipeline/lola/` et `*.IMG` sont dans `.gitignore` — le produit LOLA reste sur votre disque |
| Casse des noms de fichiers | Windows ne distingue pas `Texture.JPG` de `texture.jpg`, GitHub Pages si : 404 silencieux en ligne seulement | `scripts/check-deploy.mjs` compare chaque référence au nom réel du fichier |
| Jekyll | GitHub Pages filtre certains fichiers avant de les servir | `.nojekyll` à la racine |

Poids du site prêt à publier : **4,6 Mo** (52 fichiers), très loin des limites
de GitHub (100 Mo par fichier, 1 Go par dépôt).

### Les étapes

```bash
# 1. Vérifier avant d'envoyer
node scripts/selftest.mjs          # 35 contrôles du moteur
node scripts/check-deploy.mjs      # taille, chemins, casse — doit finir par « Prêt à publier »

# 2. Versionner
git init
git add .
git commit -m "TerangaLunar"
git branch -M main
git remote add origin https://github.com/<votre-compte>/<depot>.git
git push -u origin main
```

3. Sur GitHub : **Settings → Pages → Source : Deploy from a branch**, puis
   branche `main` et dossier `/ (root)`. Enregistrer.
4. Attendre une minute : le site est sur
   `https://<votre-compte>.github.io/<depot>/`.

Les liens sont relatifs (`./assets/…`, `data/…`), donc le site fonctionne aussi
bien à la racine d'un domaine que dans un sous-dossier `/<depot>/`. Aucune ligne
à changer.

### Mettre à jour

```bash
git add .
git commit -m "…"
git push
```

GitHub Pages republie tout seul en une minute environ. Si une page semble
ancienne, forcez le rechargement (Ctrl+F5) : les fichiers sont mis en cache.

### Si le gros fichier a déjà été commité

Le `push` est alors refusé. Retirez-le de l'index, puis de l'historique :

```bash
git rm --cached pipeline/lola/LDEM_80S_80M.IMG
git commit -m "Retire le produit LOLA du dépôt"
# si le fichier est déjà dans un commit plus ancien :
git filter-repo --path pipeline/lola/ --invert-paths
```

### Vérifier en ligne

Ouvrez la console (F12). Un `404` sur un fichier nomme le chemin exact — c'est
presque toujours une casse ou un fichier oublié : `node scripts/check-deploy.mjs`
le trouve avant l'envoi.

## Organisation

```
index.html                 coquille, écran de chargement, import map Three.js
assets/css/tokens.css      palette et éléments de base
assets/css/app.css         composants historiques
assets/css/theme.css       ciel, dock, titres, panneaux
assets/css/theme3.css      dock vertical, chargeur, page carte, transitions
assets/css/surface.css     surfaces sombres arrondies, ombres, globe-cercle
assets/js/app.js           routeur, coquille, écran de chargement
assets/js/ephemeris.js     Soleil, Lune, repère MOON_ME
assets/js/metrics.js       séries, agrégats, meilleures dates
assets/js/charts.js        horizon polaire, frise, carte de chaleur
assets/js/horizon.js       masques d'horizon (mesurés ou analytiques)
assets/js/moon3d.js        globe Three.js, relief, marqueurs, point d'étude
assets/vendor/three/       Three.js 0.169 livré avec le site (aucun CDN)
scripts/check-deploy.mjs   contrôle avant publication (taille, chemins, casse)
assets/js/orrery.js        diagramme Soleil–Terre–Lune interactif
assets/js/map.js           la page carte
assets/js/pages.js         visite guidée, catalogue, espace scientifique
assets/js/views.js         accueil, fiche, dates, comparaison, aide
assets/js/starfield.js     fond étoilé
assets/js/live.js          client du service Python (silencieux s'il est absent)
assets/js/precomputed.js   séries SPICE précalculées
data/terrain.json          masques mesurés (générés)
data/*.json                sites, seuils, scénarios, glossaire, sources
pipeline/                  LDEM → masques, précalcul SPICE
backend/                   service Python optionnel
```

## Design

Ciel en obsidienne `#070A12`, or `#C9A227`, Soleil `#F6B23C`, Terre `#2563EB`.
Titres en serif, texte en sans, peu de cartes, peu d'effets au survol : la
hiérarchie porte la lecture, pas les ombres. L'information n'est jamais portée par
la couleur seule (chaque état a aussi son libellé). Les animations se coupent avec
`prefers-reduced-motion`, et le ciel disparaît à l'impression.

## Limites

- Le précalcul SPICE et le service Python n'ont pas été exécutés ici (aucun noyau
  JPL dans le dépôt) ; ils sont fournis avec leurs garde-fous.
- Un point d'étude libre utilise un horizon plat : seuls les sites du catalogue
  ont un masque mesuré. C'est écrit dans le panneau.
- Pas de modèle thermique, de poussière, de pente ni de trajectoire de descente.
- L'éphéméride analytique reste à ~0,1° de SPICE.

## Sources et licences

Voir `data/sources.json` et la page `#/help`. Données de mission : NASA CLPS.
Texture : mosaïque LROC (`assets/img/moon.jpg`, 4096 × 2048), relief global
`assets/img/ldem_3_8bit.jpg` (CGI Moon Kit), masques d'horizon dérivés de
`LDEM_80S_80M` (LOLA GDR). Les cartes équirectangulaires sont échantillonnées en
miroir dans le shader, parce que `SphereGeometry` parcourt ses longitudes dans
l'autre sens ; c'est ce qui garde les mers sous les coordonnées des marqueurs.
