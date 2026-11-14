import type { Metrics, Run, SiteData, Visibility } from './types'
import { computeVisibility } from './data'

const DAY_MS = 86400000

// ---- temps ---------------------------------------------------------------------------------
export const dateToIndex = (d: SiteData, ms: number) => Math.round((ms - d.startMs) / (d.stepS * 1000))
export const indexToMs = (d: SiteData, i: number) => d.startMs + i * d.stepS * 1000
export const endMs = (d: SiteData) => indexToMs(d, d.n - 1)
export const stepsPerDay = (d: SiteData) => Math.round(86400 / d.stepS)

/** Durée d'un séjour en heures (F-50). « jour lunaire complet » = 29,53 j. */
export const LUNAR_DAY_DAYS = 29.53
export const daysToHours = (days: number) => Math.round(days * 24)

/** Fenêtre [i0, i1) du séjour à partir de la date d'atterrissage (F-50), tronquée à la plage calculée. */
export function stayRange(d: SiteData, landingMs: number, days: number) {
  const i0 = Math.min(Math.max(dateToIndex(d, landingMs), 0), d.n - 1)
  const len = Math.max(1, Math.round((days * 24) / d.stepH))
  const i1 = Math.min(i0 + len, d.n)
  return { i0, i1, truncated: i0 + len > d.n }
}

/** Décalage de date en un clic (F-51), borné à la plage calculée. */
export function shiftDate(d: SiteData, landingMs: number, deltaDays: number, days = 0) {
  const wanted = landingMs + deltaDays * DAY_MS
  const lo = d.startMs
  const hi = endMs(d) - Math.max(0, days * DAY_MS - d.stepS * 1000) // séjour complet si possible
  const ms = Math.min(Math.max(wanted, lo), Math.max(hi, lo))
  return { ms, clamped: ms !== wanted }
}

// ---- séries et indicateurs -----------------------------------------------------------------
export function runs(vis: Uint8Array, i0: number, i1: number, value: 0 | 1, stepH: number): Run[] {
  const out: Run[] = []
  let s = -1
  for (let i = i0; i <= i1; i++) {
    const on = i < i1 && vis[i] === value
    if (on && s < 0) s = i
    else if (!on && s >= 0) {
      out.push({ start: s, end: i, hours: (i - s) * stepH })
      s = -1
    }
  }
  return out
}

const longest = (r: Run[]): Run | null => r.reduce<Run | null>((b, x) => (!b || x.hours > b.hours ? x : b), null)

export const scoreOf = (sunFrac: number, earthFrac: number, wEnergy: number) =>
  (wEnergy / 100) * sunFrac * 100 + (1 - wEnergy / 100) * earthFrac * 100

/** Part ensoleillée (F-20), plus longue nuit (F-21), fenêtres Terre (F-22), note (F-23) sur [i0, i1). */
export function computeMetrics(d: SiteData, v: Visibility, i0: number, i1: number, wEnergy = 60): Metrics {
  const len = Math.max(1, i1 - i0)
  const sunFrac = (v.sunCum[i1] - v.sunCum[i0]) / len
  const earthFrac = (v.earthCum[i1] - v.earthCum[i0]) / len
  const nights = runs(v.sun, i0, i1, 0, d.stepH)
  const ln = longest(nights)
  const earthWindows = runs(v.earth, i0, i1, 1, d.stepH)
  return {
    i0, i1, hours: len * d.stepH, sunFrac, earthFrac,
    longestNight: ln && {
      ...ln,
      startedBefore: ln.start === i0 && i0 > 0 && v.sun[i0 - 1] === 0,
      endsAfter: ln.end === i1 && i1 < d.n && v.sun[i1] === 0,
    },
    earthWindows,
    longestEarth: longest(earthWindows),
    score: scoreOf(sunFrac, earthFrac, wEnergy),
  }
}

export interface Bucket { startMs: number; hours: number; sunHours: number; frac: number }

/** Part ensoleillée par jour (UTC) ou par mois (UTC) sur [i0, i1). */
export function sunSeries(d: SiteData, v: Visibility, i0: number, i1: number, by: 'day' | 'month'): Bucket[] {
  const out: Bucket[] = []
  let key = NaN
  let cur: Bucket | null = null
  for (let i = i0; i < i1; i++) {
    const ms = indexToMs(d, i)
    const dt = new Date(ms)
    const k = by === 'day' ? Math.floor(ms / DAY_MS) : dt.getUTCFullYear() * 12 + dt.getUTCMonth()
    if (k !== key) {
      const startMs = by === 'day' ? k * DAY_MS : Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)
      cur = { startMs, hours: 0, sunHours: 0, frac: 0 }
      out.push(cur)
      key = k
    }
    cur!.hours += d.stepH
    cur!.sunHours += v.sun[i] * d.stepH
  }
  for (const b of out) b.frac = b.hours ? b.sunHours / b.hours : 0
  return out
}

// ---- seuils (F-54) ------------------------------------------------------------------------
import type { Thresholds } from './types'

export interface Verdict {
  key: 'sun' | 'night' | 'earth'
  value: number
  threshold: number
  ok: boolean
}

/** Un seuil est « respecté » si le chiffre le satisfait sur toute la durée du séjour. */
export function thresholdVerdicts(m: Metrics, t: Thresholds): Verdict[] {
  const nightH = m.longestNight?.hours ?? 0
  const earthH = m.longestEarth?.hours ?? 0
  return [
    { key: 'sun', value: m.sunFrac * 100, threshold: t.ensoleillement_min, ok: m.sunFrac * 100 >= t.ensoleillement_min },
    { key: 'night', value: nightH / 24, threshold: t.nuit_max_jours, ok: nightH / 24 < t.nuit_max_jours },
    { key: 'earth', value: earthH, threshold: t.fenetre_terre_min_heures, ok: earthH >= t.fenetre_terre_min_heures },
  ]
}

export const allRespected = (v: Verdict[]) => v.every((x) => x.ok)

// ---- comparaison (F-53) -------------------------------------------------------------------
export interface Deltas { sunPct: number; earthPct: number; nightH: number; earthH: number; score: number; windows: number }

export const metricValues = (m: Metrics) => ({
  sunPct: m.sunFrac * 100,
  earthPct: m.earthFrac * 100,
  nightH: m.longestNight?.hours ?? 0,
  earthH: m.longestEarth?.hours ?? 0,
  score: m.score,
  windows: m.earthWindows.length,
})

/** Écart = valeur du plan alternatif − valeur du plan de référence (signe conservé). */
export function comparePlans(ref: Metrics, alt: Metrics): Deltas {
  const a = metricValues(ref), b = metricValues(alt)
  return {
    sunPct: b.sunPct - a.sunPct, earthPct: b.earthPct - a.earthPct, nightH: b.nightH - a.nightH,
    earthH: b.earthH - a.earthH, score: b.score - a.score, windows: b.windows - a.windows,
  }
}

// ---- meilleures dates (F-52) --------------------------------------------------------------
export interface DateScore { idx: number; ms: number; score: number; sunFrac: number; earthFrac: number }

/** Fait glisser une fenêtre de la durée du séjour : une date de départ par jour, à la même
 *  heure que l'atterrissage choisi. Tout vient des sommes cumulées déjà calculées. */
export function scoreAllDates(d: SiteData, v: Visibility, landingMs: number, days: number, wEnergy: number): DateScore[] {
  const len = Math.max(1, Math.round((days * 24) / d.stepH))
  const spd = stepsPerDay(d)
  const phase = ((dateToIndex(d, landingMs) % spd) + spd) % spd
  const out: DateScore[] = []
  for (let i0 = phase; i0 + len <= d.n; i0 += spd) {
    const sunFrac = (v.sunCum[i0 + len] - v.sunCum[i0]) / len
    const earthFrac = (v.earthCum[i0 + len] - v.earthCum[i0]) / len
    out.push({ idx: i0, ms: indexToMs(d, i0), score: scoreOf(sunFrac, earthFrac, wEnergy), sunFrac, earthFrac })
  }
  return out
}

/** Cinq meilleures dates ; ex æquo départagés par la date la plus proche du début (ordre stable). */
export function topDates(scores: DateScore[], k = 5): DateScore[] {
  return [...scores].sort((a, b) => b.score - a.score || a.idx - b.idx).slice(0, k)
}

// ---- classement des sites (F-32, F-55) ----------------------------------------------------
export interface Ranked { site: string; metrics: Metrics }

export function rankSites(items: { site: string; data: SiteData }[], landingMs: number, days: number, wEnergy: number, limb: boolean): Ranked[] {
  return items
    .map(({ site, data }) => {
      const v = computeVisibility(data, limb)
      const { i0, i1 } = stayRange(data, landingMs, days)
      return { site, metrics: computeMetrics(data, v, i0, i1, wEnergy) }
    })
    .sort((a, b) => b.metrics.score - a.metrics.score || a.site.localeCompare(b.site))
}

// ---- lecture « Science » (F-60) -----------------------------------------------------------
export function scienceView(d: SiteData, v: Visibility, idx: number, i0: number, i1: number) {
  let grazing = 0
  for (let i = i0; i < i1; i++) if (v.sun[i] && d.sunEl[i] < 5) grazing += d.stepH
  const az = d.sunAz[idx]
  return {
    sunEl: d.sunEl[idx], sunAz: az, shadowAz: (az + 180) % 360, sunVisible: !!v.sun[idx],
    grazingHours: grazing, stayHours: (i1 - i0) * d.stepH,
  }
}
