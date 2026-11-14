import { describe, expect, it } from 'vitest'
import { computeVisibility, makeSiteData, maskAt, validateSites } from './data'
import {
  allRespected, comparePlans, computeMetrics, runs, scoreAllDates, shiftDate, stayRange, sunSeries,
  thresholdVerdicts, topDates,
} from './metrics'
import { fromIso, parseView, serializeView, toIso, type Defaults } from './urlState'

/** n heures ; pattern(i) = 1 si le Soleil est visible (élévation +1°, sinon −1°). */
const build = (n: number, pattern: (i: number) => number, earth: (i: number) => number = () => 1, mask?: number[]) =>
  makeSiteData({
    sunEl: Array.from({ length: n }, (_, i) => (pattern(i) ? 1 : -1)),
    earthEl: Array.from({ length: n }, (_, i) => (earth(i) ? 1 : -1)),
    mask,
  })

describe('indicateurs', () => {
  it('part ensoleillée : tout, rien, moitié', () => {
    for (const [f, exp] of [[() => 1, 1], [() => 0, 0], [(i: number) => (i % 24 < 12 ? 1 : 0), 0.5]] as const) {
      const d = build(240, f)
      const m = computeMetrics(d, computeVisibility(d, false), 0, 240)
      expect(m.sunFrac).toBeCloseTo(exp, 10)
    }
  })

  it('calcul à la main sur une journée (24 valeurs)', () => {
    const hours = [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0] // 16 h de soleil
    const d = build(24, (i) => hours[i])
    const m = computeMetrics(d, computeVisibility(d, false), 0, 24)
    expect(m.sunFrac).toBeCloseTo(16 / 24, 10)
    expect(sunSeries(d, computeVisibility(d, false), 0, 24, 'day')[0].frac).toBeCloseTo(16 / 24, 10)
  })

  it('plus longue nuit : série connue', () => {
    // 5 nuit, 3 jour, 9 nuit, 2 jour, 4 nuit
    const seq = [...Array(5).fill(0), ...Array(3).fill(1), ...Array(9).fill(0), ...Array(2).fill(1), ...Array(4).fill(0)]
    const d = build(seq.length, (i) => seq[i])
    const m = computeMetrics(d, computeVisibility(d, false), 0, seq.length)
    expect(m.longestNight).toMatchObject({ start: 8, end: 17, hours: 9 })
  })

  it('nuit commencée avant la fenêtre : signalée et tronquée', () => {
    const d = build(100, (i) => (i < 40 || i > 60 ? 0 : 1))
    const m = computeMetrics(d, computeVisibility(d, false), 20, 100)
    expect(m.longestNight?.start).toBe(61)
    const m2 = computeMetrics(d, computeVisibility(d, false), 0, 30)
    expect(m2.longestNight).toMatchObject({ hours: 30, startedBefore: false, endsAfter: true })
  })

  it('fenêtres de visibilité de la Terre : deux fenêtres distinctes', () => {
    const e = [0, 1, 1, 0, 0, 1, 1, 1, 0]
    const d = build(e.length, () => 1, (i) => e[i])
    const m = computeMetrics(d, computeVisibility(d, false), 0, e.length)
    expect(m.earthWindows.map((w) => w.hours)).toEqual([2, 3])
    expect(m.longestEarth?.hours).toBe(3)
  })

  it('runs gère les bords', () => {
    expect(runs(Uint8Array.from([1, 1, 0, 1]), 0, 4, 1, 1)).toHaveLength(2)
  })
})

describe('relief et bord du Soleil', () => {
  it('le relief réduit la part ensoleillée, jamais ne l\'augmente', () => {
    const n = 240
    const flat = build(n, (i) => (i % 24 < 12 ? 1 : 0))
    const hilly = makeSiteData({ sunEl: flat.sunEl, mask: new Array(720).fill(2) })
    const a = computeMetrics(flat, computeVisibility(flat, false), 0, n).sunFrac
    const b = computeMetrics(hilly, computeVisibility(hilly, false), 0, n).sunFrac
    expect(b).toBeLessThanOrEqual(a)
  })
  it('bord supérieur : visible dès el + 0,27° > masque', () => {
    const d = makeSiteData({ sunEl: [-0.2, -0.3], mask: new Array(720).fill(0) })
    expect(Array.from(computeVisibility(d, false).sun)).toEqual([0, 0])
    expect(Array.from(computeVisibility(d, true).sun)).toEqual([1, 0])
  })
  it('masque interpolé et raccord 359,5 -> 0', () => {
    const mask = new Float32Array(720).fill(0)
    mask[719] = 10
    mask[0] = 20
    expect(maskAt(mask, 359.75)).toBeCloseTo(15, 5)
    expect(maskAt(mask, 0)).toBeCloseTo(20, 5)
  })
})

describe('séjour, décalage, seuils, comparaison', () => {
  const n = 24 * 60
  const d = build(n, (i) => (i % 100 < 30 ? 1 : 0))
  const v = computeVisibility(d, false)
  const t0 = d.startMs + 20 * 86400000

  it('séjour de 14 jours : fenêtre de 336 h et chiffres différents de la période complète', () => {
    const { i0, i1 } = stayRange(d, t0, 14)
    expect(i1 - i0).toBe(336)
    expect(computeMetrics(d, v, i0, i1).hours).toBe(336)
    const full = computeMetrics(d, v, 0, n)
    const stay = computeMetrics(d, v, i0, i1)
    expect(stay.sunFrac).not.toBeCloseTo(full.sunFrac, 6)
  })

  it('décalage −7, −1, +1, +7 et butées', () => {
    for (const k of [-7, -1, 1, 7]) expect(shiftDate(d, t0, k).ms).toBe(t0 + k * 86400000)
    expect(shiftDate(d, d.startMs, -7)).toMatchObject({ ms: d.startMs, clamped: true })
    expect(shiftDate(d, d.startMs + (n - 1) * 3600000, 7).clamped).toBe(true)
  })

  it('seuils : nuit trop longue -> non respecté', () => {
    const { i0, i1 } = stayRange(d, t0, 14)
    const m = computeMetrics(d, v, i0, i1)
    const ok = thresholdVerdicts(m, { ensoleillement_min: 10, nuit_max_jours: 3, fenetre_terre_min_heures: 24 })
    expect(ok.find((x) => x.key === 'night')!.ok).toBe(true) // nuits de 70 h < 3 j
    const ko = thresholdVerdicts(m, { ensoleillement_min: 10, nuit_max_jours: 1, fenetre_terre_min_heures: 24 })
    expect(ko.find((x) => x.key === 'night')!.ok).toBe(false)
    expect(allRespected(ko)).toBe(false)
  })

  it('écart plan alternatif − plan de référence = différence exacte des chiffres', () => {
    const a = computeMetrics(d, v, 0, 100)
    const b = computeMetrics(d, v, 30, 200)
    const dl = comparePlans(a, b)
    expect(dl.sunPct).toBeCloseTo(b.sunFrac * 100 - a.sunFrac * 100, 10)
    expect(dl.nightH).toBe((b.longestNight?.hours ?? 0) - (a.longestNight?.hours ?? 0))
    expect(dl.score).toBeCloseTo(b.score - a.score, 10)
  })

  it('meilleures dates : la première a une note ≥ à toutes les autres', () => {
    const sc = scoreAllDates(d, v, t0, 7, 60)
    const top = topDates(sc)
    expect(top).toHaveLength(5)
    for (const s of sc) expect(top[0].score).toBeGreaterThanOrEqual(s.score)
    // contrôle indépendant à la main sur 5 dates
    for (const s of sc.slice(0, 5)) {
      const m = computeMetrics(d, v, s.idx, s.idx + 168, 60)
      expect(s.score).toBeCloseTo(m.score, 8)
      expect(top[0].score).toBeGreaterThanOrEqual(m.score)
    }
  })

  it('ex æquo : ordre stable par date', () => {
    const flat = build(24 * 20, () => 1)
    const top = topDates(scoreAllDates(flat, computeVisibility(flat, false), flat.startMs, 2, 60))
    expect(top.map((x) => x.idx)).toEqual([...top.map((x) => x.idx)].sort((a, b) => a - b))
  })
})

describe('URL partageable', () => {
  const def: Defaults = {
    site: 'a', landingMs: Date.UTC(2027, 2, 12), days: 14, profile: 'eng', wEnergy: 60, limb: false, cursorMs: null,
    thr: { ensoleillement_min: 50, nuit_max_jours: 3, fenetre_terre_min_heures: 24 }, plans: [],
  }
  it('aller-retour exact', () => {
    const v = {
      ...def, site: 'b', landingMs: Date.UTC(2028, 5, 3, 7), days: 29.53, profile: 'sci' as const, wEnergy: 30, limb: true,
      cursorMs: Date.UTC(2028, 5, 4, 1), thr: { ensoleillement_min: 40, nuit_max_jours: 4, fenetre_terre_min_heures: 12 },
      plans: [{ site: 'a', ms: Date.UTC(2027, 0, 2) }, { site: 'b', ms: Date.UTC(2027, 0, 12, 5) }],
    }
    expect(parseView(serializeView(v, def), def)).toEqual(v)
  })
  it('valeurs par défaut absentes de l\'URL ; valeurs invalides ignorées', () => {
    expect(serializeView(def, def).toString()).toBe('')
    const p = parseView(new URLSearchParams('d=zzz&n=-4&w=500&p=x&plans=oops'), def)
    expect(p).toEqual(def)
  })
  it('dates ISO', () => {
    expect(fromIso(toIso(Date.UTC(2027, 11, 31, 23)))).toBe(Date.UTC(2027, 11, 31, 23))
  })
})

describe('configuration', () => {
  it('message lisible si un champ manque', () => {
    expect(() => validateSites([{ id: 'x', mission: 'm', nom: 'n', lat: 1, lon: 2 }])).toThrow(/champ « source » manquant/)
  })
})
