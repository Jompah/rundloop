'use client';

import { useState, useEffect, useCallback } from 'react';
import en, { type TranslationKey } from './en';
import sv from './sv';

export type Locale = 'en' | 'sv';

const translations: Record<Locale, Record<TranslationKey, string>> = { en, sv };

const STORAGE_KEY = 'rundloop-locale';

/**
 * Detect locale from browser or localStorage override.
 * Returns 'sv' if the browser language starts with 'sv', otherwise 'en'.
 */
function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';

  // Check localStorage for user override
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'sv' || stored === 'en') return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }

  // Detect from browser
  const languages = navigator.languages ?? [navigator.language];
  for (const lang of languages) {
    if (lang.startsWith('sv')) return 'sv';
  }

  return 'en';
}

// Module-level state so all hook instances share the same locale
let currentLocale: Locale | null = null;
const listeners = new Set<(locale: Locale) => void>();

function getLocale(): Locale {
  if (currentLocale === null) {
    currentLocale = detectLocale();
  }
  return currentLocale;
}

function setLocale(locale: Locale) {
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore
  }
  listeners.forEach((fn) => fn(locale));
}

/**
 * Translate a key with optional interpolation.
 * Placeholders use {name} syntax, e.g. t('route.generate', { distance: 5 })
 */
function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * React hook for translations.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   t('gps.findPosition')
 *   t('route.generate', { distance: 5 })
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  useEffect(() => {
    const handler = (newLocale: Locale) => setLocaleState(newLocale);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const t: TFunction = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
  }, []);

  return { t, locale, setLocale: changeLocale };
}

export type { TranslationKey };
