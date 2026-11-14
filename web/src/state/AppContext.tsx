import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getGlossary, loadConfig, type AppConfig } from '../lib/data'
import type { Site } from '../lib/types'
import type { Defaults } from '../lib/urlState'

export type Glossary = Record<string, { fr: string; en: string; def_fr: string; def_en: string }>

interface Ctx {
  cfg: AppConfig
  defaults: Defaults
  siteById: Map<string, Site>
  hasData: (id: string) => boolean
  availableSites: Site[]
  glossary: Glossary
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('AppProvider manquant')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{ cfg: AppConfig; glossary: Glossary } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadConfig(), getGlossary().catch(() => ({}) as Glossary)])
      .then(([cfg, glossary]) => setState({ cfg, glossary }))
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null
    const { cfg, glossary } = state
    const dataIds = new Set(cfg.index.sites.map((s) => s.id))
    const siteById = new Map(cfg.sites.map((s) => [s.id, s]))
    const availableSites = cfg.sites.filter((s) => dataIds.has(s.id))
    const startMs = Date.parse(cfg.index.start)
    const landingMs = startMs + 70 * 86400000
    const site = availableSites.find((s) => s.id === 'im2_mons_mouton')?.id ?? availableSites.find((s) => s.type === 'clps')?.id ?? availableSites[0]?.id ?? ''
    const second = availableSites.find((s) => s.id === 'griffin1_nobile' && s.id !== site)?.id ?? availableSites.find((s) => s.id !== site)?.id ?? site
    const defaults: Defaults = {
      site, landingMs, days: 14, profile: 'eng', wEnergy: 60, limb: false, cursorMs: null, thr: cfg.thresholds,
      plans: [{ site, ms: landingMs }, { site: second, ms: landingMs }],
    }
    return { cfg, defaults, siteById, hasData: (id) => dataIds.has(id), availableSites, glossary }
  }, [state])

  if (error)
    return (
      <div className="boot" role="alert">
        <h1>{t('boot.errorTitle')}</h1>
        <p>{error}</p>
        <p>{t('boot.errorHelp')}</p>
      </div>
    )
  if (!value) return <div className="boot" role="status">{t('boot.loading')}</div>
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
