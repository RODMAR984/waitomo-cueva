// contexts/LocaleContext.js — Idioma (es / en), persistido en AsyncStorage y opcionalmente en profile
import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, SUPPORTED_LOCALES } from '../locales/translations';

export const LOCALE_ES = 'es';
export const LOCALE_EN = 'en';
export const LOCALE_PT = 'pt';

const STORAGE_KEY = 'app_locale';

const LocaleContext = createContext({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
  isEnglish: false,
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('es');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'es' || saved === 'en' || saved === 'pt') setLocaleState(saved);
      } catch {
        // ignore
      }
    })();
  }, []);

  const setLocale = useCallback(async (newLocale) => {
    if (newLocale !== 'es' && newLocale !== 'en' && newLocale !== 'pt') return;
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key) => {
      const strings = translations[locale] || translations.es;
      return strings[key] ?? translations.es[key] ?? key;
    },
    [locale]
  );

  const isEnglish = locale === 'en';
  const value = useMemo(
    () => ({ locale, setLocale, t, isEnglish, LOCALE_ES: 'es', LOCALE_EN: 'en', SUPPORTED_LOCALES }),
    [locale, setLocale, t, isEnglish]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
