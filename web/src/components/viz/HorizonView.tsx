import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtNum } from '../../lib/format'
import type { SiteData, Visibility } from '../../lib/types'

const R = 100
const rad = (d: number) => (d * Math.PI) / 180
const pt = (az: number, el: number) => {
  const r = ((90 - el) / 90) * R
  return [r * Math.sin(rad(az)), -r * Math.cos(rad(az))]
}
const f = (n: number) => n.toFixed(2)

export type BodyState = 'visible' | 'masked' | 'below'
export const bodyState = (el: number, vis: number): BodyState => (vis ? 'visible' : el > 0 ? 'masked' : 'below')

/** Vue circulaire de l'horizon (F-10, F-11) : centre = zénith, bord = horizon, nord en haut, est à droite. */
export default function HorizonView({ data, vis, idx }: { data: SiteData; vis: Visibility; idx: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const uid = useId().replace(/:/g, '')
  const sunEl = data.sunEl[idx], sunAz = data.sunAz[idx]
  const earthEl = data.earthEl[idx], earthAz = data.earthAz[idx]
  const sunS = bodyState(sunEl, vis.sun[idx]), earthS = bodyState(earthEl, vis.earth[idx])

  const M = data.mask.length
  const maskPts = Array.from({ length: M }, (_, i) => pt((i * 360) / M, data.mask[i]))
  const maskPath = 'M' + maskPts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z'
  const outer = `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}Z`
  const hasRelief = data.mask.some((m) => m > 0.05)

  // trace du Soleil sur 24 h
  const per = Math.max(1, Math.round(1 / data.stepH))
  let trace = ''
  let pen = false
  for (let k = 0; k <= 24; k++) {
    const i = idx + k * per
    if (i >= data.n) break
    if (data.sunEl[i] < -12) { pen = false; continue }
    const [x, y] = pt(data.sunAz[i], Math.max(data.sunEl[i], -12))
    trace += `${pen ? 'L' : 'M'}${f(x)} ${f(y)}`
    pen = true
  }

  const [sx, sy] = pt(sunAz, Math.max(sunEl, -12))
  const [ex, ey] = pt(earthAz, Math.max(earthEl, -12))
  const stateText = (n: string, el: number, az: number, s: BodyState) =>
    `${n} : ${t('horizon.elev')} ${fmtNum(el, lang, 1)}°, ${t('horizon.az')} ${fmtNum(az, lang, 0)}° (${t(`horizon.state_${s}`)})`
  const summary = `${stateText(t('horizon.sun'), sunEl, sunAz, sunS)}. ${stateText(t('horizon.earth'), earthEl, earthAz, earthS)}.`

  return (
    <figure className="horizon">
      <svg viewBox="-125 -125 250 250" role="img" aria-labelledby={`${uid}t ${uid}d`}>
        <title id={`${uid}t`}>{t('horizon.title')}</title>
        <desc id={`${uid}d`}>{t('horizon.desc')}</desc>
        <defs>
          <pattern id={`${uid}r`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" className="relief-bg" />
            <line x1="0" y1="0" x2="0" y2="5" className="relief-line" strokeWidth="1.6" />
          </pattern>
        </defs>
        <circle r={R} className="sky" />
        {[15, 30, 60].map((e) => (
          <g key={e}>
            <circle r={((90 - e) / 90) * R} className="ring" />
            <text x="2" y={-((90 - e) / 90) * R + 7} className="ring-label">{e}°</text>
          </g>
        ))}
        <line x1={-R} y1="0" x2={R} y2="0" className="ring" />
        <line x1="0" y1={-R} x2="0" y2={R} className="ring" />
        <path d={`${outer}${maskPath}`} fillRule="evenodd" fill={`url(#${uid}r)`} className="relief" />
        <circle r={R} className="rim" />
        {(['N', 'E', 'S', 'W'] as const).map((c, i) => {
          const [x, y] = pt(i * 90, -17)
          return <text key={c} x={x} y={y + 4} className="cardinal" textAnchor="middle">{t(`horizon.card_${c}`)}</text>
        })}
        {trace && <path d={trace} className="trace" />}
        {/* Terre */}
        <g transform={`translate(${f(ex)} ${f(ey)})`} className={`body earth ${earthS}`}>
          <circle r="6.5" className="earth-disc" />
          <circle r="9.5" className="earth-ring" />
          <text x="12" y="-9" className="body-label">{t('horizon.earth')}</text>
        </g>
        {/* Soleil */}
        <g transform={`translate(${f(sx)} ${f(sy)})`} className={`body sun ${sunS}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1="0" y1="-9" x2="0" y2="-13" transform={`rotate(${i * 45})`} className="sun-ray" />
          ))}
          <circle r="6.5" className="sun-disc" />
          <text x="12" y="-9" className="body-label">{t('horizon.sun')}</text>
        </g>
      </svg>
      <figcaption>
        <p aria-live="polite" className="small">{summary}</p>
        <p className="muted small">{hasRelief ? t('horizon.reliefOn') : t('horizon.reliefOff')}</p>
      </figcaption>
    </figure>
  )
}
