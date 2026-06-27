/**
 * Struct-invariant-tests voor het designTokens-systeem (Warm Minimal / Claude
 * Design tokens v2). Dit is ÉÉN bron voor alle schermen; de legacy `tokens`-alias
 * houdt bestaande UI-primitives (PrimaryButton, StatusPill, …) werkend. We borgen
 * de vorm-invarianten waar de UI op leunt en die stil mogen blijven:
 *  - elke kleur in designTokens.colors is een geldige 6-cijfer-hex;
 *  - radius/spacing zijn positieve, eindige getallen (spacing strikt oplopend);
 *  - elke typografie-stijl heeft een niet-lege fontFamily, fontSize > 0,
 *    lineHeight ≥ fontSize en een 3-cijfer fontWeight;
 *  - de legacy `tokens`-alias blijft synchroon met designTokens (radius/spacing
 *    1-op-1, kern-kleuren 1-op-1) en de "soft" tinten zijn rgba().
 *
 * NB: we asserten bewust NIET "geen puur wit/zwart" — de kop-comment is
 * aspirationeel, maar background/surface ZIJN #FFFFFF by-design. Een hex-vorm-
 * check is de juiste, niet-brakke invariant.
 *
 * Importeert react-native (Platform) → default jest-expo env (geen node).
 */

import { designTokens, tokens, fontStacks } from '../designTokens';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const FONT_WEIGHT = /^[1-9]00$/;

const isPositiveFinite = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

const isNonEmptyString = (v: unknown): boolean =>
  typeof v === 'string' && v.trim() !== '';

describe('designTokens.colors', () => {
  it('heeft alleen geldige 6-cijfer-hex-kleuren', () => {
    const bad = Object.entries(designTokens.colors)
      .filter(([, v]) => !HEX6.test(v))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});

describe('designTokens.radius & spacing', () => {
  it('heeft uitsluitend positieve, eindige radius-waarden', () => {
    const bad = Object.entries(designTokens.radius)
      .filter(([, v]) => !isPositiveFinite(v))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('heeft uitsluitend positieve, eindige spacing-waarden', () => {
    const bad = Object.entries(designTokens.spacing)
      .filter(([, v]) => !isPositiveFinite(v))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('heeft een strikt oplopende spacing-schaal s1..s8', () => {
    const order = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;
    const values = order.map((k) => designTokens.spacing[k]);
    const ascending = values.every((v, i) => i === 0 || v > values[i - 1]);
    expect(ascending).toBe(true);
  });
});

describe('designTokens.typography', () => {
  it('heeft per stijl een geldige fontFamily, maten en gewicht', () => {
    const bad = Object.entries(designTokens.typography)
      .filter(([, style]) => {
        const s = style as {
          fontFamily: unknown;
          fontSize: unknown;
          lineHeight: unknown;
          fontWeight: unknown;
        };
        return (
          !isNonEmptyString(s.fontFamily) ||
          !isPositiveFinite(s.fontSize) ||
          !isPositiveFinite(s.lineHeight) ||
          (s.lineHeight as number) < (s.fontSize as number) ||
          typeof s.fontWeight !== 'string' ||
          !FONT_WEIGHT.test(s.fontWeight)
        );
      })
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});

describe('fontStacks', () => {
  it('levert niet-lege headline- en inter-stacks', () => {
    expect(isNonEmptyString(fontStacks.headline)).toBe(true);
    expect(isNonEmptyString(fontStacks.inter)).toBe(true);
  });
});

describe('legacy tokens-alias blijft synchroon met designTokens', () => {
  it('mapt radius 1-op-1', () => {
    expect(tokens.radiusSm).toBe(designTokens.radius.sm);
    expect(tokens.radiusMd).toBe(designTokens.radius.md);
    expect(tokens.radiusLg).toBe(designTokens.radius.lg);
    expect(tokens.radiusXl).toBe(designTokens.radius.xl);
    expect(tokens.radiusPill).toBe(designTokens.radius.pill);
  });

  it('mapt spacing 1-op-1', () => {
    expect(tokens.s1).toBe(designTokens.spacing.s1);
    expect(tokens.s2).toBe(designTokens.spacing.s2);
    expect(tokens.s3).toBe(designTokens.spacing.s3);
    expect(tokens.s4).toBe(designTokens.spacing.s4);
    expect(tokens.s5).toBe(designTokens.spacing.s5);
    expect(tokens.s6).toBe(designTokens.spacing.s6);
    expect(tokens.s7).toBe(designTokens.spacing.s7);
    expect(tokens.s8).toBe(designTokens.spacing.s8);
  });

  it('mapt kern-kleuren 1-op-1', () => {
    expect(tokens.cream).toBe(designTokens.colors.background);
    expect(tokens.creamSoft).toBe(designTokens.colors.backgroundAlt);
    expect(tokens.ink).toBe(designTokens.colors.textPrimary);
    expect(tokens.inkSoft).toBe(designTokens.colors.textMuted);
    expect(tokens.beige).toBe(designTokens.colors.borderWarm);
    expect(tokens.beigeSoft).toBe(designTokens.colors.borderWarmAlt);
    expect(tokens.forest).toBe(designTokens.colors.statusSuccess);
    expect(tokens.terracotta).toBe(designTokens.colors.statusWarning);
    expect(tokens.primary).toBe(designTokens.colors.textPrimary);
    expect(tokens.danger).toBe(designTokens.colors.statusWarning);
    expect(tokens.borderWarm).toBe(designTokens.colors.borderWarm);
    expect(tokens.borderWarmSoft).toBe(designTokens.colors.borderWarmAlt);
  });

  it('houdt de "soft" tinten als rgba()-waarden', () => {
    const softKeys = [
      'forestSoft',
      'terracottaSoft',
      'amberSoft',
      'primarySoft',
      'primaryBorder',
      'dangerSoft',
      'warningSoft',
      'surfaceWarm',
      'hoverWarm',
    ] as const;
    const bad = softKeys.filter((k) => !/^rgba\(/.test(tokens[k]));
    expect(bad).toEqual([]);
  });
});
