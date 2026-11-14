/**
 * Bilingual interface strings. Every visible label lives here; components
 * render through t() so FR/EN swaps without a reload.
 */

import { EXTRA } from './i18n-theme.js';

const fr = {
  'brand.name': 'CLPS Lunar Mission Browser',
  'brand.tag': 'NASA Space Apps Challenge 2026',

  'nav.home': 'Carte des sites',
  'nav.dates': 'Meilleures dates',
  'nav.compare': 'Comparer',
  'nav.discover': 'Découvrir',
  'nav.help': 'Aide et sources',
  'nav.skip': 'Aller au contenu',
  'nav.menu': 'Navigation principale',

  'lang.switch': 'Langue',
  'lang.fr': 'Français',
  'lang.en': 'English',

  'home.kicker': 'Pôle Sud lunaire · planification d’atterrissage',
  'home.title': 'Choisir le bon jour pour atterrir près du pôle Sud',
  'home.lede':
    'La Lune tourne en 29,5 jours. Près du pôle Sud, le Soleil rase l’horizon et la Terre reste basse mais presque toujours visible : quelques crêtes offrent énergie et communications continues. Explorez les sites CLPS heure par heure.',
  'home.cta': 'Explorer un site',
  'home.cta2': 'Comprendre en 3 minutes',
  'home.stat.sites': 'sites suivis',
  'home.stat.landed': 'sites atteints',
  'home.stat.cycle': 'jours par cycle lunaire',
  'home.list.title': 'Sites d’atterrissage',
  'home.list.lede':
    'Chaque fiche combine la géométrie Soleil–Terre et un profil de relief. Les sites de référence servent d’étalon.',
  'home.filter.company': 'Entreprise',
  'home.filter.status': 'Statut',
  'home.filter.all': 'Toutes',
  'home.filter.allStatus': 'Tous',
  'home.hint': 'Cliquez un point sur la Lune ou une fiche pour ouvrir l’analyse.',
  'home.scene.alt': 'Lune interactive : les points marquent les sites d’atterrissage CLPS.',
  'home.scene.skip': 'Passer l’introduction',
  'home.scene.hint': 'Glisser pour tourner · molette pour zoomer',
  'home.scene.fallback': 'Vue 3D indisponible : utilisez la liste des sites ci-dessous.',

  'status.landed': 'Posé',
  'status.planned': 'Prévu',
  'status.lost': 'Échec',
  'status.reference': 'Référence',
  'type.polar': 'Pôle Sud',
  'type.nearside': 'Face visible',
  'type.farside': 'Face cachée',
  'type.reference': 'Référence',

  'site.coords': 'Coordonnées',
  'site.open': 'Ouvrir l’analyse',
  'site.mission': 'Mission',
  'site.company': 'Opérateur',
  'site.status': 'Statut',
  'site.date': 'Date',
  'site.precision.approximate': 'Position approximative',
  'site.precision.published': 'Position publiée',
  'site.precision.reference': 'Point de référence',
  'site.source': 'Source',

  'metric.sun': 'Part ensoleillée',
  'metric.sun.help': 'Heures où le Soleil dépasse le relief, sur la durée du séjour.',
  'metric.night': 'Plus longue nuit',
  'metric.night.help': 'Plus longue période continue sans Soleil pendant le séjour.',
  'metric.earth': 'Fenêtres Terre',
  'metric.earth.help': 'Part du séjour où la Terre est au-dessus du relief.',
  'metric.score': 'Note globale',
  'metric.score.help': 'Moyenne pondérée énergie / communications (60/40 par défaut).',
  'metric.windows': 'fenêtres',
  'metric.window': 'fenêtre',
  'metric.nightTruncated': 'nuit commencée avant la fenêtre',

  'site.title': 'Analyse du site',
  'site.shift': 'Décaler la date de',
  'site.stay': 'Durée du séjour',
  'site.stay.7': '7 jours',
  'site.stay.14': '14 jours',
  'site.stay.29': 'Cycle complet (29,5 j)',
  'site.stay.60': '60 jours',
  'site.profile': 'Profil',
  'site.profile.eng': 'Ingénierie',
  'site.profile.sci': 'Science',
  'site.profile.all': 'Tout',
  'site.dateLabel': 'Date d’atterrissage (UTC)',
  'site.dateHelp': 'Toutes les heures sont en temps universel coordonné.',
  'site.copy': 'Copier le lien',
  'site.copied': 'Lien copié dans le presse-papiers.',
  'site.print': 'Imprimer / PDF',
  'site.back': 'Retour à la carte',
  'site.notFound': 'Site inconnu',
  'site.notFoundHelp': 'Cet identifiant ne correspond à aucun site du fichier de configuration.',
  'site.outOfRange': 'Cette date sort de la plage calculée.',
  'site.clamped': 'Le séjour dépasse la fin de la plage calculée : il est tronqué.',
  'site.noTerrain': 'Site hors couverture du relief : horizon plat utilisé.',

  'horizon.title': 'Horizon polaire',
  'horizon.lede':
    'Vue du ciel au-dessus du site : le bord du cercle est l’horizon (0°), le centre 10° d’élévation. Le Nord est en haut.',
  'horizon.mask': 'Profil de relief',
  'horizon.sun': 'Soleil',
  'horizon.earth': 'Terre',
  'horizon.track': 'trace 24 h',
  'horizon.below': 'horizon sous l’horizontale',
  'horizon.hidden': 'masqué par le relief',
  'horizon.visible': 'au-dessus du relief',
  'horizon.summary': 'Azimut {az}°, élévation {el}°. {state}.',
  'horizon.desc':
    'Diagramme circulaire du ciel : azimut autour du cercle, élévation du bord vers le centre. La silhouette grise est le relief, les points jaune et bleu sont le Soleil et la Terre.',

  'timeline.title': 'Visibilité heure par heure',
  'timeline.lede': 'Soleil et Terre au-dessus du relief. Les hachures marquent l’ombre : l’information ne dépend pas de la couleur.',
  'timeline.day': 'Jour',
  'timeline.stay': 'Séjour',
  'timeline.year': 'Année',
  'timeline.sun': 'Soleil visible',
  'timeline.earth': 'Terre visible',
  'timeline.shadow': 'Ombre',
  'timeline.hover': 'Survolez ou utilisez les flèches pour lire une heure.',
  'timeline.now': 'Heure choisie',
  'timeline.summary': 'Frise de visibilité : piste Soleil en haut, piste Terre en dessous. Les zones hachurées sont les périodes d’ombre.',

  'thr.title': 'Respect des seuils',
  'thr.lede': 'Modifiez une contrainte : le verdict se met à jour immédiatement.',
  'thr.criterion': 'Critère',
  'thr.measured': 'Valeur mesurée',
  'thr.threshold': 'Seuil',
  'thr.verdict': 'Verdict',
  'thr.sun': 'Ensoleillement minimal',
  'thr.night': 'Nuit continue maximale',
  'thr.earth': 'Contact Terre minimal',
  'thr.ok': 'Respecté',
  'thr.ko': 'Non respecté',
  'thr.allOk': 'Tous les seuils sont respectés pour ce séjour.',
  'thr.someKo': '{n} seuil(s) non respecté(s) sur ce séjour.',

  'profile.sci.title': 'Lecture science',
  'profile.sci.sun': 'Hauteur du Soleil',
  'profile.sci.grazing': 'Éclairage rasant (< 5°)',
  'profile.sci.shadow': 'Direction des ombres',
  'profile.sci.hours': 'heures cumulées',
  'profile.eng.title': 'Lecture ingénierie',
  'profile.eng.power': 'Énergie solaire disponible',
  'profile.eng.night': 'Nuit à couvrir',
  'profile.eng.telecom': 'Liaison Terre',
  'profile.eng.verdict': 'Verdict des seuils',

  'assume.title': 'Hypothèses et limites',
  'assume.data': 'Version des données',
  'assume.computed': 'Calcul effectué le',
  'assume.frame': 'Repère',
  'assume.step': 'Pas de temps',
  'assume.terrain': 'Relief',
  'assume.terrainValue': 'profil analytique (site hors de l’empreinte LDEM 80S)',
  'assume.ephem': 'Éphéméride',
  'assume.ephemValue': 'série analytique Meeus, précision ~0,1°',
  'assume.ephemSpice': 'SPICE précalculé (DE440s · MOON_ME · LT+S)',
  'assume.model': 'Pas de modèle thermique, ni de trajectoire, ni de pente locale.',

  'notes.title': 'Notes de mission',
  'notes.help': 'Conservées dans ce navigateur uniquement, jamais dans le lien partagé.',
  'notes.placeholder': 'Décisions, questions ouvertes, contacts…',
  'notes.saved': 'Notes enregistrées.',
  'gloss.label': 'Définition',

  'dates.title': 'Meilleures dates de départ',
  'dates.lede': 'Chaque case est une date d’atterrissage possible, notée sur la durée du séjour choisie.',
  'dates.heatmap': 'Carte de chaleur des notes',
  'dates.top': 'Cinq meilleures dates',
  'dates.rank': 'Rang',
  'dates.start': 'Date de départ',
  'dates.score': 'Note',
  'dates.use': 'Utiliser cette date',
  'dates.legend': 'Note faible',
  'dates.legendHigh': 'Note élevée',
  'dates.month': 'Mois',
  'dates.best': 'meilleure',
  'dates.weights': 'Poids énergie / communications',
  'dates.energy': 'Énergie',
  'dates.comm': 'Communications',

  'compare.title': 'Comparer des sites et des plans',
  'compare.lede': 'Deux ou trois sites, une même période. Les écarts sont calculés par rapport au plan de référence.',
  'compare.pick': 'Sites à comparer',
  'compare.reference': 'Référence',
  'compare.table': 'Comparaison des sites sur la même période',
  'compare.row.sun': 'Part ensoleillée',
  'compare.row.night': 'Plus longue nuit',
  'compare.row.nightStart': 'Début de la nuit',
  'compare.row.windows': 'Fenêtres Terre',
  'compare.row.score': 'Note globale',
  'compare.row.verdict': 'Verdict',
  'compare.delta': 'écart',
  'compare.ranking': 'Classement des sites pour la date choisie',
  'compare.rank': 'Rang',
  'compare.site': 'Site',
  'compare.mission': 'Mission',
  'compare.export': 'Exporter en CSV',
  'compare.needTwo': 'Sélectionnez au moins deux sites.',
  'compare.max': 'Trois sites au maximum.',

  'discover.title': 'Découvrir',
  'discover.lede': 'Trois explications sans jargon, avec un curseur de date pour voir le Soleil bouger.',
  'discover.s1.title': '1. Un jour lunaire dure 29,5 jours',
  'discover.s2.title': '2. Pourquoi le pôle Sud est stratégique',
  'discover.s3.title': '3. Et si l’atterrissage est retardé ?',
  'discover.q': 'Questions pour réfléchir',
  'discover.a': 'Voir la réponse',
  'discover.compare': 'Comparer pôle Sud et équateur',
  'discover.pole': 'Pôle Sud',
  'discover.equator': 'Équateur',
  'discover.sunNow': 'Soleil maintenant',
  'discover.date': 'Date',
  'discover.scrub': 'Faites glisser pour changer la date',
  'discover.glossary': 'Glossaire',
  'discover.glossaryLede': 'Les termes techniques de l’application, en clair.',

  'help.title': 'Aide et sources',
  'help.method': 'Méthode de calcul',
  'help.m1': 'Les positions du Soleil et de la Terre sont calculées dans un repère lunaire fixe (MOON_ME), à partir des séries analytiques de Meeus.',
  'help.m2': 'L’élévation est l’angle entre l’astre et l’horizon local ; l’azimut est mesuré depuis le Nord, dans le sens horaire.',
  'help.m3': 'La visibilité compare cette élévation au profil de relief dans la direction de l’astre, avec la correction du bord solaire (0,27°).',
  'help.m4': 'Les indicateurs sont calculés sur la fenêtre exacte du séjour, heure par heure, en temps universel.',
  'help.limits': 'Limites connues',
  'help.l1': 'Le relief des sites polaires est mesuré sur LOLA LDEM 80S (80 m/pixel) ; les sites hors de cette empreinte gardent un profil analytique, signalé comme tel sur leur fiche.',
  'help.l2': 'Le pas est de une heure : un relief peut masquer le Soleil quelques minutes sans être vu.',
  'help.l3': 'Ni thermique, ni poussière, ni trajectoire d’approche, ni pente locale ne sont modélisés.',
  'help.l4': 'L’éphéméride analytique reste à environ 0,1° des éphémérides SPICE ; les noyaux ne sont pas embarqués.',
  'help.sources': 'Ressources utilisées',
  'help.license': 'Licence',
  'help.consulted': 'Consultée le',
  'help.version': 'Version',
  'help.resource': 'Ressource',
  'help.link': 'Lien',

  'ui.loading': 'Chargement des données…',
  'ui.error': 'Impossible de charger la configuration.',
  'ui.retry': 'Réessayer',
  'ui.utc': 'UTC',
  'ui.hours': 'h',
  'ui.days': 'j',
  'ui.from': 'du',
  'ui.to': 'au',
  'ui.none': 'aucune',
  'ui.unit.deg': '°',
  'footer.data': 'Données',
  'footer.computed': 'Calcul',
  'footer.sources': 'Sources et licences',
  'footer.limits': 'Limites',
  'footer.note': 'Éphémérides et métriques calculées dans le navigateur, à partir des jeux de données publics de la NASA.',
};

const en = {
  'brand.name': 'CLPS Lunar Mission Browser',
  'brand.tag': 'NASA Space Apps Challenge 2026',

  'nav.home': 'Site map',
  'nav.dates': 'Best dates',
  'nav.compare': 'Compare',
  'nav.discover': 'Discover',
  'nav.help': 'Help & sources',
  'nav.skip': 'Skip to content',
  'nav.menu': 'Main navigation',

  'lang.switch': 'Language',
  'lang.fr': 'Français',
  'lang.en': 'English',

  'home.kicker': 'Lunar south pole · landing planning',
  'home.title': 'Picking the right day to land near the south pole',
  'home.lede':
    'The Moon turns once every 29.5 days. Near the south pole the Sun skims the horizon while Earth stays low but almost always in view, so a few ridges offer near-continuous power and comms. Explore the CLPS sites hour by hour.',
  'home.cta': 'Explore a site',
  'home.cta2': 'Understand it in 3 minutes',
  'home.stat.sites': 'sites tracked',
  'home.stat.landed': 'sites reached',
  'home.stat.cycle': 'days per lunar cycle',
  'home.list.title': 'Landing sites',
  'home.list.lede':
    'Each card combines Sun–Earth geometry with a terrain profile. Reference sites act as a baseline.',
  'home.filter.company': 'Company',
  'home.filter.status': 'Status',
  'home.filter.all': 'All',
  'home.filter.allStatus': 'All',
  'home.hint': 'Click a point on the Moon or a card to open the analysis.',
  'home.scene.alt': 'Interactive Moon: dots mark CLPS landing sites.',
  'home.scene.skip': 'Skip intro',
  'home.scene.hint': 'Drag to rotate · scroll to zoom',
  'home.scene.fallback': '3D view unavailable: use the site list below.',

  'status.landed': 'Landed',
  'status.planned': 'Planned',
  'status.lost': 'Failed',
  'status.reference': 'Reference',
  'type.polar': 'South pole',
  'type.nearside': 'Near side',
  'type.farside': 'Far side',
  'type.reference': 'Reference',

  'site.coords': 'Coordinates',
  'site.open': 'Open analysis',
  'site.mission': 'Mission',
  'site.company': 'Provider',
  'site.status': 'Status',
  'site.date': 'Date',
  'site.precision.approximate': 'Approximate position',
  'site.precision.published': 'Published position',
  'site.precision.reference': 'Reference point',
  'site.source': 'Source',

  'metric.sun': 'Sunlit share',
  'metric.sun.help': 'Hours when the Sun clears the terrain, across the stay.',
  'metric.night': 'Longest night',
  'metric.night.help': 'Longest unbroken period without sunlight during the stay.',
  'metric.earth': 'Earth windows',
  'metric.earth.help': 'Share of the stay with Earth above the terrain.',
  'metric.score': 'Overall score',
  'metric.score.help': 'Weighted mean of energy and communications (60/40 by default).',
  'metric.windows': 'windows',
  'metric.window': 'window',
  'metric.nightTruncated': 'night began before the window',

  'site.title': 'Site analysis',
  'site.shift': 'Shift the date by',
  'site.stay': 'Stay duration',
  'site.stay.7': '7 days',
  'site.stay.14': '14 days',
  'site.stay.29': 'Full cycle (29.5 d)',
  'site.stay.60': '60 days',
  'site.profile': 'Profile',
  'site.profile.eng': 'Engineering',
  'site.profile.sci': 'Science',
  'site.profile.all': 'Everything',
  'site.dateLabel': 'Landing date (UTC)',
  'site.dateHelp': 'All times are Coordinated Universal Time.',
  'site.copy': 'Copy link',
  'site.copied': 'Link copied to the clipboard.',
  'site.print': 'Print / PDF',
  'site.back': 'Back to the map',
  'site.notFound': 'Unknown site',
  'site.notFoundHelp': 'This identifier matches no site in the configuration file.',
  'site.outOfRange': 'This date falls outside the computed range.',
  'site.clamped': 'The stay runs past the computed range and is truncated.',
  'site.noTerrain': 'Site outside terrain coverage: flat horizon used.',

  'horizon.title': 'Polar horizon',
  'horizon.lede':
    'The sky above the site: the rim is the horizon (0°), the centre is 10° elevation. North is up.',
  'horizon.mask': 'Terrain profile',
  'horizon.sun': 'Sun',
  'horizon.earth': 'Earth',
  'horizon.track': '24 h track',
  'horizon.below': 'horizon below the horizontal',
  'horizon.hidden': 'hidden by terrain',
  'horizon.visible': 'above the terrain',
  'horizon.summary': 'Azimuth {az}°, elevation {el}°. {state}.',
  'horizon.desc':
    'Circular sky diagram: azimuth around the circle, elevation from rim to centre. The grey silhouette is the terrain; the yellow and blue dots are the Sun and Earth.',

  'timeline.title': 'Hour-by-hour visibility',
  'timeline.lede': 'Sun and Earth above the terrain. Hatching marks shadow, so the reading never depends on colour alone.',
  'timeline.day': 'Day',
  'timeline.stay': 'Stay',
  'timeline.year': 'Year',
  'timeline.sun': 'Sun visible',
  'timeline.earth': 'Earth visible',
  'timeline.shadow': 'Shadow',
  'timeline.hover': 'Hover or use the arrow keys to read an hour.',
  'timeline.now': 'Selected hour',
  'timeline.summary': 'Visibility timeline: Sun track on top, Earth track below. Hatched bands are shadow periods.',

  'thr.title': 'Constraint verdicts',
  'thr.lede': 'Change a constraint and the verdict updates immediately.',
  'thr.criterion': 'Criterion',
  'thr.measured': 'Measured',
  'thr.threshold': 'Threshold',
  'thr.verdict': 'Verdict',
  'thr.sun': 'Minimum sunlight',
  'thr.night': 'Maximum continuous night',
  'thr.earth': 'Minimum Earth contact',
  'thr.ok': 'Respected',
  'thr.ko': 'Not respected',
  'thr.allOk': 'Every constraint holds for this stay.',
  'thr.someKo': '{n} constraint(s) not respected for this stay.',

  'profile.sci.title': 'Science reading',
  'profile.sci.sun': 'Sun elevation',
  'profile.sci.grazing': 'Grazing light (< 5°)',
  'profile.sci.shadow': 'Shadow direction',
  'profile.sci.hours': 'cumulative hours',
  'profile.eng.title': 'Engineering reading',
  'profile.eng.power': 'Available solar power',
  'profile.eng.night': 'Night to survive',
  'profile.eng.telecom': 'Earth link',
  'profile.eng.verdict': 'Constraint verdicts',

  'assume.title': 'Assumptions and limits',
  'assume.data': 'Data version',
  'assume.computed': 'Computed on',
  'assume.frame': 'Frame',
  'assume.step': 'Time step',
  'assume.terrain': 'Terrain',
  'assume.terrainValue': 'analytic profile (site outside the LDEM 80S footprint)',
  'assume.ephem': 'Ephemeris',
  'assume.ephemValue': 'Meeus analytical series, ~0.1° accuracy',
  'assume.ephemSpice': 'precomputed SPICE (DE440s · MOON_ME · LT+S)',
  'assume.model': 'No thermal model, no descent trajectory, no local slope.',

  'notes.title': 'Mission notes',
  'notes.help': 'Stored in this browser only, never in the shared link.',
  'notes.placeholder': 'Decisions, open questions, contacts…',
  'notes.saved': 'Notes saved.',
  'gloss.label': 'Definition',

  'dates.title': 'Best departure dates',
  'dates.lede': 'Each cell is a possible landing date, scored over the selected stay duration.',
  'dates.heatmap': 'Score heat map',
  'dates.top': 'Five best dates',
  'dates.rank': 'Rank',
  'dates.start': 'Departure date',
  'dates.score': 'Score',
  'dates.use': 'Use this date',
  'dates.legend': 'Low score',
  'dates.legendHigh': 'High score',
  'dates.month': 'Month',
  'dates.best': 'best',
  'dates.weights': 'Energy / communications weights',
  'dates.energy': 'Energy',
  'dates.comm': 'Communications',

  'compare.title': 'Compare sites and plans',
  'compare.lede': 'Two or three sites over the same period. Deltas are measured against the reference plan.',
  'compare.pick': 'Sites to compare',
  'compare.reference': 'Reference',
  'compare.table': 'Site comparison over the same period',
  'compare.row.sun': 'Sunlit share',
  'compare.row.night': 'Longest night',
  'compare.row.nightStart': 'Night start',
  'compare.row.windows': 'Earth windows',
  'compare.row.score': 'Overall score',
  'compare.row.verdict': 'Verdict',
  'compare.delta': 'delta',
  'compare.ranking': 'Site ranking for the chosen date',
  'compare.rank': 'Rank',
  'compare.site': 'Site',
  'compare.mission': 'Mission',
  'compare.export': 'Export CSV',
  'compare.needTwo': 'Select at least two sites.',
  'compare.max': 'Three sites at most.',

  'discover.title': 'Discover',
  'discover.lede': 'Three plain-language explanations, with a date slider to watch the Sun move.',
  'discover.s1.title': '1. A lunar day lasts 29.5 days',
  'discover.s2.title': '2. Why the south pole is strategic',
  'discover.s3.title': '3. What if the landing slips?',
  'discover.q': 'Questions to think about',
  'discover.a': 'Show the answer',
  'discover.compare': 'Compare south pole and equator',
  'discover.pole': 'South pole',
  'discover.equator': 'Equator',
  'discover.sunNow': 'Sun right now',
  'discover.date': 'Date',
  'discover.scrub': 'Drag to change the date',
  'discover.glossary': 'Glossary',
  'discover.glossaryLede': 'The technical terms used here, in plain words.',

  'help.title': 'Help and sources',
  'help.method': 'Calculation method',
  'help.m1': 'Sun and Earth positions are computed in a lunar body-fixed frame (MOON_ME) from Meeus analytical series.',
  'help.m2': 'Elevation is the angle between a body and the local horizon; azimuth is measured from North, clockwise.',
  'help.m3': 'Visibility compares that elevation with the terrain profile toward the body, including the solar limb correction (0.27°).',
  'help.m4': 'Every metric is evaluated over the exact stay window, hour by hour, in universal time.',
  'help.limits': 'Known limits',
  'help.l1': 'Polar terrain is measured on LOLA LDEM 80S (80 m/pixel); sites outside that footprint keep an analytic profile, labelled as such on their sheet.',
  'help.l2': 'One-hour steps can miss a ridge that hides the Sun for a few minutes.',
  'help.l3': 'No thermal, dust, descent-trajectory or local-slope modelling.',
  'help.l4': 'The analytical ephemeris stays within about 0.1° of SPICE kernels; the kernels are not bundled.',
  'help.sources': 'Resources used',
  'help.license': 'License',
  'help.consulted': 'Consulted',
  'help.version': 'Version',
  'help.resource': 'Resource',
  'help.link': 'Link',

  'ui.loading': 'Loading data…',
  'ui.error': 'Could not load the configuration.',
  'ui.retry': 'Retry',
  'ui.utc': 'UTC',
  'ui.hours': 'h',
  'ui.days': 'd',
  'ui.from': 'from',
  'ui.to': 'to',
  'ui.none': 'none',
  'ui.unit.deg': '°',
  'footer.data': 'Data',
  'footer.computed': 'Computed',
  'footer.sources': 'Sources and licenses',
  'footer.limits': 'Limits',
  'footer.note': 'Ephemerides and metrics computed in the browser from NASA public datasets.',
};

// Identity, live map, guided tour and science strings live in their own file.
Object.assign(fr, EXTRA.fr);
Object.assign(en, EXTRA.en);

const dict = { fr, en };

let current = 'fr';
const listeners = new Set();

export function setLang(lang) {
  current = dict[lang] ? lang : 'fr';
  document.documentElement.lang = current;
  try {
    localStorage.setItem('clps.lang', current);
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn(current));
}

export function getLang() {
  return current;
}

export function initLang(preferred) {
  let lang = preferred;
  if (!lang) {
    try {
      lang = localStorage.getItem('clps.lang');
    } catch {
      lang = null;
    }
  }
  if (!lang) {
    lang = (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
  setLang(lang);
  return current;
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars) {
  const table = dict[current] || fr;
  let value = table[key] ?? fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, String(v));
  }
  return value;
}

/** Localised label for a data value such as status or site type. */
export function tValue(prefix, value) {
  const key = `${prefix}.${value}`;
  const table = dict[current] || fr;
  return table[key] ?? fr[key] ?? value;
}

const locales = { fr: 'fr-FR', en: 'en-GB' };

export function fmtDate(ms, opts = {}) {
  const date = new Date(ms);
  return new Intl.DateTimeFormat(locales[current], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...opts,
  }).format(date);
}

export function fmtDateTime(ms) {
  return new Intl.DateTimeFormat(locales[current], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

export function fmtTime(ms) {
  return new Intl.DateTimeFormat(locales[current], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

export function fmtNum(value, digits = 0) {
  return new Intl.NumberFormat(locales[current], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fmtPct(value, digits = 0) {
  return `${fmtNum(value, digits)} %`;
}

export function fmtDuration(hours) {
  const days = hours / 24;
  if (days >= 1.5) return `${fmtNum(days, 1)} ${t('ui.days')}`;
  return `${fmtNum(hours, 0)} ${t('ui.hours')}`;
}

/** Localised site name: French names fall back to the English field. */
export function siteName(site) {
  return current === 'fr' ? site.nameFr || site.name : site.name;
}
