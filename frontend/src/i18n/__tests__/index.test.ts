/**
 * Gedrag-tests voor de i18n-runtime (i18n/index.ts). De parity-test borgt al dat
 * nl/en/de/pl dezelfde sleutels hebben; hier borgen we de FUNCTIE die de UI
 * gebruikt: LanguageProvider + useTranslation().t/setLocale. Een fout hier laat de
 * app de verkeerde taal tonen of variabelen onvervangen laten staan. We borgen:
 *  - LOCALE_META: vier locales met vlag/label en een 2-letter hoofdletter-short;
 *  - t() leest de ACTIEVE taal (vergeleken met de bron-objecten nl/en, geen
 *    hardgecodeerde copy → robuust tegen tekstwijzigingen);
 *  - setLocale wisselt de taal en t() volgt;
 *  - onbekende sleutel valt terug op de sleutel zelf (laatste fallback);
 *  - variabelen {x} worden (ook herhaald) vervangen.
 *
 * Rendert de echte Provider via renderHook (RN) → default jest-expo env.
 */

import { renderHook, act } from '@testing-library/react-native';
import { LanguageProvider, useTranslation, LOCALE_META, type Locale } from '../index';
import { nl } from '../nl';
import { en } from '../en';

const renderT = () =>
  renderHook(() => useTranslation(), { wrapper: LanguageProvider });

describe('LOCALE_META', () => {
  it('beschrijft precies de vier ondersteunde locales', () => {
    expect(Object.keys(LOCALE_META).sort()).toEqual(['de', 'en', 'nl', 'pl']);
  });

  it('heeft per locale een vlag, label en 2-letter hoofdletter-short', () => {
    for (const [code, meta] of Object.entries(LOCALE_META)) {
      expect(meta.flag).not.toBe('');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.short).toBe(code.toUpperCase());
      expect(meta.short).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe('useTranslation().t', () => {
  it('start in een geldige locale', () => {
    const { result } = renderT();
    expect(['nl', 'en', 'de', 'pl']).toContain(result.current.locale);
  });

  it('leest de actieve taal (vergeleken met de bron-objecten)', () => {
    const { result } = renderT();
    act(() => result.current.setLocale('nl'));
    expect(result.current.t('nav.dossier')).toBe(nl['nav.dossier']);
    act(() => result.current.setLocale('en'));
    expect(result.current.locale).toBe('en');
    expect(result.current.t('nav.dossier')).toBe(en['nav.dossier']);
  });

  it('valt terug op de sleutel zelf bij een onbekende sleutel', () => {
    const { result } = renderT();
    expect(result.current.t('__bestaat.niet__')).toBe('__bestaat.niet__');
  });

  it('vervangt variabelen, ook herhaald', () => {
    const { result } = renderT();
    // Onbekende sleutel → str = key; daarna {x}-substitutie op die string.
    expect(result.current.t('val:{n}/{s}', { n: 3, s: 'ok' })).toBe('val:3/ok');
    expect(result.current.t('{n}-{n}', { n: 7 })).toBe('7-7');
  });

  it('verandert per setLocale naar elke ondersteunde taal', () => {
    const { result } = renderT();
    for (const loc of ['de', 'pl', 'nl', 'en'] as Locale[]) {
      act(() => result.current.setLocale(loc));
      expect(result.current.locale).toBe(loc);
    }
  });
});
