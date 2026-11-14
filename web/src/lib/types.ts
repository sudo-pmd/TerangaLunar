export interface Site {
  id: string
  mission: string
  entreprise: string
  nom: string
  lat: number
  lon: number
  statut: 'atterrie' | 'planifiee' | 'echec' | 'reference' | string
  type: 'clps' | 'reference' | string
  date_cible?: string
  coord_statut?: 'exact' | 'releve' | 'approx' | string
  source: string
  note_fr?: string
  note_en?: string
}

export interface Source {
  id: string
  categorie?: string
  titre: string
  url: string
  version: string
  licence: string
  consulte_le: string
}

export interface Thresholds {
  ensoleillement_min: number // % du séjour
  nuit_max_jours: number // la plus longue nuit doit rester strictement inférieure
  fenetre_terre_min_heures: number // la plus longue fenêtre Terre doit atteindre au moins
}

export interface DataIndex {
  generated: string
  start: string
  days: number
  step_s: number
  n: number
  backend: string
  provisional: boolean
  frame: string
  abcorr: string
  radius_km: number
  kernels: string[]
  script_version: string
  horizon: { source?: string | null; resolution_m?: number | null; mast_m?: number; dmax_km?: number }
  sites: { id: string; file: string; relief: boolean; bytes: number }[]
}

export interface SiteData {
  id: string
  n: number
  startMs: number
  stepS: number
  stepH: number
  relief: boolean
  sunEl: Float32Array
  sunAz: Float32Array
  earthEl: Float32Array
  earthAz: Float32Array
  mask: Float32Array // degrés, un pas de 360/mask.length
}

export interface Visibility {
  sun: Uint8Array
  earth: Uint8Array
  sunCum: Int32Array // sunCum[i] = nombre d'échantillons « Soleil visible » avant i
  earthCum: Int32Array
}

export interface Run {
  start: number // indice de début (inclus)
  end: number // indice de fin (exclu)
  hours: number
}

export interface Metrics {
  i0: number
  i1: number
  hours: number
  sunFrac: number // 0-1
  earthFrac: number // 0-1
  longestNight: (Run & { startedBefore: boolean; endsAfter: boolean }) | null
  earthWindows: Run[]
  longestEarth: Run | null
  score: number // 0-100
}

export type Profile = 'eng' | 'sci'

export interface Plan {
  site: string
  ms: number
}
