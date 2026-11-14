import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtNum } from '../../lib/format'

export interface Series { label: string; values: ArrayLike<number>; cls: 'a' | 'b' }

/** Élévation du Soleil au fil du temps pour 1 ou 2 sites (mode Découvrir). `cursor` = indice relatif. */
export default function ElevationChart({ series, stepH, cursor, ariaLabel }: { series: Series[]; stepH: number; cursor: number; ariaLabel: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const uid = useId().replace(/:/g, '')
  const n = Math.min(...series.map((s) => s.values.length))
  const W = 640, H = 220, L = 38, B = 28, T = 10, R = 8
  const maxV = Math.max(5, ...series.map((s) => { let m = -90; for (let i = 0; i < n; i++) m = Math.max(m, s.values[i]); return m }))
  const yMax = maxV > 20 ? Math.ceil(maxV / 30) * 30 : Math.ceil(maxV / 5) * 5
  const yMin = -Math.min(10, yMax / 3)
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R)
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B)
  const path = (s: Series) => {
    let d = ''
    for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.values[i]).toFixed(1)}`
    return d
  }
  const days = (n * stepH) / 24
  const ticks = Array.from({ length: Math.floor(days / 10) + 1 }, (_, k) => k * 10)
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
        <defs><clipPath id={`${uid}c`}><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
        <rect x={L} y={y(0)} width={W - L - R} height={H - B - y(0)} className="below-zero" />
        {[yMin, 0, yMax / 2, yMax].map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'zero' : 'grid'} />
            <text x={L - 4} y={y(v) + 3} textAnchor="end" className="tick-label">{fmtNum(v, lang, 0)}°</text>
          </g>
        ))}
        <text x={W - R} y={y(0) - 4} textAnchor="end" className="tl-note">{t('chart.horizon')}</text>
        {ticks.map((d) => (
          <text key={d} x={x((d * 24) / stepH)} y={H - 10} textAnchor="middle" className="tick-label">{t('chart.day', { d })}</text>
        ))}
        <g clipPath={`url(#${uid}c)`}>
          {series.map((s) => <path key={s.label} d={path(s)} className={`el-line ${s.cls}`} />)}
        </g>
        <line x1={x(cursor)} x2={x(cursor)} y1={T} y2={H - B} className="cursor" />
        {series.map((s) => <circle key={s.label} cx={x(cursor)} cy={y(s.values[cursor] ?? 0)} r="4.5" className={`el-dot ${s.cls}`} />)}
      </svg>
      <figcaption>
        <ul className="legend">
          {series.map((s) => (
            <li key={s.label}><svg width="26" height="10" aria-hidden="true"><line x1="0" x2="26" y1="5" y2="5" className={`el-line ${s.cls}`} /></svg>{s.label} : <strong>{fmtNum(s.values[cursor] ?? 0, lang, 1)}°</strong></li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
