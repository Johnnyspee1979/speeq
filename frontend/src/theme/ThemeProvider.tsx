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

/**
 * Modern theme variant (Johnny 25 mei: "ik wil van die oude look af").
 * Slate-50 / wit / violet-600 — losgekoppeld van Warm Minimal beige.
 * Toggle in de header cyclet door: warm → modern → dark.
 */
const MODERN_LIGHT_OVERRIDES: Partial<ColorTokens> = {
  background:    '#F8FAFC',  // slate-50
  backgroundAlt: '#F1F5F9',  // slate-100
  surface:       '#FFFFFF',
  surfaceAlt:    '#F8FAFC',
  textPrimary:   '#0F172A',  // slate-900
  textSecondary: '#334155',  // slate-700
  textMuted:     '#64748B',  // slate-500
  statusSuccess: '#059669',  // emerald-600 (moderner dan bos-groen)
  statusWarning: '#DC2626',  // red-600 (moderner dan terracotta)
  borderWarm:    '#E2E8F0',  // slate-200
  borderWarmAlt: '#CBD5E1',  // slate-300
};

const MODERN_ACCENT      = '#7C3AED'; // violet-600
const MODERN_ACCENT_MUTED = 'rgba(124,58,237,0.12)';

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

  let colorsForMode: ColorTokens;
  let accent: string;
  let accentMuted: string;

  if (mode === 'dark') {
    // Dark-mode: behoud Warm Minimal-karakter, alleen background/surface dimmen.
    colorsForMode = {
      ...mergedColors,
      background:    '#1B1A17',
      backgroundAlt: '#26241F',
      surface:       '#2F2A25',
      surfaceAlt:    '#3A332D',
      textPrimary:   '#F3EDE2',
      textSecondary: '#D7C2AA',
      textMuted:     '#9A8F84',
      borderWarm:    '#5A4F43',
      borderWarmAlt: '#6B5D4F',
    };
    accent = colorsForMode.statusSuccess;
    accentMuted = 'rgba(31,77,58,0.10)';
  } else if (mode === 'modern') {
    // Modern: wit/slate/violet — losgekoppeld van Warm Minimal beige.
    colorsForMode = { ...mergedColors, ...MODERN_LIGHT_OVERRIDES };
    accent = MODERN_ACCENT;
    accentMuted = MODERN_ACCENT_MUTED;
  } else {
    // Warm Minimal light (default).
    colorsForMode = mergedColors;
    accent = colorsForMode.statusSuccess;
    accentMuted = 'rgba(31,77,58,0.10)';
  }

  return {
    ...base,
    name: mode,
    colors: {
      ...colorsForMode,
      accent,
      accentMuted,
      success:      colorsForMode.statusSuccess,
      warning:      mode === 'modern' ? '#D97706' : '#9A6C1C',
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

  /** 3-mode cycle: light (Warm Minimal) → modern (slate/violet) → dark → light. */
  const toggleTheme = useCallback(() => {
    setMode((current) => {
      if (current === 'light') return 'modern';
      if (current === 'modern') return 'dark';
      return 'light';
    });
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
