import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import { TRANSLATIONS, type TranslationKey } from '../i18n/translations';
import type { AppLanguage } from '../types/chat.types';
import { setNumeralLanguage } from '../utils/numerals';
import { loadStoredLang, saveStoredLang } from '../utils/storage';
import { STRINGS, type UIStrings } from '../utils/strings';

/**
 * App language + text direction.
 *
 * Arabic is the default and the source language. Switching to English swaps
 * the UI copy, digit style and text direction. Quran text and Tafsir
 * As-Sa'di stay Arabic — they are Arabic-only datasets.
 */

export type TranslateParams = Record<string, string | number>;

interface LanguageContextValue {
  lang: AppLanguage;
  isRTL: boolean;
  /** 'rtl' | 'ltr' — handy for writingDirection / web dir. */
  direction: 'rtl' | 'ltr';
  /** Translate a key, interpolating {placeholders}. */
  t: (key: TranslationKey, params?: TranslateParams) => string;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  /** Legacy copy used by the older chat/mushaf components. */
  strings: UIStrings;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyDirection(lang: AppLanguage) {
  const rtl = lang === 'ar';
  setNumeralLanguage(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lang);
    }
    return;
  }
  // Native mirrors layout via I18nManager; a full restart applies it everywhere.
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>('ar');

  useEffect(() => {
    loadStoredLang().then((stored) => {
      setLangState(stored);
      applyDirection(stored);
    });
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    applyDirection(next);
    saveStoredLang(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: AppLanguage = prev === 'ar' ? 'en' : 'ar';
      applyDirection(next);
      saveStoredLang(next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => {
      const table = TRANSLATIONS[lang] ?? TRANSLATIONS.ar;
      let text: string = table[key] ?? TRANSLATIONS.ar[key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      isRTL: lang === 'ar',
      direction: lang === 'ar' ? 'rtl' : 'ltr',
      t,
      setLang,
      toggleLang,
      strings: STRINGS[lang],
    }),
    [lang, t, setLang, toggleLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Arabic fallback used when context is unavailable (e.g. inside a Modal
 *  portal that does not forward React context on some platforms). Falling
 *  back keeps the UI rendering instead of throwing behind an error boundary. */
const FALLBACK: LanguageContextValue = {
  lang: 'ar',
  isRTL: true,
  direction: 'rtl',
  t: (key, params) => {
    let text: string = TRANSLATIONS.ar[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  },
  setLang: () => {},
  toggleLang: () => {},
  strings: STRINGS.ar,
};

export function useAppLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? FALLBACK;
}

/** Shorthand for components that only need the translator. */
export function useT() {
  return useAppLanguage().t;
}
