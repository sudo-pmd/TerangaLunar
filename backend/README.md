# Service de calcul Python

Ce dossier contient un service FastAPI facultatif. Il calcule le point
subsolaire et l'illumination d'un point avec les noyaux officiels du JPL, là où
le site le fait avec des séries analytiques. Le site l'interroge s'il répond, et
continue sans lui sinon.

Le point d'entrée est `app:app` : le module `app.py` expose l'objet `app`, ce qui
suffit à un serveur ASGI comme à la plateforme d'hébergement.

## Noyaux attendus

Cinq fichiers sont nécessaires, dans `pipeline/kernels/` :

`naif0012.tls`, `pck00011.tpc`, `moon_de440_250416.tf`,
`moon_pa_de440_250416.bpc`, `de440s.bsp`.

Ils ne sont pas dans le dépôt : ce sont des binaires lourds, distribués par le
NAIF, et `.gitignore` les exclut. L'ordre de chargement compte, et il est fixé
dans `app.py` : secondes intercalaires, constantes planétaires, repères,
orientation lunaire, éphéméride.

Sans ces fichiers, le service démarre quand même et le dit. `/api/health`
répond alors en `503` avec le motif, et le site retombe silencieusement sur son
calcul local : aucune page ne s'affiche en erreur pour autant.

## Les trois routes

| Route | Réponse |
| --- | --- |
| `GET /api/health` | noyaux chargés, repère, moteur, ou `503` si les noyaux manquent |
| `GET /api/subsolar?t=2026-03-01T12:00:00Z` | latitude et longitude subsolaires, distance du Soleil |
| `GET /api/site?lat=-80.13&lon=1.44&t=…` | élévation solaire et visibilité en un point |

Les deux calculs passent par `subslr` et `ilumin` dans le repère `MOON_ME`, avec
l'aberration `LT+S`. Le point subsolaire est ramené sur l'ellipsoïde du corps
avant d'être converti en latitude et longitude, sinon la projection sur une
sphère de rayon moyen décale le résultat de quelques dixièmes de degré aux
hautes latitudes.

## Côté navigateur

`assets/js/live.js` interroge `/api/health` une fois par session. Si le service
répond, la carte affiche le point subsolaire SPICE rafraîchi toutes les cinq
secondes et l'espace scientifique indique la provenance du calcul. S'il renvoie
`204` ou une erreur réseau, rien n'est signalé comme en panne : le calcul local
reste la source, et la page continue de fonctionner.

## Ce que ce service n'apporte pas

Le relief. `/api/site` suppose une surface sphérique et ignore le masque de
terrain, qui reste calculé dans le navigateur à partir de `data/terrain.json`.
Un point bas derrière une crête y sera donc annoncé éclairé plus longtemps qu'il
ne l'est en réalité.

Aucune donnée n'est stockée ni journalisée. CORS est ouvert en lecture seule
pour permettre d'héberger le service séparément du site statique.
