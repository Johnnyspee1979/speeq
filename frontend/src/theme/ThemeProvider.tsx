// frontend/src/theme/ThemeProvider.tsx
//
// Warm Minimal theme — verankerd in de React Context.
// Combineert de vaste `designTokens` met dynamische branding-data uit Supabase
// (`tenantFeatures.branding_colors`). Zodra een KEYUSER kleuren aanpast detecteert
// de context dat en forceert hertekening van de hele applicatie.
//
// UI-primitives consumeren UITSLUITEND via `const { theme } = useTheme()` — nooit
// met hard-gecodeerde hex-waarden.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';

import { designTokens, type DesignTokens, type ColorTokens } from './designTokens';

// Primary action = navy uit SpeeQ logo (Q-mark + wordmark).
// Claude Design tokens zitten nu in designTokens.colors (één bron van waarheid).
const BRAND_NAVY        = '#1B3A5C';
const BRAND_NAVY_MUTED  = 'rgba(27,58,92,0.10)';

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
// Type behoudt 'modern' voor backwards-compat met code die het noemt,
// maar runtime gebruikt alleen 'light' (= Claude Design) en 'dark'.
export type ThemeMode = 'light' | 'modern' | 'dark';

export type ActiveTheme = DesignTokens & {
  name: ThemeMode;
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
  // Toggle cyclet: light (Warm Minimal) → modern (slate/violet) → dark → light.
  toggleTheme: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildActiveTheme(
  base: DesignTokens,
  tenantFeatures: TenantFeaturesPayload,
  mode: ThemeMode,
): ActiveTheme {
  const tenantColors: TenantBrandingColors =
    tenantFeatures && tenantFeatures.branding_colors
      ? tenantFeatures.branding_colors
      : {};

  // Merge de vaste basis met de dynamische klant-branding.
  const mergedColors: ColorTokens = { ...base.colors, ...tenantColors };

  // Light + modern delen dezelfde tokens (Claude Design v2 als default).
  // Dark: zinc-900 background met wit textPrimary, brand-kleuren behouden.
  let colorsForMode: ColorTokens;
  if (mode === 'dark') {
    colorsForMode = {
      ...mergedColors,
      background:    '#09090B',     // zinc-950
      backgroundAlt: '#18181B',     // zinc-900
      surface:       '#18181B',
      surfaceAlt:    '#27272A',     // zinc-800
      textPrimary:   '#FAFAFA',     // zinc-50
      textSecondary: '#A1A1AA',     // zinc-400
      textMuted:     '#71717A',     // zinc-500
      borderWarm:    '#27272A',     // zinc-800
      borderWarmAlt: '#3F3F46',     // zinc-700
    };
  } else {
    colorsForMode = mergedColors;
  }

  return {
    ...base,
    name: mode,
    colors: {
      ...colorsForMode,
      // Primary CTA = navy (Claude Design). Was statusSuccess in Warm Minimal.
      accent:       BRAND_NAVY,
      accentMuted:  BRAND_NAVY_MUTED,
      success:      colorsForMode.statusSuccess,
      warning:      '#D97706',
      danger:       colorsForMode.statusWarning,
      border:       colorsForMode.borderWarm,
      chip:         colorsForMode.textPrimary,
    },
  };
}

/** localStorage key voor persistente theme-keuze. */
const THEME_STORAGE_KEY = 'speeq_theme_mode_v1';

function loadStoredMode(): ThemeMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'light';
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'modern' || v === 'dark' || v === 'light') return v;
  } catch { /* ignore */ }
  return 'light';
}

function persistMode(m: ThemeMode): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, m);
  } catch { /* ignore */ }
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
  const [mode, setMode] = useState<ThemeMode>(loadStoredMode);

  // Persisteer wijzigingen naar localStorage zodat refresh de keuze onthoudt.
  useEffect(() => {
    persistMode(mode);
  }, [mode]);

  /** 2-mode toggle: light (Claude Design v2 default) ↔ dark. */
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
