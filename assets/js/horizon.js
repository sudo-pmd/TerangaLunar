/**
 * Terrain horizon masks.
 *
 * The reference pipeline derives these masks from LOLA LDEM 80S elevations.
 * No DEM is bundled with this static build, so each site carries a small set of
 * {max, az, rough} parameters and we synthesise a deterministic profile from
 * them. It is an illustrative envelope, not measured topography, and every view
 * that uses it says so.
 */

const STEP_DEG = 0.5;
const N = Math.round(360 / STEP_DEG);

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

/** Deterministic 720-sample horizon profile (degrees of elevation). */
export function horizonProfile(site) {
  if (cache.has(site.id)) return cache.get(site.id);

  const params = site.horizon || { max: 1, az: 0, rough: 0.4 };
  // A site standing on a massif looks DOWN on the surrounding terrain, so the
  // lowest horizon direction is below the horizontal: `floor` can be negative.
  const floor = params.floor ?? 0;
  const peakElevation = params.max ?? 0;
  const rand = mulberry32(hashSeed(site.id));
  const harmonics = [];
  for (let k = 1; k <= 5; k += 1) {
    harmonics.push({ n: k, amp: (0.15 + 0.35 * rand()) / k, phase: rand() * Math.PI * 2 });
  }

  const raw = new Float64Array(N);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < N; i += 1) {
    const az = i * STEP_DEG;
    // Broad massif toward the dominant azimuth, plus ridged harmonics.
    const delta = ((az - params.az + 540) % 360) - 180;
    const lobe = Math.exp(-((delta / 42) ** 2));
    let shape = 0.55 + 0.45 * lobe;
    for (const h of harmonics) {
      shape += params.rough * 0.22 * h.amp * Math.sin((h.n * az * Math.PI) / 180 + h.phase);
    }
    raw[i] = shape;
    if (shape < lo) lo = shape;
    if (shape > hi) hi = shape;
  }

  const values = new Float64Array(N);
  const span = hi - lo || 1;
  for (let i = 0; i < N; i += 1) {
    const t = (raw[i] - lo) / span;
    values[i] = floor + (peakElevation - floor) * t;
  }

  const flat = peakElevation === 0 && floor === 0;
  const profile = { step: STEP_DEG, values, max: peakElevation, min: floor, flat };
  cache.set(site.id, profile);
  return profile;
}

/** Install a measured mask (for example from LOLA LDEM) for one site. */
export function registerHorizon(siteId, profile) {
  cache.set(siteId, profile);
}

/** Linear interpolation of the mask, wrapping across 359.5 -> 0. */
export function horizonAt(profile, az) {
  if (!profile || profile.flat) return 0;
  const f = ((az % 360) + 360) % 360 / profile.step;
  const i0 = Math.floor(f) % N;
  const i1 = (i0 + 1) % N;
  const frac = f - Math.floor(f);
  return profile.values[i0] * (1 - frac) + profile.values[i1] * frac;
}

export { STEP_DEG, N as HORIZON_POINTS };
