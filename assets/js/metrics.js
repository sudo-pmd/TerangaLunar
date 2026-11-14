/**
 * Window metrics: sunlit share, longest night, Earth-contact windows, score and
 * best landing dates. Everything is evaluated on the hourly series produced by
 * buildSeries so a change of landing date is a slice, not a re-observation.
 */

import { siteGeometry } from './ephemeris.js';
import { horizonProfile, horizonAt } from './horizon.js';
import { precomputedSlice } from './precomputed.js';

export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;
export const LUNAR_DAY_DAYS = 29.53059;
export const SUN_LIMB_DEG = 0.2666;

const seriesCache = new Map();

/**
 * Hourly (or coarser) geometry series for one site.
 * Visibility is peak-of-disk: the Sun counts as visible when its centre is above
 * the terrain mask plus the solar semi-diameter.
 */
export function buildSeries(site, startMs, count, stepMs = HOUR_MS) {
  const key = `${site.id}|${startMs}|${count}|${stepMs}`;
  const hit = seriesCache.get(key);
  if (hit) return hit;

  const profile = horizonProfile(site);
  const pre = precomputedSlice(site.id, startMs, count, stepMs);
  let sunAlt;
  let sunAz;
  let earthAlt;
  let earthAz;

  if (pre) {
    // Offline SPICE series (pipeline/precompute.py): same geometry, no model drift.
    ({ sunAlt, sunAz, earthAlt, earthAz } = pre);
  } else {
    sunAlt = new Float32Array(count);
    sunAz = new Float32Array(count);
    earthAlt = new Float32Array(count);
    earthAz = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const g = siteGeometry(site, startMs + i * stepMs);
      sunAlt[i] = g.sun.alt;
      sunAz[i] = g.sun.az;
      earthAlt[i] = g.earth.alt;
      earthAz[i] = g.earth.az;
    }
  }

  const sunVis = new Uint8Array(count);
  const earthVis = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    sunVis[i] = sunAlt[i] > horizonAt(profile, sunAz[i]) + SUN_LIMB_DEG ? 1 : 0;
    earthVis[i] = earthAlt[i] > horizonAt(profile, earthAz[i]) ? 1 : 0;
  }

  const series = {
    siteId: site.id,
    startMs,
    stepMs,
    count,
    sunAlt,
    sunAz,
    earthAlt,
    earthAz,
    sunVis,
    earthVis,
    profile,
    ephemeris: pre ? 'spice' : 'analytical',
  };
  if (seriesCache.size > 40) seriesCache.clear();
  seriesCache.set(key, series);
  return series;
}

export function seriesFor(site, startMs, days, stepMs = HOUR_MS) {
  const count = Math.round((days * DAY_MS) / stepMs) + 1;
  return buildSeries(site, startMs, count, stepMs);
}

export function indexToDate(series, i) {
  return new Date(series.startMs + i * series.stepMs);
}

export function dateToIndex(series, date) {
  return Math.round((date.getTime() - series.startMs) / series.stepMs);
}

/**
 * Aggregate a half-open window [i0, i1).
 * `night.startBeforeWindow` flags a night already underway at i0.
 */
export function aggregate(series, i0, i1) {
  const start = Math.max(0, Math.min(i0, series.count - 1));
  const end = Math.max(start + 1, Math.min(i1, series.count));

  let sunLit = 0;
  let earthLit = 0;
  let nightRun = 0;
  let bestNight = 0;
  let bestNightStart = start;
  let nightOngoingStart = -1;
  let firstSampleNight = series.sunVis[start] === 0;

  const windows = [];
  let openStart = -1;
  let grazing = 0;
  for (let i = start; i < end; i += 1) {
    if (series.sunAlt[i] > 0 && series.sunAlt[i] < 5) grazing += 1;
    if (series.sunVis[i]) sunLit += 1;
    if (series.earthVis[i]) {
      earthLit += 1;
      if (openStart < 0) openStart = i;
    } else if (openStart >= 0) {
      windows.push(openStart, i);
      openStart = -1;
    }

    if (!series.sunVis[i]) {
      if (nightOngoingStart < 0) nightOngoingStart = i;
      nightRun += 1;
      if (nightRun > bestNight) {
        bestNight = nightRun;
        bestNightStart = i - nightRun + 1;
      }
    } else {
      nightOngoingStart = -1;
      nightRun = 0;
    }
  }
  if (openStart >= 0) windows.push(openStart, end);

  const total = end - start;
  const stepH = series.stepMs / HOUR_MS;
  const earthWindows = [];
  for (let k = 0; k < windows.length; k += 2) {
    const wStart = windows[k];
    const wEnd = windows[k + 1];
    earthWindows.push({
      startMs: series.startMs + wStart * series.stepMs,
      endMs: series.startMs + wEnd * series.stepMs,
      hours: (wEnd - wStart) * stepH,
      openEnd: wEnd === end,
    });
  }

  return {
    startMs: series.startMs + start * series.stepMs,
    endMs: series.startMs + end * series.stepMs,
    hours: total * stepH,
    sunPct: (sunLit / total) * 100,
    earthPct: (earthLit / total) * 100,
    maxNightHours: bestNight * stepH,
    nightStartMs: series.startMs + bestNightStart * series.stepMs,
    nightEndMs: series.startMs + (bestNightStart + bestNight) * series.stepMs,
    nightTruncated: firstSampleNight && bestNight > 0,
    earthWindows,
    grazingHours: grazing * stepH,
  };
}

export function score(metrics, weights = { energy: 60, comm: 40 }) {
  const total = weights.energy + weights.comm || 1;
  return (metrics.sunPct * weights.energy + metrics.earthPct * weights.comm) / total;
}

export function verdicts(metrics, seuils) {
  return [
    {
      key: 'sun',
      value: metrics.sunPct,
      threshold: seuils.sunMinPct,
      unit: 'pct',
      ok: metrics.sunPct >= seuils.sunMinPct,
    },
    {
      key: 'night',
      value: metrics.maxNightHours / 24,
      threshold: seuils.maxNightDays,
      unit: 'days',
      ok: metrics.maxNightHours / 24 <= seuils.maxNightDays + 1e-9,
    },
    {
      key: 'earth',
      value: metrics.earthPct,
      threshold: seuils.earthMinPct,
      unit: 'pct',
      ok: metrics.earthPct >= seuils.earthMinPct,
    },
  ];
}

export function shiftDate(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Clamp a stay window to the computed series; returns null when impossible. */
export function stayRange(series, startDate, days) {
  const i0 = Math.max(0, dateToIndex(series, startDate));
  const i1 = Math.min(series.count, i0 + Math.round((days * DAY_MS) / series.stepMs));
  if (i0 >= series.count - 1) return null;
  return { i0, i1, clamped: i1 - i0 < Math.round((days * DAY_MS) / series.stepMs) };
}

/**
 * Score every possible landing date in a one-year window using prefix sums for
 * the solar and Earth shares; the night scan stays linear per candidate.
 */
export function bestDates(site, stayDays, weights, yearStartMs) {
  const step = HOUR_MS;
  const count = 366 * 24 + 1;
  const series = buildSeries(site, yearStartMs, count, step);
  const staySamples = Math.round((stayDays * DAY_MS) / step);

  const sunPrefix = new Float64Array(count + 1);
  const earthPrefix = new Float64Array(count + 1);
  for (let i = 0; i < count; i += 1) {
    sunPrefix[i + 1] = sunPrefix[i] + series.sunVis[i];
    earthPrefix[i + 1] = earthPrefix[i] + series.earthVis[i];
  }

  const results = [];
  for (let day = 0; day < 365; day += 1) {
    const i0 = day * 24;
    const i1 = Math.min(count, i0 + staySamples);
    if (i1 - i0 < staySamples) break;
    const span = i1 - i0;
    const sunPct = ((sunPrefix[i1] - sunPrefix[i0]) / span) * 100;
    const earthPct = ((earthPrefix[i1] - earthPrefix[i0]) / span) * 100;

    let run = 0;
    let night = 0;
    for (let i = i0; i < i1; i += 1) {
      if (series.sunVis[i]) run = 0;
      else {
        run += 1;
        if (run > night) night = run;
      }
    }
    const metrics = { sunPct, earthPct, maxNightHours: night };
    results.push({
      startMs: yearStartMs + i0 * step,
      sunPct,
      earthPct,
      maxNightHours: night,
      score: score(metrics, weights),
    });
  }

  const ranked = [...results].sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  return { series, results, top: ranked.slice(0, 5), ranked };
}

export function rankSites(sites, startMs, days, weights, buildFor) {
  return sites
    .map((site) => {
      const series = buildFor(site, startMs, days);
      const m = aggregate(series, 0, series.count);
      return { site, metrics: m, score: score(m, weights) };
    })
    .sort((a, b) => b.score - a.score || a.site.id.localeCompare(b.site.id));
}

/** Longest continuous run of shadow inside a window, in samples. */
export function longestNightSamples(sunVis, i0, i1) {
  let run = 0;
  let best = 0;
  for (let i = i0; i < i1; i += 1) {
    if (sunVis[i]) run = 0;
    else {
      run += 1;
      if (run > best) best = run;
    }
  }
  return best;
}
