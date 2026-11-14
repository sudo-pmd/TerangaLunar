/**
 * Optional Python calculation service.
 *
 * `backend/app.py` exposes the same quantities as the in-browser model, computed
 * with SpiceyPy and the official JPL kernels. When it is not running — which is
 * always the case for the static site — every call resolves to null and the
 * caller keeps its local result. No error is ever surfaced to the visitor.
 */

const TIMEOUT_MS = 1600;
const BASE = '';

function withTimeout(ms = TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

let health = null;

/** Ping once per session: resolves to the service description or null. */
export async function probeBackend({ recheck = false } = {}) {
  if (health !== null && !recheck) return health;
  try {
    const response = await fetch(`${BASE}/api/health`, {
      signal: withTimeout(),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      health = { online: false };
      return health;
    }
    const body = await response.json();
    health = { online: true, ...body };
  } catch {
    health = { online: false };
  }
  return health;
}

/**
 * Subsolar point and per-site illumination from the service, or null when the
 * service is absent or slower than the local model is worth waiting for.
 */
export async function fetchSubsolar(ms) {
  const status = await probeBackend();
  if (!status?.online) return null;
  try {
    const iso = new Date(ms).toISOString();
    const response = await fetch(`${BASE}/api/subsolar?t=${encodeURIComponent(iso)}`, {
      signal: withTimeout(),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number') return null;
    return body;
  } catch {
    return null;
  }
}
