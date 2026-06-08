import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'
import uz from './locales/uz.json'

const savedLang = localStorage.getItem('lang') || 'ru'

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    uz: { translation: uz },
  },
  lng: savedLang,
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
