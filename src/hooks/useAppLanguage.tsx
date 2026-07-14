import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppLanguage } from '../types/chat.types';
import { loadStoredLang, saveStoredLang } from '../utils/storage';
import { STRINGS, type UIStrings } from '../utils/strings';

interface LanguageContextValue {
  lang: AppLanguage;
  strings: UIStrings;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>('ar');

  useEffect(() => {
    loadStoredLang().then(setLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      saveStoredLang(next);
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, strings: STRINGS[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useAppLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useAppLanguage must be used within a LanguageProvider');
  return ctx;
}
