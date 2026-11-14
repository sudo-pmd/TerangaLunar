import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtDate, fmtHours, fmtNum, loc } from '../../lib/format'
import { computeMetrics, indexToMs, runs, stepsPerDay, sunSeries } from '../../lib/metrics'
import type { Metrics, SiteData, Visibility } from '../../lib/types'

export type Zoom = 'day' | 'month' | 'year'
const LEFT = 64, RIGHT = 10

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface Props {
  data: SiteData
  vis: Visibility
  cursor: number
  onCursor: (i: number) => void
  stay: { i0: number; i1: number }
  night: Metrics['longestNight']
  zoom: Zoom
  onZoom: (z: Zoom) => void
}

/** Frise du temps (F-12 à F-14) : Soleil jaune, Terre bleue, ombre grise ; trois niveaux de zoom. */
export default function Timeline({ data, vis, cursor, onCursor, stay, night, zoom, onZoom }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [wrapRef, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const n = data.n
  const len = zoom === 'day' ? Math.round(24 / data.stepH) : zoom === 'month' ? Math.round((30 * 24) / data.stepH) : n
  const w0 = zoom === 'year' ? 0 : Math.min(Math.max(cursor - Math.floor(len / 2), 0), n - len)
  const w1 = w0 + len
  const W = width - LEFT - RIGHT
  const x = (i: number) => LEFT + ((i - w0) / len) * W

  const sunRuns = useMemo(() => [runs(vis.sun, w0, w1, 1, data.stepH), runs(vis.sun, w0, w1, 0, data.stepH)], [vis, w0, w1, data.stepH])
  const earthRuns = useMemo(() => runs(vis.earth, w0, w1, 1, data.stepH), [vis, w0, w1, data.stepH])
  const detail = useMemo(() => computeMetrics(data, vis, w0, w1), [data, vis, w0, w1])
  const days = useMemo(() => sunSeries(data, vis, 0, n, 'day'), [data, vis, n])

  // graduations
  const ticks: { i: number; label: string; major?: boolean }[] = []
  const stepMs = data.stepS * 1000
  const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', ...o })
  const t0 = indexToMs(data, w0), t1 = indexToMs(data, w1)
  if (zoom === 'day') {
    for (let ms = Math.ceil(t0 / 10800000) * 10800000; ms < t1; ms += 10800000) {
      const midnight = ms % 86400000 === 0
      ticks.push({ i: (ms - data.startMs) / stepMs, label: midnight ? dtf({ day: 'numeric', month: 'short' }).format(ms) : dtf({ hour: '2-digit', minute: '2-digit' }).format(ms), major: midnight })
    }
  } else if (zoom === 'month') {
    const every = width < 520 ? 7 : 3
    for (let ms = Math.ceil(t0 / 86400000) * 86400000, k = 0; ms < t1; ms += 86400000, k++)
      if (k % every === 0) ticks.push({ i: (ms - data.startMs) / stepMs, label: dtf({ day: 'numeric', month: 'short' }).format(ms) })
  } else {
    const d = new Date(t0)
    for (let ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); ms < t1; ) {
      const dd = new Date(ms)
      const jan = dd.getUTCMonth() === 0
      if (width >= 520 || dd.getUTCMonth() % 3 === 0 || jan)
        ticks.push({ i: (ms - data.startMs) / stepMs, label: dtf(jan ? { month: 'short', year: '2-digit' } : { month: 'short' }).format(ms), major: jan })
      ms = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth() + 1, 1)
    }
  }

  const idxFromEvent = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    return Math.min(w1 - 1, Math.max(w0, Math.round(w0 + ((clientX - r.left - LEFT) / W) * len)))
  }
  const key = (e: KeyboardEvent) => {
    const perH = Math.max(1, Math.round(1 / data.stepH))
    const day = stepsPerDay(data)
    const m: Record<string, number> = { ArrowLeft: -perH, ArrowRight: perH, PageUp: -day, PageDown: day }
    if (e.key in m) onCursor(Math.min(n - 1, Math.max(0, cursor + m[e.key])))
    else if (e.key === 'Home') onCursor(stay.i0)
    else if (e.key === 'End') onCursor(Math.max(stay.i0, stay.i1 - 1))
    else return
    e.preventDefault()
  }

  const shown = hover ?? cursor
  const readout = `${fmtDate(indexToMs(data, shown), lang)} — ${t('horizon.sun')} : ${fmtNum(data.sunEl[shown], lang, 1)}° / ${fmtNum(data.sunAz[shown], lang, 0)}° (${vis.sun[shown] ? t('tl.visible') : t('tl.hidden')}) · ${t('horizon.earth')} : ${fmtNum(data.earthEl[shown], lang, 1)}° / ${fmtNum(data.earthAz[shown], lang, 0)}° (${vis.earth[shown] ? t('tl.visible') : t('tl.hidden')})`

  const clip = (a: number, b: number) => [Math.max(a, w0), Math.min(b, w1)] as const
  const [sac, sbc] = clip(stay.i0, stay.i1)
  const nightClip = night ? clip(night.start, night.end) : null
  const H = 142

  // mini-vue globale
  const ovH = 34
  const ovX = (i: number) => LEFT + (i / n) * W

  return (
    <section className="timeline" aria-label={t('tl.title')}>
      <div className="tl-top">
        <h2>{t('tl.title')}</h2>
        <div className="seg" role="group" aria-label={t('tl.zoom')}>
          {(['day', 'month', 'year'] as const).map((z) => (
            <button key={z} type="button" className={zoom === z ? 'on' : ''} aria-pressed={zoom === z} onClick={() => onZoom(z)}>{t(`tl.zoom_${z}`)}</button>
          ))}
        </div>
      </div>
      <div ref={wrapRef} className="tl-wrap" tabIndex={0} role="group" aria-label={t('tl.aria')} onKeyDown={key}>
        <svg width={width} height={H} className="tl-svg">
          <defs>
            <pattern id="tl-shadow" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className="shadow-bg" /><line x1="0" y1="0" x2="0" y2="6" className="shadow-line" strokeWidth="2" />
            </pattern>
            <pattern id="tl-earth" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" className="earth-bg" /><circle cx="3" cy="3" r="1.1" className="earth-dot" />
            </pattern>
          </defs>
          <text x="0" y="40" className="tl-label">{t('horizon.sun')}</text>
          <text x="0" y="92" className="tl-label">{t('horizon.earth')}</text>
          <rect x={LEFT} y="18" width={W} height="34" className="track" />
          <rect x={LEFT} y="62" width={W} height="34" className="track" />
          {sunRuns[0].map((r) => <rect key={`s${r.start}`} x={x(r.start)} y="18" width={Math.max(0.6, x(r.end) - x(r.start))} height="34" className="v-sun" />)}
          {sunRuns[1].map((r) => <rect key={`n${r.start}`} x={x(r.start)} y="18" width={Math.max(0.6, x(r.end) - x(r.start))} height="34" fill="url(#tl-shadow)" />)}
          {earthRuns.map((r) => <rect key={`e${r.start}`} x={x(r.start)} y="62" width={Math.max(0.6, x(r.end) - x(r.start))} height="34" fill="url(#tl-earth)" className="v-earth-edge" />)}
          {sbc > sac && (
            <g>
              <rect x={x(sac)} y="10" width={Math.max(1, x(sbc) - x(sac))} height="92" className="stay" />
              <text x={x(sac) + 3} y="8" className="tl-note">{t('tl.stay')}</text>
            </g>
          )}
          {stay.i0 >= w0 && stay.i0 < w1 && <line x1={x(stay.i0)} x2={x(stay.i0)} y1="10" y2="102" className="landing" />}
          {nightClip && nightClip[1] > nightClip[0] && (
            <g>
              <rect x={x(nightClip[0])} y="100" width={Math.max(2, x(nightClip[1]) - x(nightClip[0]))} height="5" className="night-mark" />
              <text x={x(nightClip[0])} y="116" className="tl-note">{t('tl.longestNight')} · {fmtHours(night!.hours, lang)}</text>
            </g>
          )}
          {ticks.map((k) => (
            <g key={k.i}>
              <line x1={x(k.i)} x2={x(k.i)} y1="96" y2={k.major ? 126 : 122} className="tick" />
              <text x={x(k.i)} y="137" textAnchor="middle" className="tick-label">{k.label}</text>
            </g>
          ))}
          {cursor >= w0 && cursor < w1 && <line x1={x(cursor)} x2={x(cursor)} y1="10" y2="102" className="cursor" />}
          {hover !== null && hover >= w0 && hover < w1 && <line x1={x(hover)} x2={x(hover)} y1="10" y2="102" className="hover-line" />}
          <rect x={LEFT} y="0" width={W} height="102" fill="transparent" className="tl-hit"
            onPointerMove={(e) => setHover(idxFromEvent(e.clientX, e.currentTarget.ownerSVGElement!))}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => setHover(idxFromEvent(e.clientX, e.currentTarget.ownerSVGElement!))}
            onClick={(e) => onCursor(idxFromEvent(e.clientX, e.currentTarget.ownerSVGElement!))} />
        </svg>
      </div>
      <p className="readout small" aria-live="polite">{readout}</p>

      <div className="tl-overview" aria-hidden="true">
        <svg width={width} height={ovH}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onCursor(Math.min(n - 1, Math.max(0, Math.round(((e.clientX - r.left - LEFT) / W) * n)))) }}>
          <text x="0" y="22" className="tl-label">{t('tl.overview')}</text>
          {days.map((d, k) => (
            <rect key={k} x={ovX(k * stepsPerDay(data))} y={ovH - 4 - d.frac * 24} width={Math.max(0.6, W / days.length)} height={d.frac * 24 + 1} className="ov-bar" />
          ))}
          <rect x={ovX(w0)} y="2" width={Math.max(2, ovX(w1) - ovX(w0))} height={ovH - 4} className="ov-win" />
          <rect x={ovX(stay.i0)} y={ovH - 3} width={Math.max(2, ovX(stay.i1) - ovX(stay.i0))} height="3" className="ov-stay" />
        </svg>
      </div>

      <p className="small detail">
        <strong>{t('tl.detail')}</strong> {fmtDate(indexToMs(data, w0), lang, zoom === 'day')} → {fmtDate(indexToMs(data, w1 - 1), lang, zoom === 'day')} · {t('tl.detailSun', { v: fmtNum(detail.sunFrac * 100, lang, 0) })} · {t('tl.detailEarth', { v: fmtNum(detail.earthFrac * 100, lang, 0) })}
      </p>
      <ul className="legend" aria-label={t('tl.legend')}>
        <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" className="v-sun" /></svg>{t('tl.legSun')}</li>
        <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" fill="url(#tl-shadow)" /></svg>{t('tl.legShadow')}</li>
        <li><svg width="22" height="14" aria-hidden="true"><rect width="22" height="14" fill="url(#tl-earth)" className="v-earth-edge" /></svg>{t('tl.legEarth')}</li>
      </ul>
    </section>
  )
}
