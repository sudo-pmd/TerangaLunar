/**
 * Automated astronomical self-checks (node scripts/selftest.mjs).
 *
 * These assertions guard the claims the interface makes: the south pole is
 * lit only by grazing sunlight, Earth hovers near the polar horizon, the
 * equatorial cycle is one lunar day, and the lunar series reproduces the
 * Moon's phase.
 */

import { siteGeometry, moonEcliptic, sunEcliptic, toJD, norm180 } from '../assets/js/ephemeris.js';
import { horizonProfile, horizonAt } from '../assets/js/horizon.js';
import { buildSeries, aggregate, bestDates, seriesFor, HOUR_MS } from '../assets/js/metrics.js';

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const pole = { id: 'ref_pole', lat: -89.9, lon: 0, horizon: { max: 0 } };
const equator = { id: 'ref_equator', lat: 0, lon: 0, horizon: { max: 0 } };

section('1. Lunar phase series (new moon 2024-04-08 18:21 UTC)');
{
  const jd = toJD(Date.parse('2024-04-08T18:21:00Z'));
  const m = moonEcliptic(jd);
  const s = sunEcliptic(jd);
  const elong = Math.abs(norm180(m.lon - s.lon));
  check('elongation at new moon < 0.5 deg', elong < 0.5, `${elong.toFixed(2)} deg`);
  const jd2 = toJD(Date.parse('2024-04-23T23:49:00Z'));
  const m2 = moonEcliptic(jd2);
  const s2 = sunEcliptic(jd2);
  const elong2 = Math.abs(norm180(m2.lon - s2.lon));
  check('elongation at full moon near 180 deg', Math.abs(elong2 - 180) < 1.0, `${elong2.toFixed(2)} deg`);
}

section('2. Lunar rotation: sub-Earth point stays near the centre of the disc');
{
  let maxLon = 0;
  let maxLat = 0;
  for (let d = 0; d < 800; d += 1) {
    const g = siteGeometry(pole, Date.parse('2026-01-01T00:00:00Z') + d * 12 * HOUR_MS);
    maxLon = Math.max(maxLon, Math.abs(g.subEarth.lon > 180 ? g.subEarth.lon - 360 : g.subEarth.lon));
    maxLat = Math.max(maxLat, Math.abs(g.subEarth.lat));
  }
  check('|libration in longitude| <= 8.3 deg', maxLon <= 8.3, `${maxLon.toFixed(2)} deg`);
  check('|libration in latitude| <= 7.2 deg', maxLat <= 7.2, `${maxLat.toFixed(2)} deg`);
  check('libration is not degenerate (> 3 deg)', maxLon > 3 && maxLat > 3, `${maxLon.toFixed(1)}/${maxLat.toFixed(1)}`);
}

section('3. South pole without terrain');
{
  const start = Date.parse('2026-01-01T00:00:00Z');
  const series = buildSeries(pole, start, 366 * 24, HOUR_MS);
  let maxSun = -99;
  let maxEarth = -99;
  let minEarth = 99;
  for (let i = 0; i < series.count; i += 1) {
    maxSun = Math.max(maxSun, series.sunAlt[i]);
    maxEarth = Math.max(maxEarth, series.earthAlt[i]);
    minEarth = Math.min(minEarth, series.earthAlt[i]);
  }
  check('max Sun elevation <= 1.7 deg', maxSun <= 1.7, `${maxSun.toFixed(2)} deg`);
  check('Earth stays within +/- 9 deg of the horizon', maxEarth <= 9 && minEarth >= -9, `${minEarth.toFixed(1)}..${maxEarth.toFixed(1)} deg`);
  check('polar day/night alternates (not always lit)', series.sunVis.some((v) => v === 0) && series.sunVis.some((v) => v === 1));
}

section('4. Equator');
{
  const start = Date.parse('2026-01-01T00:00:00Z');
  const series = buildSeries(equator, start, 60 * 24, HOUR_MS);
  let maxSun = -99;
  for (let i = 0; i < series.count; i += 1) maxSun = Math.max(maxSun, series.sunAlt[i]);
  check('Sun climbs above 80 deg', maxSun > 80, `${maxSun.toFixed(1)} deg`);
  const m = aggregate(series, 0, series.count);
  check('uninterrupted night lasts half a lunar day', Math.abs(m.maxNightHours - 354) < 30, `${(m.maxNightHours / 24).toFixed(1)} days`);
  check('a 14-day stay cannot exceed a full lunar night', m.maxNightHours <= 29.6 * 24);
}

section('5. Azimuth convention (N=0, E=90)');
{
  const g = siteGeometry(equator, Date.parse('2026-01-01T00:00:00Z'));
  check('azimuth in [0, 360)', g.sun.az >= 0 && g.sun.az < 360, `${g.sun.az.toFixed(1)} deg`);
  check('elevation in [-90, 90]', g.sun.alt >= -90 && g.sun.alt <= 90, `${g.sun.alt.toFixed(1)} deg`);
  check('Earth distance near 384000 km', Math.abs(g.earth.dist - 384400) < 30000, `${Math.round(g.earth.dist)} km`);
}

section('6. Terrain masks');
{
  const synthetic = { id: 'test_flat', lat: -80, lon: 0, horizon: { max: 0, az: 0, rough: 0 } };
  const flat = horizonProfile(synthetic);
  let maxAbs = 0;
  for (let az = 0; az < 360; az += 1) maxAbs = Math.max(maxAbs, horizonAt(flat, az));
  check('flat site mask is 0 everywhere', maxAbs === 0, `${maxAbs}`);

  const bumpy = { id: 'malapert_a', lat: -80.13, lon: 1.44, horizon: { max: 6.4, az: 205, rough: 0.62 } };
  const p = horizonProfile(bumpy);
  let peak = 0;
  for (let az = 0; az < 360; az += 0.5) peak = Math.max(peak, horizonAt(p, az));
  check('mask peak matches declared maximum', Math.abs(peak - 6.4) < 0.2, `${peak.toFixed(2)} deg`);
  check('mask wraps smoothly at 0/360', Math.abs(horizonAt(p, 359.9) - horizonAt(p, 0.1)) < 1.0);
}

section('7. Metrics and best dates');
{
  const start = Date.parse('2026-02-01T00:00:00Z');
  const series = seriesFor(pole, start, 14);
  const m = aggregate(series, 0, series.count);
  check('sunlit share within 0..100', m.sunPct >= 0 && m.sunPct <= 100, `${m.sunPct.toFixed(1)} %`);
  check('earth share within 0..100', m.earthPct >= 0 && m.earthPct <= 100, `${m.earthPct.toFixed(1)} %`);
  check('night cannot exceed the window', m.maxNightHours <= m.hours, `${m.maxNightHours} h`);

  const t0 = Date.now();
  const bd = bestDates(pole, 14, { energy: 60, comm: 40 }, Date.parse('2026-01-01T00:00:00Z'));
  const elapsed = Date.now() - t0;
  check('best date scores are non-increasing', bd.top.every((r, i) => i === 0 || bd.top[i - 1].score >= r.score));
  check('best score is the maximum of all candidates', Math.abs(bd.top[0].score - Math.max(...bd.results.map((r) => r.score))) < 1e-9);
  console.log(`       best-dates sweep: ${bd.results.length} dates in ${elapsed} ms`);
  check('year sweep stays under 8 s', elapsed < 8000, `${elapsed} ms`);
}

section('8. Terrain must not increase sunlight');
{
  const site = { id: 'malapert_a', lat: -80.13, lon: 1.44, horizon: { max: 6.4, az: 205, rough: 0.62 } };
  const start = Date.parse('2026-03-01T00:00:00Z');
  const withTerrain = aggregate(seriesFor(site, start, 30), 0, 721);
  const flat = { ...site, id: 'ref_pole_alt', horizon: { max: 0 } };
  const flatSeries = seriesFor(flat, start, 30);
  const withoutTerrain = aggregate(flatSeries, 0, flatSeries.count);
  check('sunlit share with relief <= without relief', withTerrain.sunPct <= withoutTerrain.sunPct + 1e-9,
    `${withTerrain.sunPct.toFixed(1)} % vs ${withoutTerrain.sunPct.toFixed(1)} %`);
}

section('9. Configuration');
{
  const fs = await import('node:fs/promises');
  const raw = JSON.parse(await fs.readFile(new URL('../data/sites.json', import.meta.url), 'utf8'));
  const { validateConfig } = await import('../assets/js/data.js');
  const sources = JSON.parse(await fs.readFile(new URL('../data/sources.json', import.meta.url), 'utf8'));
  const seuils = JSON.parse(await fs.readFile(new URL('../data/seuils.json', import.meta.url), 'utf8'));

  let ok = true;
  try {
    validateConfig({ sites: raw, sources, seuils });
  } catch (error) {
    ok = false;
    console.log(`       ${error.message}`);
  }
  check('shipped configuration validates', ok, `${raw.sites.length} sites`);

  const broken = structuredClone(raw);
  delete broken.sites[0].lat;
  let message = '';
  try {
    validateConfig({ sites: broken, sources, seuils });
  } catch (error) {
    message = error.message;
  }
  check('a missing field raises a readable error', message.includes('lat'), message.slice(0, 60));

  const dup = structuredClone(raw);
  dup.sites[1].id = dup.sites[0].id;
  let dupMessage = '';
  try {
    validateConfig({ sites: dup, sources, seuils });
  } catch (error) {
    dupMessage = error.message;
  }
  check('duplicate ids are rejected', dupMessage.includes('dupliqué'), dupMessage.slice(0, 60));
}

section('10. Precomputed SPICE series contract');
{
  const {
    decodePrecomputed, installPrecomputed, precomputedSlice, resetPrecomputedCache,
  } = await import('../assets/js/precomputed.js');

  const site = { id: 'fixture_site', lat: -84.0, lon: 20.0, horizon: { max: 0 } };
  const startMs = Date.UTC(2026, 0, 1);
  const count = 48;
  const scale = 100;
  const rows = { sunAlt: [], sunAz: [], earthAlt: [], earthAz: [] };
  for (let i = 0; i < count; i += 1) {
    const g = siteGeometry(site, startMs + i * HOUR_MS);
    rows.sunAlt.push(Math.round(g.sun.alt * scale));
    rows.sunAz.push(Math.round(g.sun.az * scale));
    rows.earthAlt.push(Math.round(g.earth.alt * scale));
    rows.earthAz.push(Math.round(g.earth.az * scale));
  }

  const payload = {
    site: site.id,
    start: new Date(startMs).toISOString(),
    stepSeconds: 3600,
    count,
    scale,
    ephemeris: 'spice-de440s',
    ...rows,
  };

  const decoded = decodePrecomputed(payload);
  check('payload decodes to the declared grid', decoded.startMs === startMs && decoded.count === count && decoded.stepMs === HOUR_MS);
  check('hundredths decode back to degrees', Math.abs(decoded.sunAlt[0] - rows.sunAlt[0] / scale) < 1e-6);

  const slice = precomputedSlice(site.id, startMs, count, HOUR_MS);
  check('nothing is served before installation', slice === null);

  resetPrecomputedCache();
  installPrecomputed(payload);
  const served = precomputedSlice(site.id, startMs, count, HOUR_MS);
  check('installed series is served for an exact window', served !== null && served.ephemeris === 'spice-de440s');
  check('an uncovered window is refused (fallback path)', precomputedSlice(site.id, startMs + 10 * 86400000, 24, HOUR_MS) === null);

  const withPre = buildSeries(site, startMs, count, HOUR_MS);
  check('buildSeries reports the SPICE source', withPre.ephemeris === 'spice');
  const maxDelta = Math.max(...rows.sunAlt.map((value, i) => Math.abs(withPre.sunAlt[i] - value / scale)));
  check('served altitudes match the payload', maxDelta < 0.005, `${maxDelta.toFixed(4)} deg`);

  const fallback = buildSeries(site, startMs + 10 * 86400000, 24, HOUR_MS);
  check('uncovered windows fall back to the analytical model', fallback.ephemeris === 'analytical');

  resetPrecomputedCache();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
