import { useTranslation } from 'react-i18next'
import { fmtNum } from '../../lib/format'

export interface Bar { label: string; frac: number; title: string }

/** Part ensoleillée par jour ou par mois (F-20). Les valeurs sont écrites en clair. */
export default function BarChart({ bars, ariaLabel }: { bars: Bar[]; ariaLabel: string }) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const bw = bars.length > 40 ? 12 : 26
  const W = Math.max(320, bars.length * (bw + 6) + 40)
  const H = 170, base = 140, top = 14
  const every = bw < 14 ? 5 : bars.length > 14 ? 2 : 1
  return (
    <div className="scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: Math.min(W, 560) }} role="img" aria-label={ariaLabel}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1="30" x2={W} y1={base - (v / 100) * (base - top)} y2={base - (v / 100) * (base - top)} className="grid" />
            <text x="26" y={base - (v / 100) * (base - top) + 3} textAnchor="end" className="tick-label">{v}%</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = 36 + i * (bw + 6)
          const h = b.frac * (base - top)
          return (
            <g key={i}>
              <title>{b.title}</title>
              <rect x={x} y={base - h} width={bw} height={Math.max(h, 0.5)} className="v-sun" />
              {bw >= 20 && <text x={x + bw / 2} y={base - h - 3} textAnchor="middle" className="bar-val">{fmtNum(b.frac * 100, lang, 0)}</text>}
              {i % every === 0 && <text x={x + bw / 2} y={base + 13} textAnchor="middle" className="tick-label">{b.label}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
