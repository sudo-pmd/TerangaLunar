import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { DatePicker, LimbToggle, Loading, ScoreSlider, ShareButton, SiteSelect, StayPicker } from '../components/common'
import HeatMap from '../components/viz/HeatMap'
import { BestDatesTable, RankingTable } from '../components/tables'
import { fmtDate, fmtNum } from '../lib/format'
import { rankSites, scoreAllDates, topDates } from '../lib/metrics'
import { useApp } from '../state/AppContext'
import { useAllData, useSiteData, useVis, useView } from '../state/hooks'

/** Calendrier des meilleures dates (F-52) + classement de tous les sites pour la date choisie (F-55). */
export default function DatesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { availableSites, siteById, hasData } = useApp()
  const { view, setView, search } = useView()
  const nav = useNavigate()
  const { data, loading, error } = useSiteData(hasData(view.site) ? view.site : undefined)
  const vis = useVis(data, view.limb)
  const all = useAllData(useMemo(() => availableSites.map((s) => s.id), [availableSites]))

  const scores = useMemo(() => (data && vis ? scoreAllDates(data, vis, view.landingMs, view.days, view.wEnergy) : []), [data, vis, view.landingMs, view.days, view.wEnergy])
  const top = useMemo(() => topDates(scores), [scores])
  const ranking = useMemo(
    () => (all ? rankSites([...all].map(([site, d]) => ({ site, data: d })), view.landingMs, view.days, view.wEnergy, view.limb) : []),
    [all, view.landingMs, view.days, view.wEnergy, view.limb])

  return (
    <Page title={t('best.title')} lead={t('best.lead')} wide>
      <section className="panel" aria-labelledby="bd-h">
        <h2 id="bd-h">{t('best.settings')}</h2>
        <div className="grid-fields">
          <SiteSelect value={view.site} onChange={(site) => setView({ site })} />
          <StayPicker days={view.days} onChange={(days) => setView({ days })} />
          <ScoreSlider value={view.wEnergy} onChange={(wEnergy) => setView({ wEnergy })} />
          <DatePicker ms={view.landingMs} onChange={(ms) => setView({ landingMs: ms, cursorMs: null })} label={t('best.refDate')} />
        </div>
        <LimbToggle value={view.limb} onChange={(limb) => setView({ limb })} />
      </section>

      {error && <p className="alert warn" role="alert">{error}</p>}
      {loading && <Loading />}
      {data && vis && (
        <>
          <section aria-labelledby="hm-h">
            <h2 id="hm-h">{t('best.heat', { site: siteById.get(view.site)?.nom ?? view.site, days: fmtNum(view.days, lang, 2) })}</h2>
            <HeatMap scores={scores} top={top} startMs={data.startMs} selectedMs={view.landingMs} onPick={(ms) => setView({ landingMs: ms, cursorMs: null })} />
          </section>
          <section aria-labelledby="top-h">
            <h2 id="top-h">{t('best.top')}</h2>
            {top.length ? <BestDatesTable top={top} data={data} vis={vis} days={view.days} wEnergy={view.wEnergy} selectedMs={view.landingMs} onUse={(ms) => setView({ landingMs: ms, cursorMs: null })} /> : <p className="alert warn">{t('heat.empty')}</p>}
            <p className="actions">
              <button type="button" className="btn primary" onClick={() => nav({ pathname: '/site', search })}>{t('best.openSite')}</button>
              <ShareButton />
            </p>
          </section>
        </>
      )}
      <section aria-labelledby="rk-h">
        <h2 id="rk-h">{t('rank.title', { date: fmtDate(view.landingMs, lang), days: fmtNum(view.days, lang, 2) })}</h2>
        {all ? <RankingTable rows={ranking} siteById={siteById} currentId={view.site} onChoose={(site) => setView({ site })} /> : <Loading />}
      </section>
    </Page>
  )
}
