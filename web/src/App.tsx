import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DataBanner, Footer, Header, ScrollFocus } from './components/Layout'
import HomePage from './pages/HomePage'
import SitePage from './pages/SitePage'
import ComparePage from './pages/ComparePage'
import DatesPage from './pages/DatesPage'
import { DiscoverIndex, ScenarioPage } from './pages/DiscoverPage'
import HelpPage from './pages/HelpPage'
import SummaryPage from './pages/SummaryPage'
import { VLink } from './components/common'

const NotFound = () => {
  const { t } = useTranslation()
  return (
    <div className="container page">
      <h1>{t('notFound.title')}</h1>
      <p><VLink to="/">{t('notFound.back')}</VLink></p>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  return (
    <>
      <a className="skip" href="#contenu" onClick={(e) => { e.preventDefault(); document.getElementById('contenu')?.focus() }}>{t('app.skip')}</a>
      <Header />
      <DataBanner />
      <ScrollFocus />
      <main id="contenu" tabIndex={-1}>
        <Suspense fallback={<p className="container" role="status">{t('boot.loading')}</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/site" element={<SitePage />} />
            <Route path="/comparer" element={<ComparePage />} />
            <Route path="/dates" element={<DatesPage />} />
            <Route path="/decouvrir" element={<DiscoverIndex />} />
            <Route path="/decouvrir/:id" element={<ScenarioPage />} />
            <Route path="/aide" element={<HelpPage />} />
            <Route path="/sources" element={<HelpPage />} />
            <Route path="/recap" element={<SummaryPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
