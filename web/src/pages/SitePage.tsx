import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import {
  AssumptionsBox, DatePicker, LimbToggle, Loading, ProfileToggle, ScoreSlider, ShareButton, ShiftButtons, SiteSelect,
  StatCard, StayPicker, Term, VLink, fmtLat, fmtLon, useSiteNote,
} from '../components/common'
import HorizonView from '../components/viz/HorizonView'
import Timeline, { type Zoom } from '../components/viz/Timeline'
import BarChart from '../components/viz/BarChart'
import { ThresholdTable } from '../components/tables'
import { fmtDate, fmtHours, fmtMonth, fmtNum } from '../lib/format'
import { computeMetrics, dateToIndex, indexToMs, scienceView, shiftDate, stayRange, sunSeries, thresholdVerdicts } from '../lib/metrics'
import { useApp } from '../state/AppContext'
import { useSiteData, useVis, useView } from '../state/hooks'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export default function SitePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { siteById, hasData } = useApp()
  const { view, setView, search } = useView()
  const nav = useNavigate()
  const note = useSiteNote()
  const [zoom, setZoom] = useState<Zoom>('month')
  const [shiftMsg, setShiftMsg] = useState('')

  const site = siteById.get(view.site)
  const { data, error, loading } = useSiteData(site && hasData(site.id) ? site.id : undefined)
  const vis = useVis(data, view.limb)

  const calc = useMemo(() => {
    if (!data || !vis) return null
    const stay = stayRange(data, view.landingMs, view.days)
    const metrics = computeMetrics(data, vis, stay.i0, stay.i1, view.wEnergy)
    const cursor = Math.min(Math.max(dateToIndex(data, view.cursorMs ?? view.landingMs), 0), data.n - 1)
    return {
      stay, metrics, cursor,
      verdicts: thresholdVerdicts(metrics, view.thr),
      science: scienceView(data, vis, cursor, stay.i0, stay.i1),
      months: sunSeries(data, vis, 0, data.n, 'month'),
      daily: sunSeries(data, vis, stay.i0, stay.i1, 'day'),
    }
  }, [data, vis, view.landingMs, view.days, view.wEnergy, view.cursorMs, view.thr])

  if (!site)
    return <Page title={t('site.unknownTitle')}><p>{t('site.unknown', { id: view.site })}</p><p><VLink to="/">{t('notFound.back')}</VLink></p></Page>
  if (!hasData(site.id))
    return <Page title={site.nom}><p className="alert warn">{t('site.noData')}</p></Page>

  const onShift = (d: number) => {
    if (!data) return
    const r = shiftDate(data, view.landingMs, d, view.days)
    setShiftMsg(r.clamped ? t('shift.clamped') : t('shift.done', { date: fmtDate(r.ms, lang) }))
    setView({ landingMs: r.ms, cursorMs: null })
  }
  const compare = () => {
    const mine = { site: view.site, ms: view.landingMs }
    const others = view.plans.filter((p) => !(p.site === mine.site && p.ms === mine.ms))
    const next = new URLSearchParams(search)
    next.set('plans', [mine, ...others].slice(0, 3).map((p) => `${p.site}@${new Date(p.ms).toISOString().slice(0, 16)}`).join(';'))
    nav({ pathname: '/comparer', search: next.toString() })
  }

  const m = calc?.metrics
  const sc = calc?.science
  const compass = sc ? t(`compass.${COMPASS[Math.round(sc.sunAz / 45) % 8]}`) : ''
  const shadowCompass = sc ? t(`compass.${COMPASS[Math.round(sc.shadowAz / 45) % 8]}`) : ''

  return (
    <Page title={site.nom} lead={`${site.mission} · ${site.entreprise}`} wide>
      <p className="site-meta">
        <span className={`chip st-${site.statut}`}>{t(`status.${site.statut}`, site.statut)}</span>{' '}
        {fmtLat(site.lat, lang)} · {fmtLon(site.lon, lang)} ·{' '}
        <a href={site.source} target="_blank" rel="noopener noreferrer">{t('site.source')}</a>
      </p>
      {site.coord_statut === 'approx' && <p className="alert warn small">{t('site.approx')}</p>}
      {note(site) && <p className="muted small">{note(site)}</p>}

      <section className="panel" aria-labelledby="ctl-h">
        <h2 id="ctl-h">{t('site.controls')}</h2>
        <div className="grid-fields">
          <SiteSelect value={view.site} onChange={(s) => setView({ site: s, cursorMs: null })} />
          <DatePicker ms={view.landingMs} onChange={(ms) => setView({ landingMs: ms, cursorMs: null })} />
          <StayPicker days={view.days} onChange={(days) => setView({ days })} />
          <ProfileToggle value={view.profile} onChange={(profile) => setView({ profile })} />
        </div>
        <LimbToggle value={view.limb} onChange={(limb) => setView({ limb })} />
        <ShiftButtons onShift={onShift} message={shiftMsg} />
      </section>

      {error && <p className="alert warn" role="alert">{error}</p>}
      {loading && <Loading />}

      {data && vis && calc && m && sc && (
        <>
          <div className="viz-row">
            <section aria-labelledby="hz-h" className="viz-horizon">
              <h2 id="hz-h">{t('site.skyAt', { date: fmtDate(indexToMs(data, calc.cursor), lang) })}</h2>
              <HorizonView data={data} vis={vis} idx={calc.cursor} />
              {view.cursorMs !== null && <button type="button" className="btn small" onClick={() => setView({ cursorMs: null })}>{t('site.resetCursor')}</button>}
            </section>
            <section className="viz-timeline" aria-labelledby="tl-h">
              <h2 id="tl-h" className="sr-only">{t('tl.title')}</h2>
              <Timeline data={data} vis={vis} cursor={calc.cursor} stay={calc.stay} night={m.longestNight} zoom={zoom} onZoom={setZoom}
                onCursor={(i) => setView({ cursorMs: i === dateToIndex(data, view.landingMs) ? null : indexToMs(data, i) })} />
            </section>
          </div>

          <section aria-labelledby="num-h">
            <h2 id="num-h">{t(view.profile === 'eng' ? 'site.numbersEng' : 'site.numbersSci', { days: fmtNum(view.days, lang, 2) })}</h2>
            {calc.stay.truncated && <p className="alert warn small">{t('site.truncated')}</p>}
            {view.profile === 'eng' ? (
              <div className="cards">
                <StatCard tone="sun" title={t('metrics.sun')} value={`${fmtNum(m.sunFrac * 100, lang, 1)} %`} sub={t('site.sunSub', { h: fmtHours(m.sunFrac * m.hours, lang), t: fmtHours(m.hours, lang) })} />
                <StatCard tone="night" title={<Term k="nuit">{t('metrics.night')}</Term>}
                  value={fmtHours(m.longestNight?.hours ?? 0, lang)}
                  sub={m.longestNight && m.longestNight.hours > 0
                    ? <>{t('site.nightFrom', { date: fmtDate(indexToMs(data, m.longestNight.start), lang) })}
                      {m.longestNight.startedBefore && <> · {t('site.nightBefore')}</>}{m.longestNight.endsAfter && <> · {t('site.nightAfter')}</>}</>
                    : t('site.noNight')} />
                <StatCard tone="earth" title={t('metrics.earthWindows')} value={t('site.windowCount', { count: m.earthWindows.length })}
                  sub={m.longestEarth ? t('site.earthLongest', { d: fmtHours(m.longestEarth.hours, lang), p: fmtNum(m.earthFrac * 100, lang, 0) }) : t('site.noEarth')}>
                  {m.earthWindows.length > 0 && (
                    <details>
                      <summary>{t('site.listWindows')}</summary>
                      <ul className="small">
                        {m.earthWindows.slice(0, 30).map((w) => <li key={w.start}>{fmtDate(indexToMs(data, w.start), lang)} · {fmtHours(w.hours, lang)}</li>)}
                        {m.earthWindows.length > 30 && <li>…</li>}
                      </ul>
                    </details>
                  )}
                </StatCard>
                <StatCard tone="score" title={t('metrics.score')} value={`${fmtNum(m.score, lang, 1)} / 100`} sub={t('controls.weightsText', { e: view.wEnergy, c: 100 - view.wEnergy })} />
              </div>
            ) : (
              <div className="cards">
                <StatCard tone="sun" title={t('sci.elev')} value={`${fmtNum(sc.sunEl, lang, 1)}°`}
                  sub={sc.sunVisible ? t('sci.visible') : sc.sunEl > 0 ? t('horizon.state_masked') : t('horizon.state_below')} />
                <StatCard tone="sun" title={<Term k="azimut">{t('sci.az')}</Term>} value={`${fmtNum(sc.sunAz, lang, 0)}°`} sub={compass} />
                <StatCard tone="night" title={<Term k="ombre">{t('sci.shadow')}</Term>}
                  value={sc.sunEl > 0 ? `${fmtNum(sc.shadowAz, lang, 0)}°` : '—'} sub={sc.sunEl > 0 ? shadowCompass : t('sci.noShadow')} />
                <StatCard tone="score" title={<Term k="rasant">{t('sci.grazing')}</Term>} value={fmtHours(sc.grazingHours, lang)}
                  sub={t('sci.grazingSub', { t: fmtHours(sc.stayHours, lang) })} />
                <StatCard tone="sun" title={t('metrics.sun')} value={`${fmtNum(m.sunFrac * 100, lang, 1)} %`} sub={t('sci.sunSub')} />
              </div>
            )}
          </section>

          {view.profile === 'eng' && (
            <section aria-labelledby="thr-h">
              <h2 id="thr-h">{t('thr.title')}</h2>
              <ThresholdTable cols={[{ key: 'p', label: site.nom, verdicts: calc.verdicts }]} thr={view.thr} onChange={(thr) => setView({ thr })} />
              <ScoreSlider value={view.wEnergy} onChange={(wEnergy) => setView({ wEnergy })} />
            </section>
          )}

          <section aria-labelledby="bars-h">
            <h2 id="bars-h">{t('site.bars')}</h2>
            <h3>{t('site.byMonth')}</h3>
            <BarChart ariaLabel={t('site.byMonth')} bars={calc.months.map((b) => ({ label: fmtMonth(b.startMs, lang), frac: b.frac, title: `${fmtMonth(b.startMs, lang)} : ${fmtNum(b.frac * 100, lang, 1)} %` }))} />
            {calc.daily.length > 1 && calc.daily.length <= 100 && (
              <>
                <h3>{t('site.byDay')}</h3>
                <BarChart ariaLabel={t('site.byDay')} bars={calc.daily.map((b) => ({ label: fmtDate(b.startMs, lang, false).replace(/\s\d{4}$/, ''), frac: b.frac, title: `${fmtDate(b.startMs, lang, false)} : ${fmtNum(b.frac * 100, lang, 1)} %` }))} />
              </>
            )}
          </section>

          <AssumptionsBox view={view} relief={data.relief} />

          <p className="actions">
            <ShareButton />
            <button type="button" className="btn" onClick={compare}>{t('site.addCompare')}</button>
            <VLink to="/dates" className="btn">{t('site.bestDates')}</VLink>
            <VLink to="/recap" className="btn">{t('site.recap')}</VLink>
          </p>
        </>
      )}
    </Page>
  )
}
