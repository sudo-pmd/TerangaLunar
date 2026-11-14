import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/AppContext'
import { fmtDate, fmtHours, fmtNum, fmtSigned } from '../lib/format'
import { comparePlans, computeMetrics, metricValues, type DateScore, type Ranked, type Verdict } from '../lib/metrics'
import { allRespected, indexToMs } from '../lib/metrics'
import type { Metrics, SiteData, Site, Thresholds, Visibility } from '../lib/types'

// ---- Tableau 1 : comparaison de sites / plans (F-30, F-31, F-53) ----------------------------------
export interface PlanCol { key: string; label: string; sub: string; data: SiteData; metrics: Metrics; verdicts: Verdict[] }

export function Badge({ ok }: { ok: boolean }) {
  const { t } = useTranslation()
  return <span className={`badge ${ok ? 'ok' : 'ko'}`}><span aria-hidden="true">{ok ? '✓' : '✕'}</span> {ok ? t('verdict.ok') : t('verdict.ko')}</span>
}

export function ComparisonTable({ cols }: { cols: PlanCol[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const ref = cols[0]
  const delta = (c: PlanCol, k: keyof ReturnType<typeof comparePlans>, unit: string, digits = 1): ReactNode =>
    c === ref ? null : <span className="delta">{t('compare.delta')} {fmtSigned(comparePlans(ref.metrics, c.metrics)[k], lang, digits)}{unit}</span>
  const rows: { th: ReactNode; cell: (c: PlanCol) => ReactNode }[] = [
    { th: t('metrics.sun'), cell: (c) => <><strong>{fmtNum(metricValues(c.metrics).sunPct, lang, 1)} %</strong>{delta(c, 'sunPct', ' pts')}</> },
    { th: t('metrics.night'), cell: (c) => <><strong>{fmtHours(metricValues(c.metrics).nightH, lang)}</strong>{delta(c, 'nightH', ' h', 0)}</> },
    { th: t('metrics.nightStart'), cell: (c) => (c.metrics.longestNight && c.metrics.longestNight.hours > 0 ? fmtDate(indexToMs(c.data, c.metrics.longestNight.start), lang) : '—') },
    { th: t('metrics.earthWindows'), cell: (c) => <><strong>{c.metrics.earthWindows.length}</strong> · {t('metrics.longest')} {fmtHours(metricValues(c.metrics).earthH, lang)}{delta(c, 'earthH', ' h', 0)}</> },
    { th: t('metrics.earthShare'), cell: (c) => <><strong>{fmtNum(metricValues(c.metrics).earthPct, lang, 1)} %</strong>{delta(c, 'earthPct', ' pts')}</> },
    { th: t('metrics.score'), cell: (c) => <><strong>{fmtNum(c.metrics.score, lang, 1)} / 100</strong>{delta(c, 'score', '')}</> },
    { th: t('metrics.verdict'), cell: (c) => <><Badge ok={allRespected(c.verdicts)} /><span className="small muted"> {c.verdicts.filter((v) => v.ok).length}/{c.verdicts.length}</span></> },
  ]
  return (
    <div className="scroll table-wrap" id="compare-table">
      <table className="data compare">
        <caption>{t('compare.caption')}</caption>
        <thead>
          <tr>
            <td />
            {cols.map((c, i) => (
              <th key={c.key} scope="col">
                {c.label}<br /><span className="muted small">{c.sub}</span>
                {i === 0 && <><br /><span className="chip">{t('compare.reference')}</span></>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><th scope="row">{r.th}</th>{cols.map((c) => <td key={c.key}>{r.cell(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Tableau 2 : classement des sites (F-32, F-55) ------------------------------------------------
type SortKey = 'rank' | 'site' | 'mission' | 'sun' | 'night' | 'earth' | 'score'

export function RankingTable({ rows, siteById, onChoose, currentId }: { rows: Ranked[]; siteById: Map<string, Site>; onChoose: (id: string) => void; currentId?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'rank', dir: 1 })
  const ranked = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1 })), [rows])
  const val = (r: (typeof ranked)[number], k: SortKey): number | string => {
    const s = siteById.get(r.site)
    switch (k) {
      case 'rank': return r.rank
      case 'site': return s?.nom ?? r.site
      case 'mission': return s?.mission ?? ''
      case 'sun': return r.metrics.sunFrac
      case 'night': return r.metrics.longestNight?.hours ?? 0
      case 'earth': return r.metrics.longestEarth?.hours ?? 0
      case 'score': return r.metrics.score
    }
  }
  const sorted = [...ranked].sort((a, b) => {
    const x = val(a, sort.k), y = val(b, sort.k)
    return (typeof x === 'string' ? x.localeCompare(y as string, lang) : (x as number) - (y as number)) * sort.dir
  })
  const th = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : k === 'score' || k === 'sun' || k === 'earth' ? -1 : 1 }))}>
        {label} <span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
  return (
    <div className="scroll table-wrap">
      <table className="data">
        <caption>{t('rank.caption')}</caption>
        <thead><tr>{th('rank', t('rank.rank'))}{th('site', t('rank.site'))}{th('mission', t('rank.mission'))}{th('sun', t('metrics.sun'))}{th('night', t('metrics.night'))}{th('earth', t('rank.earthWindow'))}{th('score', t('metrics.score'))}<td /></tr></thead>
        <tbody>
          {sorted.map((r) => {
            const s = siteById.get(r.site)
            return (
              <tr key={r.site} className={r.site === currentId ? 'current' : ''}>
                <td>{r.rank}</td>
                <th scope="row">{s?.nom ?? r.site}</th>
                <td>{s?.mission}</td>
                <td>{fmtNum(r.metrics.sunFrac * 100, lang, 0)} %</td>
                <td>{fmtHours(r.metrics.longestNight?.hours ?? 0, lang)}</td>
                <td>{fmtHours(r.metrics.longestEarth?.hours ?? 0, lang)}</td>
                <td><strong>{fmtNum(r.metrics.score, lang, 1)}</strong></td>
                <td><button type="button" className="btn small" onClick={() => onChoose(r.site)} aria-label={t('rank.chooseAria', { site: s?.nom ?? r.site })}>{t('rank.choose')}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- Tableau 3 : cinq meilleures dates (F-52) -------------------------------------------------------
export function BestDatesTable({ top, data, vis, days, wEnergy, onUse, selectedMs }: {
  top: DateScore[]; data: SiteData; vis: Visibility; days: number; wEnergy: number; onUse: (ms: number) => void; selectedMs: number
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const len = Math.round((days * 24) / data.stepH)
  return (
    <div className="scroll table-wrap">
      <table className="data">
        <caption>{t('best.caption')}</caption>
        <thead><tr><th scope="col">{t('rank.rank')}</th><th scope="col">{t('best.date')}</th><th scope="col">{t('metrics.score')}</th><th scope="col">{t('metrics.sun')}</th><th scope="col">{t('metrics.night')}</th><td /></tr></thead>
        <tbody>
          {top.map((s, i) => {
            const m = computeMetrics(data, vis, s.idx, s.idx + len, wEnergy)
            return (
              <tr key={s.idx} className={Math.abs(s.ms - selectedMs) < 43200000 ? 'current' : ''}>
                <td>{i + 1}</td>
                <th scope="row">{fmtDate(s.ms, lang)}</th>
                <td><strong>{fmtNum(s.score, lang, 1)}</strong></td>
                <td>{fmtNum(s.sunFrac * 100, lang, 0)} %</td>
                <td>{fmtHours(m.longestNight?.hours ?? 0, lang)}</td>
                <td><button type="button" className="btn small" onClick={() => onUse(s.ms)}>{t('best.use')}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- Tableau 4 : respect des seuils (F-54) ----------------------------------------------------------
export function ThresholdTable({ cols, thr, onChange }: { cols: { key: string; label: string; verdicts: Verdict[] }[]; thr: Thresholds; onChange: (t: Thresholds) => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const rows = [
    { key: 'sun' as const, field: 'ensoleillement_min' as const, label: t('thr.sun'), unit: '%', fmt: (v: number) => `${fmtNum(v, lang, 1)} %`, cmp: '≥' },
    { key: 'night' as const, field: 'nuit_max_jours' as const, label: t('thr.night'), unit: t('thr.days'), fmt: (v: number) => `${fmtNum(v, lang, 1)} ${t('thr.days')}`, cmp: '<' },
    { key: 'earth' as const, field: 'fenetre_terre_min_heures' as const, label: t('thr.earth'), unit: 'h', fmt: (v: number) => fmtHours(v, lang), cmp: '≥' },
  ]
  return (
    <div className="scroll table-wrap">
      <table className="data">
        <caption>{t('thr.caption')}</caption>
        <thead>
          <tr><th scope="col">{t('thr.criterion')}</th><th scope="col">{t('thr.threshold')}</th>{cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>
                <label className="inline-label">
                  <span className="sr-only">{t('thr.edit', { c: r.label })}</span>
                  <span aria-hidden="true">{r.cmp}</span>
                  <input type="number" min={0} step={r.key === 'night' ? 0.5 : 1} value={thr[r.field]} className="narrow"
                    onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) onChange({ ...thr, [r.field]: v }) }} />
                  <span className="muted">{r.unit}</span>
                </label>
              </td>
              {cols.map((c) => {
                const v = c.verdicts.find((x) => x.key === r.key)!
                return <td key={c.key}><span className="vlabel">{r.fmt(v.value)}</span> <Badge ok={v.ok} /></td>
              })}
            </tr>
          ))}
          <tr className="total">
            <th scope="row">{t('metrics.verdict')}</th><td />
            {cols.map((c) => <td key={c.key}><Badge ok={allRespected(c.verdicts)} /></td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---- Tableau 5 : sources (F-81, NF-07) ---------------------------------------------------------------
export function SourcesTable() {
  const { cfg } = useApp()
  const { t } = useTranslation()
  return (
    <div className="scroll table-wrap">
      <table className="data">
        <caption>{t('sources.caption')}</caption>
        <thead><tr><th scope="col">{t('sources.resource')}</th><th scope="col">{t('sources.version')}</th><th scope="col">{t('sources.link')}</th><th scope="col">{t('sources.license')}</th><th scope="col">{t('sources.date')}</th></tr></thead>
        <tbody>
          {cfg.sources.map((s) => (
            <tr key={s.id}>
              <th scope="row">{s.titre}</th>
              <td>{s.version}</td>
              <td><a href={s.url} target="_blank" rel="noopener noreferrer">{t('sources.open')}<span className="sr-only"> {s.titre}</span></a></td>
              <td>{s.licence}</td>
              <td>{s.consulte_le}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
