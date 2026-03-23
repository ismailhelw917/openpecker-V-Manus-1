import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations, TranslationKey } from '@/lib/i18n';

type DeepReadonlyStrings<T> = T extends string ? string : { [K in keyof T]: DeepReadonlyStrings<T[K]> };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: DeepReadonlyStrings<TranslationKey>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('op_language');
    return (stored === 'hi' ? 'hi' : 'en') as Language;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('op_language', lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
