import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/Layout'
import { DatePicker, Loading, ScoreSlider, ShareButton, SiteSelect, StayPicker, LimbToggle } from '../components/common'
import { ComparisonTable, RankingTable, ThresholdTable, type PlanCol } from '../components/tables'
import { download, toCSV } from '../lib/csv'
import { computeVisibility } from '../lib/data'
import { fmtDate, fmtNum } from '../lib/format'
import { computeMetrics, endMs, metricValues, rankSites, stayRange, thresholdVerdicts } from '../lib/metrics'
import { useApp } from '../state/AppContext'
import { useAllData, useView } from '../state/hooks'

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { availableSites, siteById } = useApp()
  const { view, setView } = useView()
  const tableRef = useRef<HTMLDivElement>(null)
  const ids = useMemo(() => availableSites.map((s) => s.id), [availableSites])
  const all = useAllData(ids)
  const plans = view.plans

  const cols: PlanCol[] | null = useMemo(() => {
    if (!all) return null
    return plans.flatMap((p, i) => {
      const data = all.get(p.site)
      if (!data) return []
      const vis = computeVisibility(data, view.limb)
      const { i0, i1 } = stayRange(data, p.ms, view.days)
      const metrics = computeMetrics(data, vis, i0, i1, view.wEnergy)
      return [{ key: String(i), label: `${t('compare.plan')} ${String.fromCharCode(65 + i)} · ${siteById.get(p.site)?.nom ?? p.site}`, sub: fmtDate(p.ms, lang), data, metrics, verdicts: thresholdVerdicts(metrics, view.thr) }]
    })
  }, [all, plans, view.limb, view.days, view.wEnergy, view.thr, siteById, lang, t])

  const ranking = useMemo(
    () => (all ? rankSites([...all].map(([site, data]) => ({ site, data })), plans[0].ms, view.days, view.wEnergy, view.limb) : []),
    [all, plans, view.days, view.wEnergy, view.limb])

  const setPlan = (i: number, patch: Partial<(typeof plans)[number]>) =>
    setView({ plans: plans.map((p, k) => (k === i ? { ...p, ...patch } : p)) })

  const preset = (kind: 'sites' | 'dates') => {
    const first = plans[0]
    if (kind === 'sites') {
      const others = availableSites.filter((s) => s.id !== first.site).slice(0, 2)
      setView({ plans: [first, ...others.map((s) => ({ site: s.id, ms: first.ms }))] })
    } else {
      const data = all?.get(first.site)
      const max = data ? endMs(data) : first.ms + 30 * 86400000
      setView({ plans: [first, { site: first.site, ms: Math.min(first.ms + 10 * 86400000, max) }, { site: first.site, ms: Math.min(first.ms + 20 * 86400000, max) }].slice(0, 2) })
    }
  }

  const csv = () => {
    if (!cols) return
    const head = ['', ...cols.map((c) => `${c.label} (${c.sub})`)]
    const val = (f: (c: PlanCol) => string | number) => cols.map(f)
    const rows: (string | number)[][] = [
      head,
      [t('metrics.sun') + ' (%)', ...val((c) => +metricValues(c.metrics).sunPct.toFixed(2))],
      [t('metrics.night') + ' (h)', ...val((c) => metricValues(c.metrics).nightH)],
      [t('metrics.earthWindows'), ...val((c) => c.metrics.earthWindows.length)],
      [t('metrics.longest') + ' (h)', ...val((c) => metricValues(c.metrics).earthH)],
      [t('metrics.earthShare') + ' (%)', ...val((c) => +metricValues(c.metrics).earthPct.toFixed(2))],
      [t('metrics.score'), ...val((c) => +c.metrics.score.toFixed(2))],
      [t('metrics.verdict'), ...val((c) => (c.verdicts.every((v) => v.ok) ? t('verdict.ok') : t('verdict.ko')))],
      [],
      [t('rank.caption')],
      [t('rank.rank'), t('rank.site'), t('rank.mission'), t('metrics.sun') + ' (%)', t('metrics.night') + ' (h)', t('metrics.score')],
      ...ranking.map((r, i) => [i + 1, siteById.get(r.site)?.nom ?? r.site, siteById.get(r.site)?.mission ?? '', +(r.metrics.sunFrac * 100).toFixed(2), r.metrics.longestNight?.hours ?? 0, +r.metrics.score.toFixed(2)]),
      [],
      [t('assump.title'), t('assump.optionsText', { days: view.days, limb: view.limb ? t('common.yes') : t('common.no'), e: view.wEnergy, c: 100 - view.wEnergy })],
    ]
    download('comparaison-clps.csv', new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }))
  }
  const png = async () => {
    const el = tableRef.current
    if (!el) return
    const { default: html2canvas } = await import('html2canvas')
    const bg = getComputedStyle(document.body).backgroundColor
    const canvas = await html2canvas(el, { backgroundColor: bg, scale: 2 })
    canvas.toBlob((b) => b && download('comparaison-clps.png', b))
  }

  return (
    <Page title={t('compare.title')} lead={t('compare.lead')} wide>
      <section className="panel" aria-labelledby="plans-h">
        <h2 id="plans-h">{t('compare.plans')}</h2>
        <div className="plan-grid">
          {plans.map((p, i) => (
            <fieldset key={i} className="plan">
              <legend>{t('compare.plan')} {String.fromCharCode(65 + i)}{i === 0 ? ` (${t('compare.reference')})` : ''}</legend>
              <SiteSelect value={p.site} onChange={(site) => setPlan(i, { site })} />
              <DatePicker ms={p.ms} onChange={(ms) => setPlan(i, { ms })} />
              {plans.length > 2 && i > 0 && <button type="button" className="btn small" onClick={() => setView({ plans: plans.filter((_, k) => k !== i) })}>{t('compare.remove')}</button>}
            </fieldset>
          ))}
        </div>
        <div className="actions">
          {plans.length < 3 && <button type="button" className="btn" onClick={() => setView({ plans: [...plans, { site: plans[0].site, ms: plans[0].ms }] })}>{t('compare.add')}</button>}
          <button type="button" className="btn" onClick={() => preset('sites')}>{t('compare.presetSites')}</button>
          <button type="button" className="btn" onClick={() => preset('dates')}>{t('compare.presetDates')}</button>
        </div>
        <div className="grid-fields">
          <StayPicker days={view.days} onChange={(days) => setView({ days })} />
          <ScoreSlider value={view.wEnergy} onChange={(wEnergy) => setView({ wEnergy })} />
        </div>
        <LimbToggle value={view.limb} onChange={(limb) => setView({ limb })} />
      </section>

      {!cols ? <Loading /> : (
        <>
          <section aria-labelledby="t1-h">
            <h2 id="t1-h">{t('compare.table')}</h2>
            <div ref={tableRef}><ComparisonTable cols={cols} /></div>
            <p className="actions">
              <button type="button" className="btn" onClick={csv}>{t('compare.csv')}</button>
              <button type="button" className="btn" onClick={png}>{t('compare.png')}</button>
              <ShareButton />
            </p>
            <p className="muted small">{t('compare.deltaNote')}</p>
          </section>
          <section aria-labelledby="t4-h">
            <h2 id="t4-h">{t('thr.title')}</h2>
            <ThresholdTable cols={cols.map((c) => ({ key: c.key, label: c.label, verdicts: c.verdicts }))} thr={view.thr} onChange={(thr) => setView({ thr })} />
          </section>
          <section aria-labelledby="t2-h">
            <h2 id="t2-h">{t('rank.title', { date: fmtDate(plans[0].ms, lang), days: fmtNum(view.days, lang, 2) })}</h2>
            <RankingTable rows={ranking} siteById={siteById} currentId={plans[0].site} onChoose={(site) => setPlan(0, { site })} />
          </section>
        </>
      )}
    </Page>
  )
}
