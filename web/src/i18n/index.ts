import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './fr.json'
import en from './en.json'

const stored = (() => { try { return localStorage.getItem('lang') } catch { return null } })()
const initial = stored ?? (typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'fr')

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (l) => {
  document.documentElement.lang = l
  try { localStorage.setItem('lang', l) } catch { /* stockage indisponible */ }
})

export default i18n
