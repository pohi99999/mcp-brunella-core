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
    fallbackLng: 'hu', // Alapértelmezett legyen a magyar, ha már magyarítunk
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false, // React már biztonságos
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
