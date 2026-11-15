# Données du site

Sept fichiers, tous en JSON, lus au démarrage par le navigateur. Aucun n'est
généré à l'affichage : ce qui est ici est ce qui s'affiche.

## `sites.json`

Le catalogue : onze points d'atterrissage, quatre types (`polar`, `nearside`,
`farside`, `reference`) et quatre statuts (`landed`, `lost`, `planned`,
`reference`). Chaque entrée porte l'identifiant, la mission, l'opérateur, le nom
en français et en anglais, les coordonnées, le statut, la date, une précision de
position et la source, puis un profil d'horizon analytique (`max`, `floor`, `az`,
`rough`) utilisé partout où le relief mesuré n'existe pas.

Le fichier porte aussi la version du jeu de données, le repère (`MOON_ME`) et le
nom du fichier de relief. Le schéma est validé au chargement : un champ manquant
produit un message lisible, pas un écran vide.

## `terrain.json`

Les masques d'horizon mesurés par `pipeline/build_terrain.py` sur LDEM_80S_80M.
Quatre sites, 720 valeurs chacun en centièmes de degré, une tous les 0,5°
d'azimut, sur 30 km de portée. Le fichier décrit sa propre projection, son rayon
de référence, sa résolution et sa génération, de sorte qu'un masque produit avec
d'autres réglages reste identifiable.

Les sept autres sites du catalogue n'y figurent pas : ils tombent hors de
l'empreinte 80° S du DEM. Le site le dit sur chaque fiche concernée.

## `seuils.json`

Les trois seuils qui décident de la couleur d'un verdict : part ensoleillée
minimale (50 %), nuit continue maximale (3 jours), visibilité terrestre minimale
(20 %). Ils sont rassemblés ici pour que la règle soit lisible à un seul endroit.

## `scenarios.json`

Les textes de la page « Découvrir », en français et en anglais : le cycle
lunaire, l'orbite, les fenêtres de communication. Chaque scénario a un
identifiant, une clé de titre et des paragraphes par langue.

## `glossaire.json` et `sources.json`

Les définitions du glossaire, par terme et par langue, et les sources
bibliographiques avec la date de consultation. Ces deux fichiers alimentent la
page méthode, où chaque chiffre du site peut être rattaché à une origine.

## `precomputed/`

Le répertoire des séries SPICE produites par `pipeline/precompute.py`. Il est
vide à dessein : `index.json` le dit et porte la raison. Tant qu'aucune entrée
n'existe, le site calcule tout en analytique et l'indique dans l'espace
scientifique.
