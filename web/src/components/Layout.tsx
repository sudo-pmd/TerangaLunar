import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { VLink, VNavLink } from './common'

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14" fill="var(--moon)" />
      <circle cx="11" cy="12" r="3" fill="var(--moon-dark)" />
      <circle cx="21" cy="20" r="4" fill="var(--moon-dark)" />
      <circle cx="20" cy="9" r="1.8" fill="var(--moon-dark)" />
    </svg>
  )
}

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* ignoré */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

export function Header() {
  const { t, i18n } = useTranslation()
  const [theme, toggle] = useTheme()
  const en = i18n.language.startsWith('en')
  return (
    <header className="site-header">
      <div className="container bar">
        <VLink to="/" className="brand" aria-label={t('app.home')}>
          <Logo /> <span>{t('app.name')}</span>
        </VLink>
        <nav aria-label={t('nav.label')}>
          <ul>
            <li><VNavLink to="/">{t('nav.home')}</VNavLink></li>
            <li><VNavLink to="/site">{t('nav.site')}</VNavLink></li>
            <li><VNavLink to="/comparer">{t('nav.compare')}</VNavLink></li>
            <li><VNavLink to="/dates">{t('nav.dates')}</VNavLink></li>
            <li><VNavLink to="/decouvrir">{t('nav.discover')}</VNavLink></li>
            <li><VNavLink to="/aide">{t('nav.help')}</VNavLink></li>
          </ul>
        </nav>
        <div className="tools">
          <div role="group" aria-label={t('app.language')} className="langs">
            <button type="button" aria-pressed={!en} onClick={() => i18n.changeLanguage('fr')} lang="fr">FR</button>
            <button type="button" aria-pressed={en} onClick={() => i18n.changeLanguage('en')} lang="en">EN</button>
          </div>
          <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? t('app.toLight') : t('app.toDark')}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </div>
    </header>
  )
}

export function DataBanner() {
  const { cfg } = useApp()
  const { t } = useTranslation()
  const noRelief = !cfg.index.sites.some((s) => s.relief)
  if (!cfg.index.provisional && !noRelief) return null
  return (
    <div className="banner" role="status">
      <div className="container">
        <strong>{t('banner.title')}</strong>{' '}
        {cfg.index.provisional && t('banner.provisional')} {noRelief && t('banner.noRelief')}{' '}
        <VLink to="/aide">{t('banner.more')}</VLink>
      </div>
    </div>
  )
}

export function Footer() {
  const { cfg } = useApp()
  const { t } = useTranslation()
  return (
    <footer className="site-footer">
      <div className="container">
        <p>{t('footer.data', { v: cfg.index.script_version, date: cfg.index.generated.slice(0, 10) })} · <VLink to="/aide">{t('footer.sources')}</VLink></p>
        <p className="muted small">{t('footer.disclaimer')}</p>
      </div>
    </footer>
  )
}

export function Page({ title, lead, children, wide }: { title: string; lead?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => { document.title = `${title} · CLPS Lunar Mission Browser` }, [title])
  return (
    <div className={`container page ${wide ? 'wide' : ''}`}>
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </div>
  )
}

export function ScrollFocus() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('contenu')?.focus({ preventScroll: true })
  }, [pathname])
  return null
}
