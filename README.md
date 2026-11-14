# CLPS Lunar Mission Browser

Site web statique, bilingue FR/EN, pour explorer la lumière du Soleil, la vue de la Terre et les nuits lunaires aux sites d'atterrissage des missions CLPS (NASA Space Apps 2026).

## Fonctions
Accueil avec globe 3D · page d'un site (vue d'horizon, frise du temps, chiffres clés, seuils, score) · comparaison de 2–3 plans · meilleures dates (carte de chaleur, top 5) · mode « Découvrir » (3 scénarios) · aide, sources et glossaire · récapitulatif imprimable · liens partageables · export CSV/PNG.

## Installation
Voir `FICHIERS_A_COPIER.txt` (deux gros fichiers à placer à la main, commandes Windows incluses).

## Régénérer les données
`python pipeline/run_all.py` : calcule les angles (SPICE), les masques d'horizon (LOLA), puis exporte `web/public/data/` (< 5 Mo par site). Tests : `pytest pipeline/tests`.

## Ajouter une mission ou un site
Éditer `web/public/config/sites.json` (champs : id, mission, entreprise, nom, lat, lon, statut, type, date_cible, coord_statut, source, note_fr, note_en), éventuellement `sources.json` et `seuils.json`, puis relancer `run_all.py`. Aucune modification de code.

## Déploiement
`cd web && npm run build`, puis publier `web/dist` tel quel (GitHub Pages, Netlify, tout hébergement statique ; liens relatifs, routage par `#`).

## Limites
Les données fournies dans cette archive sont PROVISOIRES tant que `de440s.bsp` et `LDEM_80S_80M.IMG` n'ont pas été copiés. Plusieurs coordonnées CLPS sont approximatives (`coord_statut`) et doivent être vérifiées. Le score ne simule pas l'orientation des panneaux solaires.

## Licences et crédits
Voir `LICENSE.txt` et `DATA_LICENSES.txt`.
