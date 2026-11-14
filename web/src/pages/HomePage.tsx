import { lazy, Suspense, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DatePicker, ProfileToggle, StayPicker, VLink, fmtLat, fmtLon, useSiteNote } from '../components/common'
import { useApp } from '../state/AppContext'
import { useReducedMotion, useView } from '../state/hooks'

const MoonScene = lazy(() => import('../components/MoonScene'))

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { cfg, availableSites, hasData } = useApp()
  const { view, setView, search } = useView()
  const nav = useNavigate()
  const reduced = useReducedMotion()
  const note = useSiteNote()
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState('')
  const lang = i18n.language

  const companies = useMemo(() => [...new Set(cfg.sites.filter((s) => s.type === 'clps').map((s) => s.entreprise))].sort(), [cfg.sites])
  const years = useMemo(() => [...new Set(cfg.sites.map((s) => s.date_cible?.match(/\d{4}/)?.[0]).filter(Boolean) as string[])].sort(), [cfg.sites])
  const filtered = cfg.sites.filter((s) =>
    (!company || s.entreprise === company) && (!status || s.statut === status) && (!year || s.date_cible?.includes(year)))
  const selected = cfg.sites.find((s) => s.id === view.site)

  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-h">
        <div className="moon-stage">
          <Suspense fallback={<div className="moon-loading" role="status">{t('boot.loading')}</div>}>
            <MoonScene sites={filtered.filter((s) => hasData(s.id))} selected={view.site} onSelect={(id) => setView({ site: id })} reduced={reduced} />
          </Suspense>
        </div>
        <div className="hero-text container">
          <h1 id="home-h">{t('home.title')}</h1>
          <p className="lead">{t('home.tagline')}</p>
          <p className="small muted">{t('home.hint')}</p>
        </div>
      </section>

      <div className="container page">
        <section aria-labelledby="filters-h" className="panel">
          <h2 id="filters-h">{t('home.filters')}</h2>
          <div className="grid-fields">
            <div className="field">
              <label htmlFor="f-company">{t('home.company')}</label>
              <select id="f-company" value={company} onChange={(e) => setCompany(e.target.value)}>
                <option value="">{t('home.all')}</option>
                {companies.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-status">{t('home.status')}</label>
              <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('home.all')}</option>
                {['atterrie', 'planifiee', 'reference'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-year">{t('home.year')}</label>
              <select id="f-year" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">{t('home.all')}</option>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </section>

        <div className="split">
          <section aria-labelledby="sites-h">
            <h2 id="sites-h">{t('home.sites', { count: filtered.length })}</h2>
            <ul className="site-list">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`site-item ${s.id === view.site ? 'on' : ''}`} aria-pressed={s.id === view.site}
                    disabled={!hasData(s.id)} onClick={() => setView({ site: s.id })}>
                    <span className="si-name">{s.nom}</span>
                    <span className="si-sub">{s.mission} · {s.entreprise}</span>
                    <span className={`chip st-${s.statut}`}>{t(`status.${s.statut}`, s.statut)}</span>
                  </button>
                </li>
              ))}
              {!filtered.length && <li className="muted">{t('home.none')}</li>}
            </ul>
          </section>

          <section aria-labelledby="card-h" className="panel mission-card">
            <h2 id="card-h">{t('home.card')}</h2>
            {selected ? (
              <>
                <h3>{selected.nom}</h3>
                <p>{selected.mission} · {selected.entreprise}</p>
                <dl className="dl">
                  <dt>{t('site.status')}</dt><dd>{t(`status.${selected.statut}`, selected.statut)}{selected.date_cible ? ` (${selected.date_cible})` : ''}</dd>
                  <dt>{t('site.coords')}</dt><dd>{fmtLat(selected.lat, lang)} · {fmtLon(selected.lon, lang)}</dd>
                  <dt>{t('site.source')}</dt><dd><a href={selected.source} target="_blank" rel="noopener noreferrer">{t('sources.open')}</a></dd>
                </dl>
                {selected.coord_statut === 'approx' && <p className="alert warn small">{t('site.approx')}</p>}
                {note(selected) && <p className="small muted">{note(selected)}</p>}
              </>
            ) : <p className="muted">{t('home.pick')}</p>}
          </section>
        </div>

        <section aria-labelledby="plan-h" className="panel">
          <h2 id="plan-h">{t('home.plan')}</h2>
          <div className="grid-fields">
            <DatePicker ms={view.landingMs} onChange={(ms) => setView({ landingMs: ms, cursorMs: null })} />
            <StayPicker days={view.days} onChange={(days) => setView({ days })} />
            <ProfileToggle value={view.profile} onChange={(profile) => setView({ profile })} />
          </div>
          <p className="actions">
            <button type="button" className="btn primary big" disabled={!selected || !hasData(view.site)} onClick={() => nav({ pathname: '/site', search })}>{t('home.explore')}</button>
            <VLink to="/decouvrir" className="btn">{t('home.discover')}</VLink>
            <VLink to="/dates" className="btn">{t('nav.dates')}</VLink>
            <VLink to="/comparer" className="btn">{t('nav.compare')}</VLink>
          </p>
          {availableSites.length === 0 && <p className="alert warn">{t('home.nodata')}</p>}
        </section>
      </div>
    </div>
  )
}
