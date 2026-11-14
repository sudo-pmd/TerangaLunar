/**
 * Configuration loading with runtime validation. Adding a site, source or
 * scenario means editing JSON only: no component knows a site id in advance.
 */

const REQUIRED_SITE_FIELDS = ['id', 'mission', 'company', 'name', 'lat', 'lon', 'status', 'type'];

const cache = new Map();

async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  const data = await response.json();
  cache.set(path, data);
  return data;
}

function requireFields(record, fields, context) {
  const missing = fields.filter((field) => record[field] === undefined || record[field] === null);
  if (missing.length) {
    throw new Error(`${context}: champ(s) manquant(s) — ${missing.join(', ')}`);
  }
}

export function validateConfig({ sites, sources, seuils }) {
  if (!sites || !Array.isArray(sites.sites) || sites.sites.length === 0) {
    throw new Error('sites.json: la liste "sites" est vide ou absente');
  }
  const seen = new Set();
  sites.sites.forEach((site, index) => {
    requireFields(site, REQUIRED_SITE_FIELDS, `sites.json[${index}]`);
    if (seen.has(site.id)) throw new Error(`sites.json: identifiant dupliqué "${site.id}"`);
    seen.add(site.id);
    if (site.lat < -90 || site.lat > 90) throw new Error(`sites.json: latitude invalide pour "${site.id}"`);
    if (site.lon < -180 || site.lon > 180) throw new Error(`sites.json: longitude invalide pour "${site.id}"`);
    if (site.horizon && (site.horizon.max < 0 || site.horizon.max > 45)) {
      throw new Error(`sites.json: horizon hors bornes pour "${site.id}"`);
    }
  });

  if (!sources || !Array.isArray(sources.sources) || sources.sources.length === 0) {
    throw new Error('sources.json: la liste "sources" est vide ou absente');
  }
  sources.sources.forEach((source, index) => {
    requireFields(source, ['id', 'title', 'version', 'url', 'license', 'consulted'], `sources.json[${index}]`);
  });

  requireFields(
    seuils,
    ['sunMinPct', 'maxNightDays', 'earthMinPct'],
    'seuils.json',
  );
  return true;
}

export async function loadConfig() {
  const [sites, sources, seuils, scenarios, glossaire, terrain] = await Promise.all([
    loadJson('data/sites.json'),
    loadJson('data/sources.json'),
    loadJson('data/seuils.json'),
    loadJson('data/scenarios.json'),
    loadJson('data/glossaire.json'),
    // Measured terrain is optional: without it every site keeps the analytic
    // envelope from sites.json, and the interface says so.
    loadJson('data/terrain.json').catch(() => null),
  ]);
  validateConfig({ sites, sources, seuils });
  const byId = new Map(sites.sites.map((site) => [site.id, site]));
  return {
    sites: sites.sites, meta: sites, sources: sources.sources, seuils,
    scenarios, glossaire, terrain, byId,
  };
}

export function getSite(config, id) {
  return config.byId.get(id) || null;
}
