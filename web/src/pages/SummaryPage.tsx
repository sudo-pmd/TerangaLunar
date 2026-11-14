import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/Layout'
import { Badge } from '../components/tables'
import { Loading, VLink, fmtLat, fmtLon } from '../components/common'
import { fmtDate, fmtHours, fmtNum } from '../lib/format'
import { computeMetrics, indexToMs, stayRange, thresholdVerdicts } from '../lib/metrics'
import { useApp } from '../state/AppContext'
import { useSiteData, useVis, useView } from '../state/hooks'

const KEY = 'clps-notes'
const loadNotes = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }

/** Récapitulatif d'une page imprimable (F-63) avec zone de notes libre (F-64). Les notes restent sur l'appareil. */
export default function SummaryPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { cfg, siteById, hasData } = useApp()
  const { view } = useView()
  const site = siteById.get(view.site)
  const { data } = useSiteData(hasData(view.site) ? view.site : undefined)
  const vis = useVis(data, view.limb)
  const [notes, setNotes] = useState(loadNotes)
  useEffect(() => { try { localStorage.setItem(KEY, notes) } catch { /* ignoré */ } }, [notes])

  const calc = useMemo(() => {
    if (!data || !vis) return null
    const { i0, i1 } = stayRange(data, view.landingMs, view.days)
    const m = computeMetrics(data, vis, i0, i1, view.wEnergy)
    return { m, v: thresholdVerdicts(m, view.thr) }
  }, [data, vis, view])

  if (!site) return <Page title={t('recap.title')}><p><VLink to="/">{t('notFound.back')}</VLink></p></Page>
  if (!data || !calc) return <Page title={t('recap.title')}><Loading /></Page>
  const { m, v } = calc
  const idx = cfg.index
  return (
    <Page title={t('recap.title')} lead={`${site.nom} · ${site.mission}`}>
      <div className="no-print actions">
        <button type="button" className="btn primary" onClick={() => window.print()}>{t('recap.print')}</button>
        <VLink to="/site" className="btn">{t('recap.back')}</VLink>
      </div>
      <div className="recap">
        <section>
          <h2>{t('recap.plan')}</h2>
          <dl className="dl">
            <dt>{t('site.coords')}</dt><dd>{fmtLat(site.lat, lang)} · {fmtLon(site.lon, lang)}</dd>
            <dt>{t('controls.date')}</dt><dd>{fmtDate(view.landingMs, lang)}</dd>
            <dt>{t('controls.stay')}</dt><dd>{fmtNum(view.days, lang, 2)} {t('thr.days')}</dd>
            <dt>{t('controls.profile')}</dt><dd>{t(`controls.profile_${view.profile}`)}</dd>
          </dl>
        </section>
        <section>
          <h2>{t('recap.numbers')}</h2>
          <table className="data">
            <tbody>
              <tr><th scope="row">{t('metrics.sun')}</th><td>{fmtNum(m.sunFrac * 100, lang, 1)} %</td></tr>
              <tr><th scope="row">{t('metrics.night')}</th><td>{fmtHours(m.longestNight?.hours ?? 0, lang)}{m.longestNight && m.longestNight.hours > 0 ? ` (${fmtDate(indexToMs(data, m.longestNight.start), lang)})` : ''}</td></tr>
              <tr><th scope="row">{t('metrics.earthWindows')}</th><td>{m.earthWindows.length} · {t('metrics.longest')} {fmtHours(m.longestEarth?.hours ?? 0, lang)} · {fmtNum(m.earthFrac * 100, lang, 0)} %</td></tr>
              <tr><th scope="row">{t('metrics.score')}</th><td>{fmtNum(m.score, lang, 1)} / 100 ({view.wEnergy} / {100 - view.wEnergy})</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h2>{t('thr.title')}</h2>
          <ul className="plain">
            {v.map((x) => (
              <li key={x.key}><strong>{t(`thr.${x.key}`)}</strong> : {fmtNum(x.value, lang, 1)} {t(`thr.cmp_${x.key}`)} {fmtNum(x.threshold, lang, 1)} — <Badge ok={x.ok} /></li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{t('assump.title')}</h2>
          <p className="small">{t('assump.dataText', { v: idx.script_version, date: idx.generated.slice(0, 10), frame: idx.frame, ab: idx.abcorr, step: idx.step_s / 60 })} {data.relief ? t('assump.reliefYes', { res: idx.horizon.resolution_m ?? '?' }) : t('assump.reliefNo')} {t('assump.optionsText', { days: fmtNum(view.days, lang, 2), limb: view.limb ? t('common.yes') : t('common.no'), e: view.wEnergy, c: 100 - view.wEnergy })}</p>
          {idx.provisional && <p className="alert warn small">{t('assump.provisional')}</p>}
        </section>
        <section>
          <h2>{t('help.sources')}</h2>
          <ul className="small plain">
            {cfg.sources.filter((s) => s.categorie === 'donnees').map((s) => <li key={s.id}>{s.titre} — {s.version} — {s.licence} — <span className="url">{s.url}</span></li>)}
          </ul>
        </section>
        <section>
          <h2><label htmlFor="notes">{t('recap.notes')}</label></h2>
          <textarea id="notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('recap.notesHint')} className="no-print-border" />
          <p className="muted small no-print">{t('recap.notesLocal')}</p>
        </section>
      </div>
    </Page>
  )
}
