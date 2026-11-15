# Du relief mesuré au navigateur

Deux scripts hors ligne, deux buts séparés. `build_terrain.py` transforme le
relief réel du pôle Sud en masques d'horizon que le site lit au démarrage.
`precompute.py` fige des séries Soleil et Terre calculées par SPICE, pour éviter
de les recalculer dans le navigateur.

Aucun des deux ne tourne à l'exécution du site : ce sont des outils de
production de données. Le premier a été exécuté pour produire `data/terrain.json` ;
le second attend des noyaux JPL absents du dépôt et n'a pas été lancé ici.

## Le relief, et pourquoi il change tout

Au pôle Sud, un Soleil qui passe à 1,64° de hauteur n'éclaire pas un fond de
cratère. Sans relief, le modèle annonce du jour là où une crête fait de l'ombre
pendant des semaines. Le script projette donc chaque site dans le produit
LDEM_80S_80M de LOLA, et pour chacun des 720 azimuts, marche le long du grand
cercle jusqu'à 30 km, retire la courbure (`d² / 2R`) et garde l'élévation
apparente maximale.

Le produit attendu a des caractéristiques précises : 7600 × 7600, 16 bits,
80 m par pixel, projection stéréographique polaire sud, centre à −90° et 0°. Il
couvre 80° S à 90° S, ce qui inclut quatre des onze sites du catalogue.

Le label PDS qui l'accompagne réserve trois surprises, toutes commentées dans
`horizon_dem.py`. `SAMPLE_TYPE = LSB_INTEGER` impose de lire les échantillons en
petit-boutiste : en grand-boutiste, on obtient un relief plausible et faux.
`SCALING_FACTOR = 0.5` donne une hauteur en mètres relative au rayon de
référence, pas un rayon : ajouter l'offset ici décalerait tout de 1737 km, et les
différences s'annulent sans que les altitudes affichées soient justes.
`^IMAGE` ne contient que le nom du fichier, sans numéro d'enregistrement, et le
label comporte des `END_OBJECT` avant le bloc de projection : seul un `END` seul
le termine.

Le DEM est ouvert en `memmap`. Cent dix mégaoctets sur disque, quelques
mégaoctets en mémoire ; en `float32` il en faudrait 220, que cette machine
refuse quand un navigateur tourne à côté.

### Le contrôle qui compte

`HorizonModel.self_check()` affiche la projection avant tout calcul. Le test
utile est le second point : à un degré d'arc du pôle, la distance vaut
`2R·tan(0,5°)`, soit environ 30,3 km. Si le script annonce 21 km, l'échelle ou le
rayon est faux, et tout ce qui suit est à jeter.

### Format de sortie

`data/terrain.json` porte les paramètres du calcul (pixel, rayon, portée,
quantification) puis, par site, la latitude, la longitude, l'altitude, l'horizon
maximal et les 720 valeurs en centièmes de degré. Un zéro signifie un horizon
horizontal. Les élévations négatives sont ramenées à zéro : depuis un sommet,
l'horizon descend sous l'horizontale, mais un Soleil rasant reste visible, et le
plancher à zéro est la lecture conservatrice.

## Les séries SPICE

`precompute.py` demande `spiceypy` et les cinq noyaux décrits dans
`backend/README.md`. Il écrit un fichier par site, couvrant une fenêtre de dates
à pas fixe, avec l'élévation et l'azimut du Soleil et de la Terre, plus le
masque d'horizon si on le lui donne.

Une année au pas horaire pèse environ 170 ko par site, en centièmes de degré.
Côté navigateur, `assets/js/precomputed.js` ne sert une série que si elle couvre
exactement la fenêtre demandée ; sinon le calcul analytique reprend la main. Ce
contrat strict évite le pire des cas : une courbe juste à un bout et fausse à
l'autre.

## État dans ce dépôt

`data/terrain.json` est le fruit d'une exécution réelle de `build_terrain.py` :
quatre sites mesurés (Malapert A à 11,2°, Mons Mouton à 4,1°, la crête de Mons
Mouton à 12,5°, le pôle de référence à 22,4°), sept hors empreinte et laissés au
profil analytique.

`data/precomputed/index.json` est vide à dessein. Aucun noyau JPL n'est présent,
`spiceypy` n'est pas installé, et le script n'a donc pas tourné. Il est fourni
avec ses garde-fous plutôt qu'avec des séries inventées.
