import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { scaleLinear } from 'd3-scale'
import { fmtDate, fmtMonth, fmtNum } from '../../lib/format'
import type { DateScore } from '../../lib/metrics'

const LABEL = 62, CW = 22, CH = 20

/** Calendrier des meilleures dates en carte de chaleur (F-52). Couleur + motif + étoile sur le top 5. */
export default function HeatMap({ scores, top, startMs, selectedMs, onPick }: {
  scores: DateScore[]; top: DateScore[]; startMs: number; selectedMs: number; onPick: (ms: number) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const uid = useId().replace(/:/g, '')
  const [tip, setTip] = useState<{ s: DateScore; x: number; y: number } | null>(null)

  const { byDay, min, max, rows } = useMemo(() => {
    const byDay = new Map<number, DateScore>()
    let min = Infinity, max = -Infinity
    for (const s of scores) {
      byDay.set(Math.floor(s.ms / 86400000), s)
      min = Math.min(min, s.score); max = Math.max(max, s.score)
    }
    const d0 = new Date(startMs)
    const last = scores.length ? new Date(scores[scores.length - 1].ms) : d0
    const rows: number[] = []
    for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); ) {
      rows.push(Date.UTC(y, m, 1))
      if (++m > 11) { m = 0; y++ }
    }
    return { byDay, min, max, rows }
  }, [scores, startMs])

  if (!scores.length) return <p className="alert warn">{t('heat.empty')}</p>
  const color = scaleLinear<string>().domain([min, (min + max) / 2, max === min ? min + 1 : max]).range(['#22346a', '#5b86d6', '#ffd166']).clamp(true)
  const span = max - min || 1
  const bin = (v: number) => ((v - min) / span < 1 / 3 ? 0 : (v - min) / span < 2 / 3 ? 1 : 2)
  const topKeys = new Set(top.map((s) => Math.floor(s.ms / 86400000)))
  const W = LABEL + 31 * CW, H = rows.length * CH + 22

  return (
    <figure className="heat">
      <div className="scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 560 }} role="img" aria-label={t('heat.aria', { n: top.length })}>
          <defs>
            <pattern id={`${uid}h`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="hm-line" strokeWidth="1.6" /></pattern>
            <pattern id={`${uid}d`} width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" className="hm-dot" /></pattern>
          </defs>
          {Array.from({ length: 31 }, (_, d) => (d + 1) % 5 === 0 || d === 0 ? <text key={d} x={LABEL + d * CW + CW / 2} y="10" textAnchor="middle" className="tick-label">{d + 1}</text> : null)}
          {rows.map((m0, r) => {
            const dt = new Date(m0)
            const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
            return (
              <g key={m0} transform={`translate(0 ${r * CH + 16})`}>
                <text x={LABEL - 6} y={CH / 2 + 4} textAnchor="end" className="tick-label">{fmtMonth(m0, lang)}</text>
                {Array.from({ length: dim }, (_, d) => {
                  const day = Math.floor(m0 / 86400000) + d
                  const s = byDay.get(day)
                  const x = LABEL + d * CW
                  if (!s) return <rect key={d} x={x + 1} y={1} width={CW - 2} height={CH - 2} className="hm-empty" />
                  const isTop = topKeys.has(day)
                  const sel = Math.abs(s.ms - selectedMs) < 43200000
                  return (
                    <g key={d} className="hm-cell" onClick={() => onPick(s.ms)}
                      onPointerEnter={(e) => { const r2 = e.currentTarget.closest('figure')!.getBoundingClientRect(); setTip({ s, x: e.clientX - r2.left, y: e.clientY - r2.top }) }}
                      onPointerLeave={() => setTip(null)}>
                      <rect x={x + 1} y={1} width={CW - 2} height={CH - 2} fill={color(s.score)} />
                      {bin(s.score) === 0 && <rect x={x + 1} y={1} width={CW - 2} height={CH - 2} fill={`url(#${uid}h)`} />}
                      {bin(s.score) === 1 && <rect x={x + 1} y={1} width={CW - 2} height={CH - 2} fill={`url(#${uid}d)`} />}
                      {sel && <rect x={x + 0.5} y={0.5} width={CW - 1} height={CH - 1} className="hm-sel" />}
                      {isTop && <><rect x={x + 1} y={1} width={CW - 2} height={CH - 2} className="hm-top" /><text x={x + CW / 2} y={CH / 2 + 4} textAnchor="middle" className="hm-star">★</text></>}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 12, 260), top: tip.y + 12 }} role="status">
          <strong>{fmtDate(tip.s.ms, lang)}</strong><br />
          {t('heat.tipScore', { v: fmtNum(tip.s.score, lang, 1) })} · {t('heat.tipSun', { v: fmtNum(tip.s.sunFrac * 100, lang, 0) })} · {t('heat.tipEarth', { v: fmtNum(tip.s.earthFrac * 100, lang, 0) })}
        </div>
      )}
      <figcaption className="small">
        <ul className="legend">
          <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" fill={color(min)} /><rect width="22" height="14" fill={`url(#${uid}h)`} /></svg>{t('heat.low')} ({fmtNum(min, lang, 0)})</li>
          <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" fill={color((min + max) / 2)} /><rect width="22" height="14" fill={`url(#${uid}d)`} /></svg>{t('heat.mid')}</li>
          <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" fill={color(max)} /></svg>{t('heat.high')} ({fmtNum(max, lang, 0)})</li>
          <li><span className="star" aria-hidden="true">★</span> {t('heat.top')}</li>
        </ul>
        <p className="muted">{t('heat.note')}</p>
      </figcaption>
    </figure>
  )
}
