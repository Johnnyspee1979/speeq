/**
 * @jest-environment node
 *
 * Pariteit-tests voor de i18n-vertaalbestanden — NL is de canonieke bron
 * (zie src/i18n/index.ts: `t` valt terug op NL). We borgen dat EN/DE/PL exact
 * dezelfde key-set hebben als NL (geen ontbrekende of overtollige keys), dat een
 * vertaling geen vreemde placeholder-tokens introduceert die NL niet kent (een
 * caller levert immers alleen de NL-variabelen; een subset is wél toegestaan
 * voor grammatica-verschillen, bijv. de NL-suffix {t} in 'wacht{t}'), en dat
 * geen enkele vertaling leeg is.
 *
 * Pure data-test: we importeren de locale-objecten direct (geen React/DOM).
 */

import { nl } from '../nl';
import { en } from '../en';
import { de } from '../de';
import { pl } from '../pl';

const locales: Record<string, Record<string, string>> = { en, de, pl };

const placeholders = (s: string): string[] =>
  (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

describe('i18n-pariteit (NL = canoniek)', () => {
  const nlKeys = Object.keys(nl).sort();

  it('NL heeft keys en geen duplicaten verstopt', () => {
    expect(nlKeys.length).toBeGreaterThan(0);
  });

  for (const [name, dict] of Object.entries(locales)) {
    describe(name.toUpperCase(), () => {
      const keys = Object.keys(dict).sort();

      it('mist geen NL-keys', () => {
        const missing = nlKeys.filter((k) => !(k in dict));
        expect(missing).toEqual([]);
      });

      it('heeft geen keys die NL niet kent', () => {
        const extra = keys.filter((k) => !(k in nl));
        expect(extra).toEqual([]);
      });

      it('introduceert geen vreemde placeholder-tokens die NL niet kent', () => {
        const foreign = nlKeys
          .filter((k) => k in dict)
          .map((k) => {
            const nlSet = new Set(placeholders(nl[k]));
            const extra = placeholders(dict[k]).filter((p) => !nlSet.has(p));
            return extra.length ? { key: k, [name]: extra } : null;
          })
          .filter(Boolean);
        expect(foreign).toEqual([]);
      });

      it('heeft geen lege vertalingen', () => {
        const empty = keys.filter((k) => dict[k].trim() === '');
        expect(empty).toEqual([]);
      });
    });
  }
});
