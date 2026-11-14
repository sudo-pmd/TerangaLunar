import { useTranslation } from 'react-i18next'
import { Page } from '../components/Layout'
import { SourcesTable } from '../components/tables'
import { useApp } from '../state/AppContext'

export default function HelpPage() {
  const { t, i18n } = useTranslation()
  const { cfg, glossary } = useApp()
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr'
  const steps = t('help.methodItems', { returnObjects: true }) as { h: string; p: string }[]
  const limits = t('assump.limits', { returnObjects: true }) as string[]
  const idx = cfg.index
  return (
    <Page title={t('help.title')} lead={t('help.lead')}>
      <div className="help-layout">
        <nav className="toc" aria-label={t('help.toc')}>
          <ul>
            <li><a href="#methode">{t('help.method')}</a></li>
            <li><a href="#limites">{t('help.limits')}</a></li>
            <li><a href="#glossaire">{t('help.glossary')}</a></li>
            <li><a href="#sources">{t('help.sources')}</a></li>
            <li><a href="#ajouter">{t('help.add')}</a></li>
          </ul>
        </nav>
        <div className="reading">
          <section id="methode">
            <h2>{t('help.method')}</h2>
            <dl className="dl wide">
              {steps.map((s) => <div key={s.h}><dt>{s.h}</dt><dd>{s.p}</dd></div>)}
            </dl>
          </section>
          <section id="limites">
            <h2>{t('help.limits')}</h2>
            <ul>{limits.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
          <section id="glossaire">
            <h2>{t('help.glossary')}</h2>
            <dl className="dl wide">
              {Object.entries(glossary).map(([k, g]) => <div key={k}><dt>{g[lang]}</dt><dd>{lang === 'en' ? g.def_en : g.def_fr}</dd></div>)}
            </dl>
          </section>
          <section id="sources">
            <h2>{t('help.sources')}</h2>
            <p className="small">{t('help.version', { v: idx.script_version, date: idx.generated.slice(0, 10), backend: idx.backend, kernels: idx.kernels.join(', ') })}</p>
            {idx.provisional && <p className="alert warn">{t('assump.provisional')}</p>}
            <SourcesTable />
          </section>
          <section id="ajouter">
            <h2>{t('help.add')}</h2>
            <p>{t('help.addText')}</p>
          </section>
        </div>
      </div>
    </Page>
  )
}
