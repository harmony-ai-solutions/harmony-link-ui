import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Locale JSON imports
import commonEn from './locales/en/common.json';
import generalSettingsEn from './locales/en/generalSettings.json';
import entitySettingsEn from './locales/en/entitySettings.json';
import moduleConfigEn from './locales/en/moduleConfig.json';
import simulatorEn from './locales/en/simulator.json';
import developmentEn from './locales/en/development.json';
import integrationsEn from './locales/en/integrations.json';
import charactersEn from './locales/en/characters.json';

const resources = {
  en: {
    common: commonEn,
    generalSettings: generalSettingsEn,
    entitySettings: entitySettingsEn,
    moduleConfig: moduleConfigEn,
    simulator: simulatorEn,
    development: developmentEn,
    integrations: integrationsEn,
    characters: charactersEn,
  },
};

/**
 * List of supported language codes.
 * Add new languages here when locale files are ready.
 */
export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  // { value: 'ar', label: 'العربية' },
  // { value: 'de', label: 'Deutsch' },
];

/**
 * Get the language code from app config settings, or fall back to detector/browser.
 * @param {string|null} configLang - language code stored in app config
 */
export function resolveLanguage(configLang) {
  if (configLang && resources[configLang]) {
    return configLang;
  }
  // Fall back to browser-detected or stored language
  const detected = localStorage.getItem('i18nextLng') || navigator.language?.split('-')[0];
  if (detected && resources[detected]) {
    return detected;
  }
  return 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveLanguage(null),
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    defaultNS: 'common',
    ns: Object.keys(resources.en),
  });

/**
 * Switch the i18n language at runtime.
 * Also persists to config if a save callback is provided.
 * @param {string} lang - language code
 * @param {Function|null} onPersist - optional callback to persist to app config
 */
export function switchLanguage(lang, onPersist) {
  if (!resources[lang]) {
    console.warn(`[i18n] Language "${lang}" has no resource bundle.`);
    return;
  }
  i18n.changeLanguage(lang).then(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (onPersist) onPersist(lang);
  });
}

export default i18n;
