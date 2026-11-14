import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, type LinkProps } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from '../state/AppContext'
import { fmtDate, fmtNum } from '../lib/format'
import { fromIso, toIso, type ViewState } from '../lib/urlState'
import type { Profile, Site } from '../lib/types'

// ---- liens qui conservent la vue (état dans l'URL) ----------------------------------------------
export function VLink({ to, ...rest }: LinkProps & { to: string }) {
  const { search } = useLocation()
  return <Link to={{ pathname: to, search }} {...rest} />
}
export function VNavLink({ to, children }: { to: string; children: ReactNode }) {
  const { search } = useLocation()
  return <NavLink to={{ pathname: to, search }} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>{children}</NavLink>
}

// ---- glossaire : infobulles accessibles au clavier (F-72) -----------------------------------------
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const { glossary } = useApp()
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const id = useId()
  const g = glossary[k]
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr'
  if (!g) return <>{children ?? k}</>
  return (
    <span className="term-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button" className="term" aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {children ?? g[lang]}
      </button>
      {open && <span role="tooltip" id={id} className="tooltip">{lang === 'en' ? g.def_en : g.def_fr}</span>}
    </span>
  )
}

// ---- affichage d'un site ---------------------------------------------------------------------------
export const fmtLat = (x: number, lang: string) => `${fmtNum(Math.abs(x), lang, 2)}° ${x < 0 ? 'S' : 'N'}`
export const fmtLon = (x: number, lang: string) => `${fmtNum(Math.abs(x), lang, 2)}° ${x < 0 ? (lang.startsWith('en') ? 'W' : 'O') : 'E'}`

export function useSiteNote() {
  const { i18n } = useTranslation()
  return (s: Site) => (i18n.language.startsWith('en') ? s.note_en : s.note_fr) ?? ''
}

export function SiteSelect({ value, onChange, label, id }: { value: string; onChange: (id: string) => void; label?: string; id?: string }) {
  const { cfg, hasData } = useApp()
  const { t } = useTranslation()
  const uid = useId()
  const sid = id ?? uid
  return (
    <div className="field">
      <label htmlFor={sid}>{label ?? t('controls.site')}</label>
      <select id={sid} value={value} onChange={(e) => onChange(e.target.value)}>
        {cfg.sites.map((s) => (
          <option key={s.id} value={s.id} disabled={!hasData(s.id)}>
            {s.nom} · {s.mission}{hasData(s.id) ? '' : ` (${t('controls.noData')})`}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---- date et heure (F-03) ---------------------------------------------------------------------------
export function DatePicker({ ms, onChange, label, id }: { ms: number; onChange: (ms: number) => void; label?: string; id?: string }) {
  const { cfg } = useApp()
  const { t, i18n } = useTranslation()
  const uid = useId()
  const sid = id ?? uid
  const minMs = Date.parse(cfg.index.start)
  const maxMs = minMs + (cfg.index.n - 1) * cfg.index.step_s * 1000
  const days = Math.floor((maxMs - minMs) / 86400000)
  const tod = (((ms - minMs) % 86400000) + 86400000) % 86400000
  const dayIdx = Math.floor((ms - minMs) / 86400000)
  return (
    <div className="field">
      <label htmlFor={sid}>{label ?? t('controls.date')} <span className="muted">(UTC)</span></label>
      <input
        id={sid} type="datetime-local" step={3600} min={toIso(minMs)} max={toIso(maxMs)} value={toIso(ms)}
        onChange={(e) => { const v = fromIso(e.target.value); if (v !== null && v >= minMs && v <= maxMs) onChange(v) }}
      />
      <input
        type="range" min={0} max={days} step={1} value={Math.min(Math.max(dayIdx, 0), days)}
        aria-label={t('controls.dateSlider')} aria-valuetext={fmtDate(ms, i18n.language)}
        onChange={(e) => onChange(minMs + Number(e.target.value) * 86400000 + tod)}
      />
    </div>
  )
}

// ---- durée du séjour (F-50) ---------------------------------------------------------------------------
const PRESETS = [7, 14, 29.53]
export function StayPicker({ days, onChange, id }: { days: number; onChange: (d: number) => void; id?: string }) {
  const { t } = useTranslation()
  const uid = useId()
  const sid = id ?? uid
  const preset = PRESETS.includes(days) ? String(days) : 'custom'
  return (
    <div className="field">
      <label htmlFor={sid}>{t('controls.stay')}</label>
      <div className="row">
        <select id={sid} value={preset} onChange={(e) => e.target.value !== 'custom' && onChange(Number(e.target.value))}>
          <option value="7">{t('controls.stay7')}</option>
          <option value="14">{t('controls.stay14')}</option>
          <option value="29.53">{t('controls.stayLunar')}</option>
          <option value="custom">{t('controls.stayCustom')}</option>
        </select>
        {preset === 'custom' && (
          <input type="number" min={1} max={365} step={1} value={days} aria-label={t('controls.stayDays')} className="narrow"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 365) onChange(v) }} />
        )}
      </div>
    </div>
  )
}

export function ProfileToggle({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className="field segmented">
      <legend>{t('controls.profile')}</legend>
      <div role="radiogroup" className="seg">
        {(['eng', 'sci'] as const).map((p) => (
          <label key={p} className={value === p ? 'on' : ''}>
            <input type="radio" name={name} checked={value === p} onChange={() => onChange(p)} />
            {t(`controls.profile_${p}`)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function LimbToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{t('controls.limb')}</span>
    </label>
  )
}

export function ScoreSlider({ value, onChange }: { value: number; onChange: (w: number) => void }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{t('controls.weights')}</label>
      <input id={id} type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={t('controls.weightsText', { e: value, c: 100 - value })} />
      <div className="muted small">{t('controls.weightsText', { e: value, c: 100 - value })}</div>
    </div>
  )
}

// ---- décalage de date en un clic (F-51) -----------------------------------------------------------------
export function ShiftButtons({ onShift, message }: { onShift: (delta: number) => void; message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="shift" role="group" aria-label={t('shift.group')}>
      {[-7, -1, 1, 7].map((d) => (
        <button key={d} type="button" className="btn" onClick={() => onShift(d)}
          aria-label={t('shift.aria', { d: `${d > 0 ? '+' : '−'}${Math.abs(d)}` })}>
          {d > 0 ? '+' : '−'}{Math.abs(d)} {t('shift.day', { count: Math.abs(d) })}
        </button>
      ))}
      <span className="muted small" role="status">{message}</span>
    </div>
  )
}

export function StatCard({ title, value, sub, tone, children }: { title: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'sun' | 'earth' | 'night' | 'score'; children?: ReactNode }) {
  return (
    <article className={`stat ${tone ?? ''}`}>
      <h3>{title}</h3>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
      {children}
    </article>
  )
}

// ---- lien partageable (F-61) ---------------------------------------------------------------------------
export function ShareButton() {
  const { t } = useTranslation()
  const [msg, setMsg] = useState('')
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const done = (m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(''), 4000) }
  const copy = async () => {
    const url = window.location.href
    try { await navigator.clipboard.writeText(url); done(t('share.copied')) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = url; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); done(t('share.copied')) } catch { done(t('share.manual', { url })) }
      ta.remove()
    }
  }
  return (
    <span className="share">
      <button type="button" className="btn" onClick={copy}>{t('share.button')}</button>
      <span role="status" className="muted small">{msg}</span>
    </span>
  )
}

// ---- encadré des hypothèses (F-62) ---------------------------------------------------------------------
export function AssumptionsBox({ view, relief }: { view: ViewState; relief: boolean }) {
  const { cfg } = useApp()
  const { t, i18n } = useTranslation()
  const idx = cfg.index
  const limits = t('assump.limits', { returnObjects: true }) as string[]
  return (
    <aside className="assump" aria-labelledby="assump-h">
      <h2 id="assump-h">{t('assump.title')}</h2>
      {idx.provisional && <p className="alert warn" role="note">{t('assump.provisional')}</p>}
      <dl>
        <dt>{t('assump.data')}</dt>
        <dd>{t('assump.dataText', { v: idx.script_version, date: idx.generated.slice(0, 10), frame: idx.frame, ab: idx.abcorr, step: idx.step_s / 60 })}</dd>
        <dt>{t('assump.range')}</dt>
        <dd>{fmtDate(Date.parse(idx.start), i18n.language, false)} → {fmtDate(Date.parse(idx.start) + idx.n * idx.step_s * 1000, i18n.language, false)}</dd>
        <dt>{t('assump.relief')}</dt>
        <dd>{relief ? t('assump.reliefYes', { res: idx.horizon.resolution_m ?? '?' }) : t('assump.reliefNo')}</dd>
        <dt>{t('assump.options')}</dt>
        <dd>{t('assump.optionsText', { days: fmtNum(view.days, i18n.language, 2), limb: view.limb ? t('common.yes') : t('common.no'), e: view.wEnergy, c: 100 - view.wEnergy })}</dd>
      </dl>
      <details>
        <summary>{t('assump.limitsTitle')}</summary>
        <ul>{limits.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </details>
    </aside>
  )
}

export function Loading({ what }: { what?: string }) {
  const { t } = useTranslation()
  return <p role="status" className="muted">{what ?? t('boot.loading')}</p>
}
