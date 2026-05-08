/**
 * i18n — vertaal-infrastructuur voor WKB Snap & Sync
 *
 * Talen: NL (hoofdtaal) · EN · DE · PL
 * Gebruik: const { t, locale, setLocale } = useTranslation();
 *          t('btn.approve')  → 'Goedkeuren' / 'Approve' / 'Genehmigen' / 'Zatwierdź'
 *
 * Strings met variabelen: t('dash.review_alert', { n: 3, s: 'en' })
 * → vervang {n}, {s}, {done}, {total} in de vertaling
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { nl } from './nl';
import { en } from './en';
import { de } from './de';
import { pl } from './pl';

export type Locale = 'nl' | 'en' | 'de' | 'pl';

export const LOCALE_META: Record<Locale, { flag: string; label: string; short: string }> = {
  nl: { flag: '🇳🇱', label: 'Nederlands', short: 'NL' },
  en: { flag: '🇬🇧', label: 'English',    short: 'EN' },
  de: { flag: '🇩🇪', label: 'Deutsch',    short: 'DE' },
  pl: { flag: '🇵🇱', label: 'Polski',     short: 'PL' },
};

const TRANSLATIONS: Record<Locale, Record<string, string>> = { nl, en, de, pl };

const STORAGE_KEY = 'wkb_locale';

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'nl';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'nl' || stored === 'en' || stored === 'de' || stored === 'pl') return stored;
  } catch { /* private browsing */ }

  // Auto-detectie via browser-taal
  const lang = navigator.language?.slice(0, 2).toLowerCase();
  if (lang === 'en') return 'en';
  if (lang === 'de') return 'de';
  if (lang === 'pl') return 'pl';
  return 'nl';
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Vertaal een key, optioneel met variabelen: t('key', { n: 3 }) */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextValue>({
  locale: 'nl',
  setLocale: () => {},
  t: (k) => k,
});

export function useTranslation() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
    } catch { /* private browsing */ }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // Zoek in huidige taal, fallback naar NL, fallback naar key
      let str = TRANSLATIONS[locale][key] ?? TRANSLATIONS['nl'][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [locale]
  );

  return React.createElement(
    LanguageContext.Provider,
    { value: { locale, setLocale, t } },
    children
  );
}
