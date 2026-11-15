# Outils du dépôt

Quatre outils, tous facultatifs pour qui ne fait que consulter le site. Ils
servent à le regarder en local, à vérifier le moteur, à contrôler ce qui part en
ligne, et à régénérer l'icône d'onglet.

## `serve.mjs`

Un serveur statique minimal, sans dépendance. Il sert le dossier courant, avec
les bons types MIME, et relaie `/api` vers le service Python quand celui-ci
tourne, ou répond `204` sinon. Ce `204` est volontaire : le client du service
n'a ainsi aucune erreur réseau à avaler dans la console quand le backend est
absent, ce qui est le cas normal.

Rien dans le site n'exige ce serveur. N'importe quel hébergeur statique fait
l'affaire ; celui-ci existe parce qu'ouvrir `index.html` par un `file://` ne
charge pas les modules JavaScript, et parce que les tests manuels ont besoin
d'une origine HTTP.

## `selftest.mjs`

Trente-cinq vérifications du moteur, sans navigateur. Le script importe les
modules d'éphéméride, d'horizon et de métriques, et compare leurs sorties à des
valeurs de référence : élongation à la nouvelle Lune du 8 avril 2024, élévation
solaire maximale au pôle, plage de la Terre au fil du mois, libration, durée de
la nuit équatoriale, cohérence des séries précalculées.

C'est le garde-fou du discours scientifique. Les chiffres affichés sur les pages
viennent de ces fonctions ; si une constante dérive, le test le dit avant que la
page ne raconte n'importe quoi.

## `check-deploy.mjs`

Le contrôle avant publication, pensé pour un hébergement statique. Il répond à
trois questions.

Le poids d'abord : aucun fichier ne doit dépasser les limites de l'hébergeur, et
le produit LOLA de 111 Mo doit rester hors de Git. Les références ensuite :
chaque chemin cité dans le HTML, le CSS et le JavaScript doit exister réellement,
ce qui attrape les fichiers oubliés. La casse enfin : Windows ne distingue pas
`Texture.JPG` de `texture.jpg`, un serveur Linux si, et l'écart ne se voit qu'en
ligne, sous la forme d'un 404 silencieux.

Une référence marquée `optional-asset` sur sa ligne est tolérée absente : c'est
le mécanisme utilisé pour les gros produits facultatifs.

## `make-favicon.py`

Génère `assets/img/favicon-64.png` et `favicon-180.png` à partir de la marque.
Le script décode le PNG source, le rogne à son dessin, l'échantillonne en
moyenne de blocs et le pose sur un carré arrondi couleur nuit avant d'écrire un
PNG en RGBA.

Il existe parce que la marque est un emblème clair sur fond transparent : réduite
à 16 pixels sur une barre d'onglets claire, elle ne montre rien. La plaque sombre
et le rognage lui rendent une silhouette lisible. Le script n'a pas de dépendance
Python : le décodage, le redimensionnement et l'encodage tiennent en une
centaine de lignes de bibliothèque standard.
