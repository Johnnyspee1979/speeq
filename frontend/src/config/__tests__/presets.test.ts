/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor de preset-lijsten in config/presets.ts —
 * PROJECT_PRESETS (snelkeuze-projectnummers) en INSPECTION_PRESETS (snelkeuze
 * inspectionPointId-slugs). De UI toont deze als snelle keuzeknoppen; dubbele of
 * lege waarden geven verwarrende/dubbele knoppen.
 *
 * We borgen wat hier feitelijk geldt en stabiel hoort te blijven:
 *  - beide lijsten zijn niet-leeg en bevatten uitsluitend niet-lege strings;
 *  - geen duplicaten binnen een lijst;
 *  - elke INSPECTION_PRESET heeft slug-formaat (a-z, 0-9, koppelteken).
 *
 * BEWUST NIET afgedwongen (zou rood zijn op de huidige data): dat élke
 * INSPECTION_PRESET naar een bestaande inspectionPointId in de templates/NEN-data
 * verwijst. Drie gas-presets (`gas-mantelbuis-001`, `gas-persproef-start-001`,
 * `gas-persproef-eind-001`) komen alléén in presets.ts voor en mappen nergens
 * op een controlepunt — een bekende, los-geflagde bevinding. We koppelen de test
 * niet aan dat brakke gedrag en hernummeren hier niets.
 */

import { PROJECT_PRESETS, INSPECTION_PRESETS } from '../presets';

const SLUG = /^[a-z0-9-]+$/;

const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';
const duplicates = (arr: string[]): string[] => [
  ...new Set(arr.filter((x, i) => arr.indexOf(x) !== i)),
];

describe('PROJECT_PRESETS', () => {
  it('is een niet-lege lijst van niet-lege strings', () => {
    expect(PROJECT_PRESETS.length).toBeGreaterThan(0);
    expect(PROJECT_PRESETS.filter((p) => !isNonEmptyString(p))).toEqual([]);
  });

  it('bevat geen duplicaten', () => {
    expect(duplicates(PROJECT_PRESETS)).toEqual([]);
  });
});

describe('INSPECTION_PRESETS', () => {
  it('is een niet-lege lijst van niet-lege strings', () => {
    expect(INSPECTION_PRESETS.length).toBeGreaterThan(0);
    expect(INSPECTION_PRESETS.filter((p) => !isNonEmptyString(p))).toEqual([]);
  });

  it('bevat geen duplicaten', () => {
    expect(duplicates(INSPECTION_PRESETS)).toEqual([]);
  });

  it('heeft slug-formaat voor elke preset', () => {
    const bad = INSPECTION_PRESETS.filter((p) => !SLUG.test(p));
    expect(bad).toEqual([]);
  });
});
