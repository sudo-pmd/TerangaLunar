/**
 * Optional precomputed SPICE series.
 *
 * `python pipeline/precompute.py` writes data/precomputed/<site>.json plus an
 * index. When those files exist the app uses them; when they are absent, or do
 * not cover the requested window, everything falls back to the analytical
 * ephemeris in ephemeris.js without an error.
 *
 * Payload contract (see pipeline/precompute.py):
 *   { site, start, stepSeconds, count, scale,
 *     sunAlt[], sunAz[], earthAlt[], earthAz[],
 *     horizon?: { step, values[] }, ephemeris, kernels[] }
 * Angles are integers in 1/scale degrees.
 */

import { registerHorizon } from './horizon.js';

const cache = new Map();
let indexPromise = null;
let index = null;

async function loadIndex() {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    try {
      const response = await fetch('data/precomputed/index.json', { cache: 'no-cache' });
      if (!response.ok) return null;
      index = await response.json();
      return index;
    } catch {
      return null;
    }
  })();
  return indexPromise;
}

/** Decode a payload into typed arrays (also used by the self-test). */
export function decodePrecomputed(payload) {
  const scale = Number(payload.scale) || 100;
  const toF32 = (values) => Float32Array.from(values || [], (value) => value / scale);
  const decoded = {
    siteId: payload.site,
    startMs: Date.parse(payload.start),
    stepMs: (Number(payload.stepSeconds) || 3600) * 1000,
    count: Number(payload.count) || (payload.sunAlt ? payload.sunAlt.length : 0),
    sunAlt: toF32(payload.sunAlt),
    sunAz: toF32(payload.sunAz),
    earthAlt: toF32(payload.earthAlt),
    earthAz: toF32(payload.earthAz),
    ephemeris: payload.ephemeris || 'spice',
    kernels: payload.kernels || [],
  };
  if (!decoded.count || !Number.isFinite(decoded.startMs)) return null;
  if (decoded.sunAlt.length !== decoded.count) return null;

  if (payload.horizon && Array.isArray(payload.horizon.values) && payload.site) {
    const values = Float64Array.from(payload.horizon.values, (value) => value / scale);
    let max = -Infinity;
    let min = Infinity;
    for (const value of values) {
      if (value > max) max = value;
      if (value < min) min = value;
    }
    registerHorizon(payload.site, {
      step: Number(payload.horizon.step) || 0.5,
      values,
      max,
      min,
      flat: values.every((value) => value === 0),
    });
  }
  return decoded;
}

export function installPrecomputed(payload) {
  const decoded = decodePrecomputed(payload);
  if (decoded) cache.set(decoded.siteId, decoded);
  return decoded;
}

/** Fetch and cache one site's series, if the pipeline produced it. */
export async function ensurePrecomputed(siteId) {
  if (!siteId) return null;
  if (cache.has(siteId)) return cache.get(siteId);
  const idx = await loadIndex();
  if (!idx || !Array.isArray(idx.sites)) return null;
  if (!idx.sites.some((entry) => entry.id === siteId)) return null;
  try {
    const response = await fetch(`data/precomputed/${encodeURIComponent(siteId)}.json`, {
      cache: 'no-cache',
    });
    if (!response.ok) return null;
    return installPrecomputed(await response.json());
  } catch {
    return null;
  }
}

/**
 * Exact-window slice of a loaded series, or null when the window is not fully
 * covered (the caller then computes analytically).
 */
export function precomputedSlice(siteId, startMs, count, stepMs) {
  const data = cache.get(siteId);
  if (!data || data.stepMs !== stepMs || data.count < count) return null;
  const offset = Math.round((startMs - data.startMs) / stepMs);
  if (offset < 0 || offset + count > data.count) return null;
  return {
    sunAlt: data.sunAlt.subarray(offset, offset + count),
    sunAz: data.sunAz.subarray(offset, offset + count),
    earthAlt: data.earthAlt.subarray(offset, offset + count),
    earthAz: data.earthAz.subarray(offset, offset + count),
    ephemeris: data.ephemeris,
  };
}

export function precomputedMeta() {
  return index;
}

export function resetPrecomputedCache() {
  cache.clear();
  indexPromise = null;
  index = null;
}
