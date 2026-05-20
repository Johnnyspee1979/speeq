// frontend/src/theme/ThemeProvider.tsx
//
// Warm Minimal theme — verankerd in de React Context.
// Combineert de vaste `designTokens` met dynamische branding-data uit Supabase
// (`tenantFeatures.branding_colors`). Zodra een KEYUSER kleuren aanpast detecteert
// de context dat en forceert hertekening van de hele applicatie.
//
// UI-primitives consumeren UITSLUITEND via `const { theme } = useTheme()` — nooit
// met hard-gecodeerde hex-waarden.

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

import { designTokens, type DesignTokens, type ColorTokens } from './designTokens';

// ─── Types ────────────────────────────────────────────────────────────────────

// Branding-payload zoals die uit Supabase tenant_features.branding_colors komt.
// Alle keys optioneel — tenant overschrijft alleen wat ze willen.
export type TenantBrandingColors = Partial<ColorTokens>;

// Lichte typing voor de tenantFeatures-prop. Houdt API open voor extra feature-flags.
export type TenantFeaturesPayload = {
  branding_colors?: TenantBrandingColors | null;
  [feature: string]: unknown;
} | null;

// Het volledige `theme`-object dat door de Context wordt doorgegeven.
// Bevat de Warm Minimal designTokens + legacy-aliasen op `colors` zodat
// bestaande schermen die `theme.colors.{accent, danger, success, surfaceAlt, border, ...}`
// gebruiken naadloos meelopen.
export type ActiveTheme = DesignTokens & {
  name: 'light' | 'dark';
  colors: ColorTokens & {
    // Legacy-aliasen voor schermen die via de oude `Theme`-shape stylen.
    accent:       string;
    accentMuted:  string;
    success:      string;
    warning:      string;
    danger:       string;
    border:       string;
    chip:         string;
  };
};

type ThemeContextValue = {
  theme: ActiveTheme;
  // Toggle blijft beschikbaar — dark-fallback gebruikt dezelfde tokens met
  // een gedimde background. Geen tech-blauw, geen puur zwart.
  toggleTheme: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildActiveTheme(
  base: DesignTokens,
  tenantFeatures: TenantFeaturesPayload,
  mode: 'light' | 'dark',
): ActiveTheme {
  const tenantColors: TenantBrandingColors =
    tenantFeatures && tenantFeatures.branding_colors
      ? tenantFeatures.branding_colors
      : {};

  // Merge de vaste basis met de dynamische klant-branding.
  // Alle kleuren in `designTokens.colors` mogen overschreven worden door de tenant.
  const mergedColors: ColorTokens = { ...base.colors, ...tenantColors };

  // Dark-mode: behoud Warm Minimal-karakter, alleen background/surface dimmen.
  const colorsForMode: ColorTokens =
    mode === 'dark'
      ? {
          ...mergedColors,
          background:    '#1B1A17',     // donker espresso
          backgroundAlt: '#26241F',
          surface:       '#2F2A25',     // textSecondary als oppervlak
          surfaceAlt:    '#3A332D',
          textPrimary:   '#F3EDE2',     // backgroundAlt als tekstkleur
          textSecondary: '#D7C2AA',
          textMuted:     '#9A8F84',
          borderWarm:    '#5A4F43',
          borderWarmAlt: '#6B5D4F',
        }
      : mergedColors;

  return {
    ...base,
    name: mode,
    colors: {
      ...colorsForMode,
      // Legacy-aliasen — afgeleid van de Warm Minimal kleuren zodat
      // bestaande `theme.colors.accent` automatisch correct meeloopt.
      accent:       colorsForMode.statusSuccess,
      accentMuted:  'rgba(31,77,58,0.10)',
      success:      colorsForMode.statusSuccess,
      warning:      '#9A6C1C',
      danger:       colorsForMode.statusWarning,
      border:       colorsForMode.borderWarm,
      chip:         colorsForMode.textPrimary,
    },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const defaultTheme = buildActiveTheme(designTokens, null, 'light');

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  toggleTheme: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
  tenantFeatures?: TenantFeaturesPayload;
};

export const ThemeProvider = ({ children, tenantFeatures = null }: Props) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const toggleTheme = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  // Merge de vaste basis (designTokens) met de dynamische klant-branding uit Supabase.
  // useMemo zorgt dat React alleen hertekent als tenantFeatures of mode wijzigt.
  const activeTheme = useMemo(
    () => buildActiveTheme(designTokens, tenantFeatures, mode),
    [tenantFeatures, mode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: activeTheme, toggleTheme }),
    [activeTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

// De canonieke hook voor alle UI-componenten.
// Gebruik: `const { theme } = useTheme();`  → daarna `theme.colors.background`, enz.
export const useTheme = () => useContext(ThemeContext);

// Convenience-hook als je alleen tokens nodig hebt (geen mode-info).
export const useDesignTokens = () => useTheme().theme;
