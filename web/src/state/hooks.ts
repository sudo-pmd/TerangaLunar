import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { computeVisibility, loadSiteData } from '../lib/data'
import type { SiteData, Visibility } from '../lib/types'
import { parseView, serializeView, type ViewState } from '../lib/urlState'
import { useApp } from './AppContext'

/** L'état de la vue vit dans l'URL : le lien partageable (F-61) restitue exactement la même vue. */
export function useView() {
  const { defaults } = useApp()
  const [params, setParams] = useSearchParams()
  const view = useMemo(() => parseView(params, defaults), [params, defaults])
  const setView = useCallback(
    (patch: Partial<ViewState>) => setParams(serializeView({ ...parseView(params, defaults), ...patch }, defaults), { replace: true }),
    [params, defaults, setParams],
  )
  return { view, setView, search: params.toString() }
}

export function useSiteData(id: string | undefined) {
  const [st, setSt] = useState<{ id?: string; data?: SiteData; error?: string }>({})
  useEffect(() => {
    if (!id) return
    let live = true
    loadSiteData(id).then(
      (data) => live && setSt({ id, data }),
      (e) => live && setSt({ id, error: String(e.message ?? e) }),
    )
    return () => { live = false }
  }, [id])
  const ready = st.id === id
  return { data: ready ? st.data : undefined, error: ready ? st.error : undefined, loading: !!id && !ready }
}

export function useVis(data: SiteData | undefined, limb: boolean): Visibility | undefined {
  return useMemo(() => (data ? computeVisibility(data, limb) : undefined), [data, limb])
}

export function useAllData(ids: string[]) {
  const key = ids.join(',')
  const [map, setMap] = useState<Map<string, SiteData> | null>(null)
  useEffect(() => {
    let live = true
    Promise.all(ids.map((id) => loadSiteData(id).then((d) => [id, d] as const))).then((arr) => live && setMap(new Map(arr)))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

export function useReducedMotion() {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return r
}
