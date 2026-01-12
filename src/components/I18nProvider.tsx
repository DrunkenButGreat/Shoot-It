'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale } from '@/lib/i18n';

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
  dictionary: any;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ 
  children, 
  initialLocale, 
  initialDictionary 
}: { 
  children: React.ReactNode;
  initialLocale: Locale;
  initialDictionary: any;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState(initialDictionary);

  const setLocale = async (newLocale: Locale) => {
    // Save to cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    setLocaleState(newLocale);
    
    // Fetch new dictionary (simulated fetch since we are importing statically in many cases)
    // In a real app, you might fetch this from an API route or separate JSON files
    const newDict = await import(`@/dictionaries/${newLocale}.json`);
    setDictionary(newDict.default);
    
    // Optional: Refresh page to apply server-side changes
    window.location.reload();
  };

  const t = (path: string) => {
    const keys = path.split('.');
    let value = dictionary;
    for (const key of keys) {
      if (!value || !value[key]) return path;
      value = value[key];
    }
    return typeof value === 'string' ? value : path;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
