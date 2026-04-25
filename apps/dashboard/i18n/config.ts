import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hu from './locales/hu.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hu: { translation: hu }
    },
    lng: 'hu',
    fallbackLng: 'hu',
    supportedLngs: ['hu', 'en'],
    nonExplicitSupportedLngs: true,
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // React már biztonságos
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'brunella.dashboard.language',
      caches: ['localStorage']
    }
  });

export default i18n;
