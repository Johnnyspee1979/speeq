/**
 * @jest-environment node
 *
 * Gedrag-test voor de web-variant van de WatermelonDB-toegang
 * (database/watermelon.web.ts). Op web bestaat de native SQLite-adapter niet; de
 * webapp gebruikt de bestaande lokale (web-store) fallback. Deze module is daarom
 * bewust een "tripwire": getWatermelonDatabase() MOET gooien in plaats van stilletjes
 * een (kapotte of lege) database terug te geven. Een regressie waarbij dit een
 * waarde teruggeeft zou de web-build naar de verkeerde opslaglaag laten grijpen.
 *
 * De stub heeft geen imports → pure module → @jest-environment node.
 */

import { getWatermelonDatabase } from '../watermelon.web';

describe('getWatermelonDatabase (web-stub)', () => {
  it('is een functie', () => {
    expect(typeof getWatermelonDatabase).toBe('function');
  });

  it('gooit altijd — web heeft geen native WatermelonDB', () => {
    expect(() => getWatermelonDatabase()).toThrow();
  });

  it('verwijst in de melding naar de native-only beperking en de web-fallback', () => {
    expect(() => getWatermelonDatabase()).toThrow(/alleen beschikbaar in native/i);
    expect(() => getWatermelonDatabase()).toThrow(/web/i);
  });
});
