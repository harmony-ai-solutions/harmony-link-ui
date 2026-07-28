import { createContext, useContext, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { resolveLanguage } from '../i18n/i18n.js';

export const I18nContext = createContext(null);

/**
 * Provides i18n context and synchronizes with the app's language setting.
 *
 * @param {Object} props
 * @param {string} props.appLanguage - language code from app config (e.g. "en")
 * @param {Function} props.onLanguageChange - callback when language changes (to persist to config)
 * @param {React.ReactNode} props.children
 */
export function I18nProvider({ appLanguage, onLanguageChange, children }) {
  const { i18n: i18nInstance } = useTranslation();

  // Sync i18n language whenever appLanguage config changes
  useEffect(() => {
    const resolved = resolveLanguage(appLanguage);
    if (i18n.language !== resolved) {
      i18n.changeLanguage(resolved).then(() => {
        document.documentElement.lang = resolved;
        document.documentElement.dir = resolved === 'ar' ? 'rtl' : 'ltr';
      });
    }
  }, [appLanguage]);

  const changeLanguage = useCallback(
    (lang) => {
      if (!i18n.options.resources[lang]) {
        console.warn(`[I18nProvider] Language "${lang}" has no resource bundle.`);
        return;
      }
      i18n.changeLanguage(lang).then(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        if (onLanguageChange) onLanguageChange(lang);
      });
    },
    [onLanguageChange],
  );

  return (
    <I18nContext.Provider value={{ changeLanguage, currentLanguage: i18n.language }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to access I18n context (language switch + current language).
 */
export function useI18nContext() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return ctx;
}

export { i18n };
