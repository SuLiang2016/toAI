'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { saveStoredLocale } from '@/lib/storage';
import { applyLocaleToDocument, readLocaleFromBrowser } from './browser';
import { getMessage, type MessageKey, type MessageValues } from './catalog';
import { type Locale } from './types';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(() => readLocaleFromBrowser());

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  const handleSetLocale = useCallback((nextLocale: Locale) => {
    saveStoredLocale(nextLocale);
    setLocale(nextLocale);
  }, []);

  const t = useMemo(() => {
    return (key: MessageKey, values?: MessageValues) => getMessage(locale, key, values);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: handleSetLocale,
      t,
    }),
    [handleSetLocale, locale, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider.');
  }

  return context;
}

export function useTranslate() {
  const { t } = useLanguage();
  return t;
}

export function useCurrentLocale() {
  const { locale, setLocale } = useLanguage();
  return { locale, setLocale };
}
