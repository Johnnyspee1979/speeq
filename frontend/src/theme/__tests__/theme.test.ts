/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor de twee kant-en-klare thema's (darkTheme /
 * lightTheme) van type Theme. Schermen lezen `theme.colors.X`; een ontbrekende
 * of niet-parseerbare kleur geeft een onzichtbaar of crashend element. We borgen
 * de VORM die de UI nodig heeft en die stabiel hoort te blijven:
 *  - beide thema's hebben de juiste `name`;
 *  - beide hebben exact dezelfde kleur-sleutels (geen drift tussen dark/light);
 *  - elke kleur is een niet-lege string in hex6- of rgba()-vorm.
 *
 * BEWUST NIET afgedwongen: "geen puur wit/zwart". De kop-comments bij lightTheme
 * zijn aspirationeel ("warm cream / antraciet"), maar de feitelijke waarden zijn
 * background `#FFFFFF` en surface `#FFFFFF` by-design (Claude Design v2 light).
 * Een hex/rgba-vormcheck is de juiste, niet-brakke invariant — we koppelen de
 * test niet aan de verouderde comment.
 *
 * Pure data (geen imports) → @jest-environment node.
 */

import { darkTheme, lightTheme, type Theme } from '../theme';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const RGBA = /^rgba\(/;

const COLOR_KEYS: (keyof Theme['colors'])[] = [
  'background',
  'surface',
  'surfaceAlt',
  'textPrimary',
  'textSecondary',
  'border',
  'accent',
  'accentMuted',
  'success',
  'warning',
  'danger',
  'chip',
];

const isColorString = (v: unknown): boolean =>
  typeof v === 'string' && (HEX6.test(v) || RGBA.test(v));

describe.each([
  ['darkTheme', darkTheme, 'dark'],
  ['lightTheme', lightTheme, 'light'],
])('%s (struct)', (_label, theme, expectedName) => {
  it('heeft de juiste name', () => {
    expect(theme.name).toBe(expectedName);
  });

  it('heeft exact de verwachte kleur-sleutels', () => {
    expect(Object.keys(theme.colors).sort()).toEqual([...COLOR_KEYS].sort());
  });

  it('heeft uitsluitend niet-lege hex6/rgba-kleuren', () => {
    const bad = COLOR_KEYS.filter((k) => !isColorString(theme.colors[k]));
    expect(bad).toEqual([]);
  });
});

describe('dark/light parity', () => {
  it('delen exact dezelfde kleur-sleutels', () => {
    expect(Object.keys(darkTheme.colors).sort()).toEqual(
      Object.keys(lightTheme.colors).sort(),
    );
  });
});
