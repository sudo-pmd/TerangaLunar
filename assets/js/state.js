/**
 * View state shared through the URL hash, so a link reproduces exactly the same
 * view with no account and no personal data.
 *
 *   #/site/malapert_a?d=2026-03-01T12:00&n=14&p=eng&w=60&th=50,3,20&lg=en
 *   #/map?lat=-84.5&lon=12.3
 */

export const DEFAULT_STATE = {
  route: 'home',
  siteId: null,
  dateMs: Date.UTC(2026, 2, 1, 12, 0, 0),
  stayDays: 14,
  profile: 'eng',
  weights: { energy: 60, comm: 40 },
  language: null,
  compare: [],
  seuils: null,
  /** Free study point on the map: {lat, lon} or null. */
  probe: null,
};

const ROUTES = new Set([
  'home', 'map', 'learn', 'sites', 'science',
  'site', 'study', 'dates', 'compare', 'discover', 'help',
]);

/** Parse a hash such as "#/site/id?d=...". */
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const route = ROUTES.has(segments[0]) ? segments[0] : 'home';
  const params = new URLSearchParams(queryPart || '');
  const state = { ...DEFAULT_STATE, weights: { ...DEFAULT_STATE.weights } };

  state.route = route;
  if (route === 'site' && segments[1]) state.siteId = decodeURIComponent(segments[1]);

  const d = params.get('d');
  if (d) {
    const parsed = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(d) ? d : `${d}Z`);
    if (Number.isFinite(parsed)) state.dateMs = parsed;
  }

  const n = Number(params.get('n'));
  if (Number.isFinite(n) && n >= 1 && n <= 120) state.stayDays = n;

  const p = params.get('p');
  if (p === 'eng' || p === 'sci' || p === 'all') state.profile = p;

  const w = Number(params.get('w'));
  if (Number.isFinite(w) && w >= 0 && w <= 100) {
    state.weights = { energy: w, comm: 100 - w };
  }

  if (params.get('lg') === 'fr' || params.get('lg') === 'en') state.language = params.get('lg');

  const th = params.get('th');
  if (th) {
    const [sun, night, earth] = th.split(',').map(Number);
    if ([sun, night, earth].every((v) => Number.isFinite(v))) {
      state.seuils = { sunMinPct: sun, maxNightDays: night, earthMinPct: earth };
    }
  }

  const cmp = params.get('cmp');
  if (cmp) state.compare = cmp.split(',').filter(Boolean).slice(0, 3);

  const ref = params.get('ref');
  if (ref) state.referenceId = ref;

  // A free study point is only meaningful on the map, and only when both
  // coordinates are present and inside the usual ranges.
  if ((route === 'map' || route === 'study') && params.has('lat') && params.has('lon')) {
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon)
      && Math.abs(lat) <= 90 && Math.abs(lon) <= 360) {
      state.probe = { lat, lon: ((lon % 360) + 360) % 360 };
    }
  }

  return state;
}

/** Serialise the state back to a hash. Personal data never enters it. */
export function buildHash(state) {
  const params = new URLSearchParams();
  if (state.route === 'site') {
    const iso = new Date(state.dateMs).toISOString().slice(0, 16);
    params.set('d', iso);
    params.set('n', String(state.stayDays));
    params.set('p', state.profile);
  }
  if (state.route === 'compare' || state.route === 'dates') {
    params.set('n', String(state.stayDays));
    if (state.compare && state.compare.length) params.set('cmp', state.compare.join(','));
    if (state.referenceId) params.set('ref', state.referenceId);
  }
  if (state.route === 'dates' || state.route === 'compare') {
    params.set('d', new Date(state.dateMs).toISOString().slice(0, 16));
    params.set('w', String(Math.round(state.weights.energy)));
  }
  if ((state.route === 'map' || state.route === 'study') && state.probe) {
    params.set('lat', state.probe.lat.toFixed(4));
    params.set('lon', state.probe.lon.toFixed(4));
  }
  if (state.seuils) {
    params.set(
      'th',
      [state.seuils.sunMinPct, state.seuils.maxNightDays, state.seuils.earthMinPct].join(','),
    );
  }
  params.set('lg', state.language || document.documentElement.lang || 'fr');

  const path = state.route === 'site' && state.siteId ? `/site/${encodeURIComponent(state.siteId)}` : `/${state.route === 'home' ? '' : state.route}`;
  const query = params.toString();
  return `#${path}${query ? `?${query}` : ''}`;
}

export function readState() {
  return parseHash(window.location.hash);
}

let pending = null;

export function pushState(state, { replace = false } = {}) {
  const hash = buildHash(state);
  if (window.location.hash === hash) return;
  if (replace) window.history.replaceState(null, '', hash);
  else window.history.pushState(null, '', hash);
  pending = state;
}

export function consumePending() {
  const value = pending;
  pending = null;
  return value;
}

/** Stable UTC input value for <input type="datetime-local">. */
export function toUtcInput(ms) {
  return new Date(ms).toISOString().slice(0, 16);
}

export function fromUtcInput(value) {
  if (!value) return null;
  const ms = Date.parse(`${value.length === 16 ? value : value.slice(0, 16)}:00Z`);
  return Number.isFinite(ms) ? ms : null;
}
