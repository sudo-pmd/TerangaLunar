# TerangaLunar

**Space & Lunar Missions** — le cycle jour/nuit au pôle Sud de la Lune, en direct,
et les vraies fenêtres d'atterrissage des missions CLPS.

Le site est public et ouvert à tous : aucune inscription, aucun compte, aucun
serveur indispensable. Il propose deux niveaux de lecture — une découverte guidée
pour le grand public, un espace scientifique pour vérifier chaque chiffre.

---

## Les pages

| Route | Page | Public |
| --- | --- | --- |
| `#/` | Accueil : la Lune en 3D, les trois contraintes du pôle, derniers atterrissages | tous |
| `#/map` | Carte 3D temps réel : terminateur jour/nuit, horloge accélérée, vue polaire | tous |
| `#/learn` | Visite guidée en 4 étapes interactives | tous |
| `#/sites` | Catalogue filtrable des 11 points | tous |
| `#/science` | Tableau complet des métriques, hypothèses, données, API | scientifique |
| `#/site/<id>` | Fiche d'un site : horizon polaire, frise, seuils, export | scientifique |
| `#/dates` | Meilleures dates de départ sur l'année | scientifique |
| `#/compare` | Comparaison de 2 ou 3 sites | scientifique |
| `#/discover` | Découverte : glossaire, FAQ, repères | tous |
| `#/help` | Méthode, sources, licences | tous |

Chaque page a sa propre URL : un lien reproduit exactement la même vue. Aucune
note personnelle ne passe par l'URL.

## Ce que calcule le moteur

1. **Éphéméride** — séries de Meeus (ch. 25 et 47) pour le Soleil et la Lune,
   précision de l'ordre de 0,01° pour le Soleil et 10″ pour la Lune.
2. **Repère lunaire** — `MOON_ME` reconstruit depuis l'état de Cassini : pôle à
   1,5424° de l'écliptique, obliquité opposée à l'orbite, méridien d'origine vers
   la Terre moyenne. Libration en longitude et en latitude comprise.
3. **Géométrie locale** — élévation et azimut du Soleil et de la Terre depuis
   chaque site, au-dessus d'un profil de relief.
4. **Agrégation** — part ensoleillée, plus longue nuit continue, fenêtres de
   communication, note pondérée (énergie / communications).

Le terminateur du globe 3D vient du **point subsolaire réel** : il avance avec
l'horloge, il n'est pas décoratif.

### Validation

`node scripts/selftest.mjs` exécute **35 vérifications** indépendantes, dont :

- élongation à la nouvelle Lune du 8 avril 2024 : 0,02° ;
- élévation solaire maximale au pôle Sud : 1,64° ;
- élévation terrestre au pôle : −7,0° à +6,7° ;
- amplitude de libration : 7,9° en longitude, 6,8° en latitude ;
- nuit équatoriale : 14,8 jours ;
- contrat des séries précalculées SPICE : décodage, fenêtre, repli.

## Le relief

Le modèle de terrain n'est **pas** embarqué : les profils de `data/sites.json`
sont illustratifs, avec une crête (`max`), une direction (`az`), une rugosité et
un plancher (`floor`, négatif pour un sommet qui voit sous l'horizontale). Les
chiffres indiquent donc une tendance, pas une garantie locale — c'est écrit dans
chaque encadré « Hypothèses et limites ».

## Ajouter un site

Éditez `data/sites.json`, rien d'autre : l'application valide le schéma au
chargement et signale les champs manquants avec un message lisible.

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

Le dépôt fournit un service **FastAPI + SpiceyPy** qui calcule le point subsolaire
et l'illumination d'un site avec les noyaux officiels du JPL :

```
backend/app.py            API /api/health, /api/subsolar, /api/site
backend/requirements.txt  fastapi, uvicorn, spiceypy, numpy
```

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.app:app --port 8000   # sert aussi le site statique
```

Le service répond alors sur la même origine que le site, et le navigateur
l'utilise automatiquement pour l'horloge de la carte. **Sans lui, tout continue
de fonctionner** : le calcul analytique local prend le relais et l'espace
scientifique affiche « calcul analytique local ».

Les noyaux attendus sont listés dans [`pipeline/README.md`](pipeline/README.md).

## Précalcul SPICE hors ligne (optionnel)

Pour figer une année entière de séries calculées hors ligne :

```bash
python pipeline/precompute.py --start 2026-01-01 --days 366 --step 3600 --check
```

Le script écrit `data/precomputed/index.json` et un fichier par site (~170 kB par
an et par site). Le navigateur ne s'en sert que si la série couvre exactement la
fenêtre demandée, et revient sinon au modèle analytique. `data/precomputed`
contient par défaut un index vide et documenté.

## Lancer le site

```bash
node scripts/serve.mjs 4173    # http://127.0.0.1:4173
node scripts/selftest.mjs      # 35 vérifications
```

N'importe quel hébergeur statique convient. `scripts/serve.mjs` redirige `/api`
vers le service Python s'il tourne, et répond `204` sinon.

## Organisation

```
index.html               coquille unique, import map Three.js
assets/css/tokens.css    palette et éléments de base
assets/css/app.css       composants
assets/css/theme.css     ciel étoilé, en-têtes sombres, carte et visite
assets/js/ephemeris.js   Soleil, Lune, repère MOON_ME
assets/js/metrics.js     séries, agrégats, meilleures dates
assets/js/charts.js      horizon polaire, frise, carte de chaleur
assets/js/moon3d.js      globe Three.js, mode temps réel
assets/js/pages.js       carte, visite guidée, catalogue, espace scientifique
assets/js/views.js       accueil, fiche, dates, comparaison, aide
assets/js/starfield.js   fond étoilé
assets/js/live.js        client du service Python (silencieux s'il est absent)
assets/js/precomputed.js séries SPICE précalculées
data/*.json              sites, seuils, scénarios, glossaire, sources
pipeline/                précalcul SPICE et masque LOLA
backend/                 service Python optionnel
```

## Design

Le ciel est en obsidienne `#080B14`, l'encre sur papier `#111827`, les filets
`#E2E8F0`, le Soleil `#F59E0B`, la Terre `#2563EB`, l'or de la marque `#C9A227`.
Les surfaces de lecture restent claires pour le contraste ; l'information n'est
jamais portée par la couleur seule. Le fond étoilé se coupe avec
`prefers-reduced-motion` et à l'impression.

## Limites

- Relief illustratif, pas le modèle LOLA LDEM 80S.
- Pas de modèle thermique, de poussière, de trajectoire de descente ni de pente.
- Pas de noyaux JPL embarqués : l'éphéméride analytique reste à ~0,1° de SPICE.
- Le service Python et le précalcul n'ont pas pu être exécutés dans cet
  environnement (aucun interpréteur Python, aucun noyau) : ils sont fournis avec
  leurs garde-fous (`--check`, `/api/health`), à valider au premier lancement.

## Sources et licences

Voir `data/sources.json` et la page `#/help`. Données de mission : NASA CLPS.

Texture lunaire : `assets/img/moon.jpg`, carte d'albédo équirectangulaire (1024×512)
dérivée des données NASA, issue des exemples three.js. Elle est miroirée en U pour
que les mers restent sous les coordonnées sélénographiques des marqueurs. Si le
fichier est absent, le globe retombe sur son relief procédural.
