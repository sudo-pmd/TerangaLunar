import type { Plan, Profile, Thresholds } from './types'

export interface ViewState {
  site: string
  landingMs: number
  days: number
  profile: Profile
  wEnergy: number
  limb: boolean
  cursorMs: number | null
  thr: Thresholds
  plans: Plan[]
}

export type Defaults = ViewState

const pad = (n: number) => String(n).padStart(2, '0')
export const toIso = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
export const fromIso = (s: string | null): number | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null
  const t = Date.parse(s + ':00Z')
  return Number.isFinite(t) ? t : null
}
const num = (s: string | null, lo: number, hi: number): number | null => {
  if (s === null || s === '') return null
  const x = Number(s)
  return Number.isFinite(x) && x >= lo && x <= hi ? x : null
}

/** Lit l'état d'une vue depuis l'URL. Toute valeur invalide retombe sur la valeur par défaut. */
export function parseView(p: URLSearchParams, def: Defaults): ViewState {
  const thrParts = (p.get('t') ?? '').split(',').map(Number)
  const thr: Thresholds =
    thrParts.length === 3 && thrParts.every(Number.isFinite)
      ? { ensoleillement_min: thrParts[0], nuit_max_jours: thrParts[1], fenetre_terre_min_heures: thrParts[2] }
      : def.thr
  const plans: Plan[] = (p.get('plans') ?? '')
    .split(';')
    .map((x) => x.split('@'))
    .filter((x) => x.length === 2 && fromIso(x[1]) !== null)
    .map((x) => ({ site: x[0], ms: fromIso(x[1])! }))
    .slice(0, 3)
  return {
    site: p.get('s') || def.site,
    landingMs: fromIso(p.get('d')) ?? def.landingMs,
    days: num(p.get('n'), 0.04, 400) ?? def.days,
    profile: p.get('p') === 'sci' ? 'sci' : p.get('p') === 'eng' ? 'eng' : def.profile,
    wEnergy: num(p.get('w'), 0, 100) ?? def.wEnergy,
    limb: p.get('l') === '1' ? true : p.get('l') === '0' ? false : def.limb,
    cursorMs: fromIso(p.get('c')),
    thr,
    plans: plans.length ? plans : def.plans,
  }
}

/** Écrit l'état dans l'URL : uniquement ce qui diffère des valeurs par défaut. Aucune donnée personnelle. */
export function serializeView(v: ViewState, def: Defaults): URLSearchParams {
  const p = new URLSearchParams()
  if (v.site !== def.site) p.set('s', v.site)
  if (v.landingMs !== def.landingMs) p.set('d', toIso(v.landingMs))
  if (v.days !== def.days) p.set('n', String(v.days))
  if (v.profile !== def.profile) p.set('p', v.profile)
  if (v.wEnergy !== def.wEnergy) p.set('w', String(v.wEnergy))
  if (v.limb !== def.limb) p.set('l', v.limb ? '1' : '0')
  if (v.cursorMs !== null) p.set('c', toIso(v.cursorMs))
  const t = v.thr, dt = def.thr
  if (t.ensoleillement_min !== dt.ensoleillement_min || t.nuit_max_jours !== dt.nuit_max_jours || t.fenetre_terre_min_heures !== dt.fenetre_terre_min_heures)
    p.set('t', `${t.ensoleillement_min},${t.nuit_max_jours},${t.fenetre_terre_min_heures}`)
  if (JSON.stringify(v.plans) !== JSON.stringify(def.plans))
    p.set('plans', v.plans.map((x) => `${x.site}@${toIso(x.ms)}`).join(';'))
  return p
}
