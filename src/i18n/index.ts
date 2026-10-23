import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import my from './my.json';

const LANGUAGE_STORAGE_KEY = 'shwe-taw-pyan-chi-language';
const storedLanguage =
  typeof window !== 'undefined'
    ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    : null;

function syncDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language === 'my' ? 'my' : 'en';
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, my: { translation: my } },
  lng: storedLanguage === 'my' ? 'my' : 'en',
  supportedLngs: ['en', 'my'],
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
syncDocumentLanguage(storedLanguage === 'my' ? 'my' : 'en');

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
});

export default i18n;
