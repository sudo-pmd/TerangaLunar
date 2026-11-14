import type { DataIndex, Site, SiteData, Source, Thresholds, Visibility } from './types'

const base = (import.meta.env?.BASE_URL as string | undefined) ?? './'

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${path} : HTTP ${res.status}`)
  return (await res.json()) as T
}

// ---- configuration (F-80) : erreurs lisibles si un champ manque ---------------------------
export function validateSites(raw: unknown): Site[] {
  if (!Array.isArray(raw)) throw new Error('sites.json doit être une liste.')
  return raw.map((s, i) => {
    for (const k of ['id', 'mission', 'nom', 'lat', 'lon', 'source']) {
      if (s?.[k] === undefined || s?.[k] === null || s?.[k] === '')
        throw new Error(`sites.json, entrée ${i + 1} (${s?.id ?? '?'}) : champ « ${k} » manquant.`)
    }
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number' || Math.abs(s.lat) > 90 || Math.abs(s.lon) > 360)
      throw new Error(`sites.json, ${s.id} : latitude/longitude invalides.`)
    return {
      entreprise: '—', statut: 'planifiee', type: 'clps', date_cible: '', coord_statut: 'approx', ...s,
    } as Site
  })
}

export function validateSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) throw new Error('sources.json doit être une liste.')
  return raw.map((s, i) => {
    for (const k of ['id', 'titre', 'url', 'version', 'licence', 'consulte_le']) {
      if (!s?.[k]) throw new Error(`sources.json, entrée ${i + 1} : champ « ${k} » manquant.`)
    }
    return s as Source
  })
}

export interface AppConfig {
  sites: Site[]
  sources: Source[]
  thresholds: Thresholds
  index: DataIndex
}

export async function loadConfig(): Promise<AppConfig> {
  const [sites, sources, thresholds, index] = await Promise.all([
    getJSON<unknown>('config/sites.json').then(validateSites),
    getJSON<unknown>('config/sources.json').then(validateSources),
    getJSON<Thresholds>('config/seuils.json'),
    getJSON<DataIndex>('data/index.json'),
  ])
  return { sites, sources, thresholds, index }
}

export const getScenarios = () => getJSON<any>('config/scenarios.json')
export const getGlossary = () => getJSON<Record<string, { fr: string; en: string; def_fr: string; def_en: string }>>('config/glossaire.json')

// ---- données précalculées -----------------------------------------------------------------
export interface RawHeader { id: string; n: number; mask_n: number; scale: number; start: string; step_s: number; relief: boolean }

export function decodeSite(head: RawHeader, buf: ArrayBuffer): SiteData {
  const { n, mask_n: m, scale } = head
  const f = (a: Int16Array | Uint16Array) => Float32Array.from(a, (v) => v / scale)
  let o = 0
  const take = <T extends Int16Array | Uint16Array>(C: new (b: ArrayBuffer, off: number, len: number) => T, len: number): T => {
    const a = new C(buf, o, len)
    o += len * 2
    return a
  }
  const sunEl = f(take(Int16Array, n))
  const sunAz = f(take(Uint16Array, n))
  const earthEl = f(take(Int16Array, n))
  const earthAz = f(take(Uint16Array, n))
  const mask = f(take(Int16Array, m))
  return {
    id: head.id, n, startMs: Date.parse(head.start), stepS: head.step_s, stepH: head.step_s / 3600,
    relief: head.relief, sunEl, sunAz, earthEl, earthAz, mask,
  }
}

const cache = new Map<string, Promise<SiteData>>()

export function loadSiteData(id: string): Promise<SiteData> {
  let p = cache.get(id)
  if (!p) {
    p = (async () => {
      const [head, res] = await Promise.all([
        getJSON<RawHeader>(`data/${id}.json`),
        fetch(`${base}data/${id}.bin`),
      ])
      if (!res.ok) throw new Error(`data/${id}.bin : HTTP ${res.status}`)
      return decodeSite(head, await res.arrayBuffer())
    })()
    cache.set(id, p)
    p.catch(() => cache.delete(id))
  }
  return p
}

// ---- visibilité (section 7) -----------------------------------------------------------------
export const SUN_LIMB_DEG = 0.27

export function maskAt(mask: Float32Array, az: number): number {
  const M = mask.length
  const pos = ((az % 360) + 360) % 360 / (360 / M)
  const i = Math.floor(pos)
  const f = pos - i
  return mask[i % M] * (1 - f) + mask[(i + 1) % M] * f
}

/** Un astre est visible si son élévation dépasse celle du relief dans la même direction.
 *  limb = true : le Soleil est visible dès que son bord supérieur (+0,27°) dépasse. */
export function computeVisibility(d: SiteData, limb: boolean): Visibility {
  const n = d.n
  const sun = new Uint8Array(n)
  const earth = new Uint8Array(n)
  const sunCum = new Int32Array(n + 1)
  const earthCum = new Int32Array(n + 1)
  const bonus = limb ? SUN_LIMB_DEG : 0
  for (let i = 0; i < n; i++) {
    sun[i] = d.sunEl[i] + bonus > maskAt(d.mask, d.sunAz[i]) ? 1 : 0
    earth[i] = d.earthEl[i] > maskAt(d.mask, d.earthAz[i]) ? 1 : 0
    sunCum[i + 1] = sunCum[i] + sun[i]
    earthCum[i + 1] = earthCum[i] + earth[i]
  }
  return { sun, earth, sunCum, earthCum }
}

/** Construit une SiteData à partir de tableaux (tests, démonstrations). */
export function makeSiteData(p: {
  id?: string; startMs?: number; stepS?: number; sunEl: ArrayLike<number>; sunAz?: ArrayLike<number>;
  earthEl?: ArrayLike<number>; earthAz?: ArrayLike<number>; mask?: ArrayLike<number>; relief?: boolean
}): SiteData {
  const n = p.sunEl.length
  const z = () => new Float32Array(n)
  return {
    id: p.id ?? 'test', n, startMs: p.startMs ?? Date.UTC(2027, 0, 1), stepS: p.stepS ?? 3600,
    stepH: (p.stepS ?? 3600) / 3600, relief: p.relief ?? false,
    sunEl: Float32Array.from(p.sunEl), sunAz: p.sunAz ? Float32Array.from(p.sunAz) : z(),
    earthEl: p.earthEl ? Float32Array.from(p.earthEl) : z(), earthAz: p.earthAz ? Float32Array.from(p.earthAz) : z(),
    mask: p.mask ? Float32Array.from(p.mask) : new Float32Array(720),
  }
}
