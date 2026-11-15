# TerangaLunar

TerangaLunar suit le cycle jour/nuit au pôle Sud de la Lune et le confronte aux
onze points d'atterrissage du programme CLPS. Une seule question traverse le
site : à un endroit donné, quand y a-t-il du Soleil, quand la Terre est-elle en
vue, et combien de temps une mission peut-elle tenir avant la nuit.

Le site est public, sans compte, et fonctionne sans serveur. Il se lit à deux
niveaux : une découverte guidée pour qui découvre le sujet, un espace
scientifique pour qui veut vérifier chaque chiffre.

## Les pages

| Route | Contenu |
| --- | --- |
| `#/` | La Lune en plein écran, avec une échelle de distance réelle en bas |
| `#/map` | Le globe 3D et un menu à trois entrées : ombre, point d'étude, sites |
| `#/learn` | Visite guidée en quatre étapes |
| `#/sites` | Catalogue filtrable des onze points, avec un globe qui suit le survol |
| `#/science` | Métriques, hypothèses, données, API |
| `#/site/<id>` | Fiche d'un site : horizon, frise, seuils, export |
| `#/study?lat=…&lon=…` | Fiche d'étude d'un point, imprimable |
| `#/dates` | Meilleures dates de départ sur l'année |
| `#/compare` | Comparaison de deux ou trois sites |
| `#/discover` | Glossaire, questions fréquentes, repères |
| `#/help` | Méthode, sources, licences |

Chaque page a sa propre URL, un lien reproduit la même vue, et un point d'étude
se partage (`#/map?lat=-84.5&lon=12.3`). Tout l'état vit dans le fragment
d'adresse : il n'y a ni cookie ni stockage local.

La navigation tient dans un dock vertical à droite. Les quatre pages principales
sont groupées en haut, un filet les sépare de la visite guidée, et le passage
FR/EN ferme la colonne. Pas d'en-tête : sur l'accueil, la Lune occupe l'écran.

## Le moteur

Quatre couches, toutes calculées dans le navigateur.

L'éphéméride reprend les séries de Meeus (chapitres 25 et 47), avec une
précision d'environ 0,01° pour le Soleil et 10 secondes d'arc pour la Lune. Le
repère lunaire `MOON_ME` est reconstruit depuis l'état de Cassini : le pôle est à
1,5424° de l'écliptique, le méridien d'origine pointe vers la Terre moyenne, et
la libration en longitude comme en latitude est comprise. La géométrie locale
donne ensuite l'élévation et l'azimut du Soleil et de la Terre depuis chaque
site, au-dessus du masque d'horizon. L'agrégation en tire la part ensoleillée,
la plus longue nuit continue, les fenêtres de communication et une note pondérée
entre énergie et communications.

`node scripts/selftest.mjs` passe 35 vérifications indépendantes. Elles portent
sur des faits contrôlables : élongation à la nouvelle Lune du 8 avril 2024
(0,02° d'écart), élévation solaire maximale au pôle (1,64°), plage de la Terre
entre −7,0° et +6,7°, libration (7,9° et 6,8°), nuit équatoriale de 14,8 jours,
et le contrat des séries précalculées.

## Le relief est mesuré, pas illustré

`pipeline/build_terrain.py` lit le produit PDS LDEM_80S_80M de LOLA (80 m par
pixel, projection stéréographique polaire sud, 7600 × 7600, 16 bits) et écrit
`data/terrain.json` : pour chaque site polaire, 720 élévations apparentes, une
tous les 0,5° d'azimut, courbure lunaire comprise.

| Site | Altitude | Horizon maximal |
| --- | --- | --- |
| Malapert A | 2 581 m | 11,2° |
| Mons Mouton | 5 319 m | 4,1° |
| Crête de Mons Mouton | 6 012 m | 12,5° |
| Pôle Sud (référence) | 603 m | 22,4° |

Les sept autres points, à l'équateur ou sur les faces visible et cachée, tombent
hors de l'empreinte 80° S. Ils gardent le profil analytique de `data/sites.json`,
et chaque fiche l'écrit noir sur blanc plutôt que de laisser croire à une mesure.

## La scène 3D

Une seule texture d'albédo (mosaïque LROC, 4096 × 2048), précédée d'une version
légère pour le premier rendu. Le relief global module les sommets avec une
amplitude exagérée environ trois fois, sans quoi cinq kilomètres sur un rayon de
1737 ne se voient pas, et incline la normale pour que les crêtes accrochent la
lumière rasante. Cette inclinaison est calculée dans le repère du corps et non
par dérivées d'écran, qui explosent aux pôles là où la projection
équirectangulaire écrase la longitude.

Le terminateur vient de `dot(normale, direction subsolaire)` dans le fragment
shader : il est toujours là où l'éphéméride le place, quelle que soit la carte.
Les marqueurs sont des sprites dessinés au canvas, toujours face caméra et de
taille constante à l'écran.

Trois gestes, identiques d'un appareil à l'autre. Survoler un marqueur affiche
son étiquette, un clic ouvre la fiche. Sur un écran tactile, un premier appui
fait exactement ce que fait le survol, un second ouvre la fiche. Survoler une
ligne de la liste des sites allume le même marqueur sur le globe, avec
l'étiquette placée au-dessus du point.

L'échelle de l'accueil n'est pas décorative : elle donne la longueur réelle de
la barre au centre du globe, recalculée à chaque cran de molette depuis la
distance de la caméra, et affiche en dessous la valeur vivante du kilomètre par
pixel.

## La fiche d'étude

`#/study` rassemble, pour un point quelconque, les chiffres du séjour, le disque
du point vu de dessus, la frise d'ensoleillement et les fenêtres de
communication. Le disque est une projection orthographique inverse de la texture
d'albédo, dessinée dans un canvas : il est donc net, et imprimable.

Un champ permet de nommer le point ; le nom voyage dans l'URL et n'est stocké
nulle part. Cinq cases décident de ce qui reste sur la page : en-tête et
coordonnées, photo du point, valeurs instantanées, courbes, hypothèses et
sources. Elles agissent à l'écran comme à l'impression, et la feuille de style
d'impression compose une page A4 autonome, sans le dock ni les boutons.

## La marque

Le logo est un PNG livré avec le site. Comme l'export contient de grandes marges
transparentes et un fond blanc, le navigateur le retraite une fois au chargement :
il mesure la zone réellement dessinée, rogne le reste, et rend transparents les
pixels blancs avec un dégradé doux pour ne pas manger les contours argentés. Il
passe ainsi de 1408 × 768 à 1012 × 362, et se pose sur le ciel sans plaque.

L'icône d'onglet est générée par `scripts/make-favicon.py`, qui rogne la même
marque, la pose sur le fond nuit de la charte avec un coin arrondi et écrit les
deux tailles utiles. Un emblème clair sur fond transparent ne se lit pas à 16
pixels sur une barre d'onglets claire.

## Données

`data/sites.json` décrit les onze points : mission, opérateur, coordonnées,
statut, type, date, précision et profil d'horizon analytique. Le schéma est
validé au chargement, et un champ manquant produit un message lisible plutôt
qu'un écran vide.

Autour, `data/terrain.json` porte les masques mesurés, `data/seuils.json` les
trois seuils de la comparaison, `data/scenarios.json` les configurations de test,
et `data/glossaire.json` avec `data/sources.json` alimentent les pages de
pédagogie et la page méthode.

## Accessibilité et langues

Tout le contenu existe en français et en anglais, y compris les libellés
d'interface, les infobulles et les textes de la fiche d'étude. La mise en page
tient à 375 pixels de large, les cibles tactiles font 44 pixels, l'information
n'est jamais portée par la couleur seule (chaque état a son libellé), et les
animations s'effacent avec `prefers-reduced-motion`. Le dock, les panneaux et les
tableaux ont été vérifiés au clavier, et les tableaux larges défilent
horizontalement au lieu de casser la page.

## Ce qu'il y a dans le dépôt

```
index.html                 coquille et écran de chargement
assets/css/                jetons, composants, thème, surfaces, impression
assets/js/                 routeur, éphéméride, métriques, graphiques, globe 3D
assets/img/                textures lunaires, logo, icônes
assets/vendor/three/       Three.js livré avec le site
data/                      sites, masques, seuils, glossaire, sources
backend/                   service Python facultatif (FastAPI)
pipeline/                  LDEM vers masques, précalcul SPICE
scripts/                   serveur local, contrôles, génération d'icônes
```

`vercel.json` déclare le dépôt comme un projet à deux services : le site
statique à la racine, et le service Python dans `backend/`, qui ne reçoit que
les chemins `/api/`. Le site n'en dépend pas ; sans lui, tout continue de
fonctionner avec le calcul local.

## Limites

Le précalcul SPICE et le service Python reposent sur des noyaux JPL qui ne sont
pas dans le dépôt : ils sont fournis avec leurs garde-fous, mais n'ont pas été
exécutés ici. Un point d'étude libre suppose un horizon plat, seuls les sites du
catalogue ont un masque mesuré, et le panneau le dit. Il n'y a pas de modèle
thermique, ni de poussière, ni de pente, ni de trajectoire de descente.
L'éphéméride analytique reste à environ 0,1° de SPICE.

## Sources

Voir `data/sources.json` et la page `#/help`. Données de mission : NASA CLPS.
Texture : mosaïque LROC. Relief global : CGI Moon Kit. Masques d'horizon dérivés
de LDEM_80S_80M (LOLA GDR). Les cartes équirectangulaires sont échantillonnées en
miroir dans le shader, parce que `SphereGeometry` parcourt ses longitudes dans
l'autre sens, et c'est ce qui garde les mers sous les coordonnées des marqueurs.
