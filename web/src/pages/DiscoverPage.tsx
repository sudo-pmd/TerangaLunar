import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/Layout'
import { Loading, StatCard, VLink } from '../components/common'
import RichText from '../components/RichText'
import ElevationChart from '../components/viz/ElevationChart'
import { computeVisibility, getScenarios } from '../lib/data'
import { fmtDate, fmtHours, fmtNum, fmtSigned } from '../lib/format'
import { comparePlans, computeMetrics, stayRange, thresholdVerdicts } from '../lib/metrics'
import type { SiteData } from '../lib/types'
import { useApp } from '../state/AppContext'
import { useAllData } from '../state/hooks'

type L = { fr: string; en: string }
interface Scenario {
  id: string; icon: string; title: L; summary: L
  sections: { h: L; p: { fr: string[]; en: string[] }; widget?: 'cycle' | 'pole' | 'delay' | null }[]
  questions: { q: L; a: L }[]
}

function useScenarios() {
  const [list, setList] = useState<Scenario[] | null>(null)
  useEffect(() => { getScenarios().then((j) => setList(j.scenarios)).catch(() => setList([])) }, [])
  return list
}
const pick = (l: L, lang: string) => (lang.startsWith('en') ? l.en : l.fr)

export function DiscoverIndex() {
  const { t, i18n } = useTranslation()
  const list = useScenarios()
  return (
    <Page title={t('discover.title')} lead={t('discover.lead')}>
      {!list ? <Loading /> : (
        <ul className="scenario-list">
          {list.map((s, i) => (
            <li key={s.id} className="panel">
              <span className="scenario-icon" aria-hidden="true">{s.icon}</span>
              <h2><VLink to={`/decouvrir/${s.id}`}>{i + 1}. {pick(s.title, i18n.language)}</VLink></h2>
              <p>{pick(s.summary, i18n.language)}</p>
              <VLink to={`/decouvrir/${s.id}`} className="btn primary">{t('discover.start')}</VLink>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{t('discover.provisionalNote')}</p>
    </Page>
  )
}

// ---- éléments interactifs --------------------------------------------------------------------------------
const WINDOW_DAYS = 60
const start = 20 * 24

function useScenarioData() {
  const { availableSites } = useApp()
  const poleId = availableSites.find((s) => s.id === 'im2_mons_mouton')?.id ?? availableSites.find((s) => s.lat < -80)?.id ?? availableSites[0]?.id
  const eqId = availableSites.find((s) => s.id === 'ref_equateur')?.id ?? availableSites.find((s) => Math.abs(s.lat) < 20)?.id ?? availableSites[0]?.id
  const ids = useMemo(() => [...new Set([poleId, eqId].filter(Boolean) as string[])], [poleId, eqId])
  const map = useAllData(ids)
  return { pole: map?.get(poleId!), eq: map?.get(eqId!), ready: !!map }
}

function sliceEl(d: SiteData, from: number, count: number) {
  return d.sunEl.subarray(from, from + count)
}

function CycleWidget({ withMetrics }: { withMetrics: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { siteById, availableSites } = useApp()
  const { pole, eq, ready } = useScenarioData()
  const [h, setH] = useState(0)
  if (!ready || !pole || !eq) return <Loading />
  const count = WINDOW_DAYS * 24
  const cur = Math.round(h / pole.stepH)
  const idx = start + cur
  const vp = computeVisibility(pole, false), ve = computeVisibility(eq, false)
  const poleName = siteById.get(pole.id)?.nom ?? pole.id
  const eqName = siteById.get(eq.id)?.nom ?? eq.id
  const lunar = Math.round((29.53 * 24) / pole.stepH)
  const mp = computeMetrics(pole, vp, idx, Math.min(idx + lunar, pole.n))
  const me = computeMetrics(eq, ve, idx, Math.min(idx + lunar, eq.n))
  const date = pole.startMs + idx * pole.stepS * 1000
  void availableSites
  return (
    <div className="widget panel">
      <ElevationChart stepH={pole.stepH} cursor={cur} ariaLabel={t('discover.chartLabel')}
        series={[{ label: poleName, values: sliceEl(pole, start, count), cls: 'a' }, { label: eqName, values: sliceEl(eq, start, count), cls: 'b' }]} />
      <div className="field">
        <label htmlFor="cyc">{t('discover.slider')} : <strong>{fmtDate(date, lang)}</strong></label>
        <input id="cyc" type="range" min={0} max={count - 1} step={6} value={h} onChange={(e) => setH(Number(e.target.value))}
          aria-valuetext={fmtDate(date, lang)} />
      </div>
      <p aria-live="polite">
        {t('discover.nowEq', { v: fmtNum(eq.sunEl[idx], lang, 1), s: ve.sun[idx] ? t('tl.visible') : t('tl.hidden') })}{' '}
        {t('discover.nowPole', { v: fmtNum(pole.sunEl[idx], lang, 1), s: vp.sun[idx] ? t('tl.visible') : t('tl.hidden') })}
      </p>
      {withMetrics && (
        <>
          <h3>{t('discover.nextLunarDay', { date: fmtDate(date, lang, false) })}</h3>
          <div className="cards">
            <StatCard tone="sun" title={`${eqName} : ${t('metrics.sun')}`} value={`${fmtNum(me.sunFrac * 100, lang, 0)} %`} sub={`${t('metrics.night')} : ${fmtHours(me.longestNight?.hours ?? 0, lang)}`} />
            <StatCard tone="sun" title={`${poleName} : ${t('metrics.sun')}`} value={`${fmtNum(mp.sunFrac * 100, lang, 0)} %`} sub={`${t('metrics.night')} : ${fmtHours(mp.longestNight?.hours ?? 0, lang)}`} />
          </div>
        </>
      )}
    </div>
  )
}

function DelayWidget() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { defaults, cfg } = useApp()
  const { pole, ready } = useScenarioData()
  const [delay, setDelay] = useState(10)
  if (!ready || !pole) return <Loading />
  const vis = computeVisibility(pole, false)
  const days = 14
  const planned = defaults.landingMs
  const delayed = planned + delay * 86400000
  const a = stayRange(pole, planned, days), b = stayRange(pole, delayed, days)
  const ma = computeMetrics(pole, vis, a.i0, a.i1), mb = computeMetrics(pole, vis, b.i0, b.i1)
  const d = comparePlans(ma, mb)
  const va = thresholdVerdicts(ma, cfg.thresholds).find((v) => v.key === 'night')!
  const vb = thresholdVerdicts(mb, cfg.thresholds).find((v) => v.key === 'night')!
  return (
    <div className="widget panel">
      <div className="field">
        <label htmlFor="delay">{t('discover.delay')} : <strong>{t('discover.delayDays', { count: delay })}</strong></label>
        <input id="delay" type="range" min={0} max={20} step={1} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
      </div>
      <p>{t('discover.delayText', { a: fmtDate(planned, lang, false), b: fmtDate(delayed, lang, false), days })}</p>
      <div className="cards">
        <StatCard tone="sun" title={t('discover.planned')} value={`${fmtNum(ma.sunFrac * 100, lang, 0)} %`} sub={`${t('metrics.night')} : ${fmtHours(ma.longestNight?.hours ?? 0, lang)} · ${va.ok ? t('verdict.ok') : t('verdict.ko')}`} />
        <StatCard tone="night" title={t('discover.delayed')} value={`${fmtNum(mb.sunFrac * 100, lang, 0)} %`} sub={`${t('metrics.night')} : ${fmtHours(mb.longestNight?.hours ?? 0, lang)} · ${vb.ok ? t('verdict.ok') : t('verdict.ko')}`} />
        <StatCard tone="score" title={t('compare.delta')} value={`${fmtSigned(d.sunPct, lang, 1)} pts`} sub={`${t('metrics.night')} : ${fmtSigned(d.nightH, lang, 0)} h`} />
      </div>
      <p><VLink to="/dates" className="btn">{t('discover.seeDates')}</VLink></p>
    </div>
  )
}

export function ScenarioPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const list = useScenarios()
  if (!list) return <Page title={t('discover.title')}><Loading /></Page>
  const i = list.findIndex((s) => s.id === id)
  if (i < 0) return <Page title={t('discover.title')}><p><VLink to="/decouvrir">{t('discover.back')}</VLink></p></Page>
  const s = list[i]
  const en = lang.startsWith('en')
  return (
    <Page title={pick(s.title, lang)} lead={pick(s.summary, lang)}>
      <nav aria-label={t('discover.nav')} className="small"><VLink to="/decouvrir">← {t('discover.back')}</VLink></nav>
      <article className="reading">
        {s.sections.map((sec, k) => (
          <section key={k}>
            <h2>{pick(sec.h, lang)}</h2>
            {(en ? sec.p.en : sec.p.fr).map((p, j) => <p key={j}><RichText text={p} /></p>)}
            {sec.widget === 'cycle' && <CycleWidget withMetrics={false} />}
            {sec.widget === 'pole' && <CycleWidget withMetrics />}
            {sec.widget === 'delay' && <DelayWidget />}
          </section>
        ))}
        <section aria-labelledby="q-h">
          <h2 id="q-h">{t('discover.questions')}</h2>
          <ol className="questions">
            {s.questions.map((q, k) => (
              <li key={k}>
                <p><strong>{pick(q.q, lang)}</strong></p>
                <details><summary>{t('discover.showAnswer')}</summary><p>{pick(q.a, lang)}</p></details>
              </li>
            ))}
          </ol>
        </section>
      </article>
      <nav className="actions" aria-label={t('discover.nav')}>
        {i > 0 && <VLink to={`/decouvrir/${list[i - 1].id}`} className="btn">← {pick(list[i - 1].title, lang)}</VLink>}
        {i < list.length - 1 && <VLink to={`/decouvrir/${list[i + 1].id}`} className="btn primary">{pick(list[i + 1].title, lang)} →</VLink>}
      </nav>
    </Page>
  )
}
