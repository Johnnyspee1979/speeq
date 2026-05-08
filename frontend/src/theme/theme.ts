/**
 * SpeeQ WKB — Theme tokens
 *
 * Sprint 9 (UI UX Pro Max design-system):
 *   • Palette herijkt naar slate-ramp 950→700 — hogere contrast, WCAG AA op alle teksten.
 *   • textSecondary van #3D4A62 (3.4:1) → #94A3B8 (4.5:1+) op donkere bg.
 *   • Status-tokens (success/warning/danger) verbreed naar 500-tones (heller bij zon).
 *   • Brand-rood #A40D2F blijft accent (Spee Solutions identiteit).
 *   • Nieuwe tokens: spacing, radii, shadow, typography (Fira Sans / Fira Code).
 */

export type Theme = {
  name: 'dark' | 'light';
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    accent: string;
    accentMuted: string;
    success: string;
    warning: string;
    danger: string;
    chip: string;
  };
  spacing: {
    xs: number; sm: number; md: number; lg: number; xl: number; xxl: number;
  };
  radius: {
    sm: number; md: number; lg: number; xl: number; pill: number;
  };
  shadow: {
    sm: string; md: string; lg: string;
  };
  font: {
    body: string;
    heading: string;
    mono: string;
    weight: { regular: '400'; medium: '500'; semibold: '600'; bold: '700'; black: '900' };
  };
};

// 4px-baseline spacing
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
// Radii
const RADIUS = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
// Typography — Fira Sans/Code per UI UX Pro Max recommendation voor data-dense dashboards
const FONT = {
  body:    "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  heading: "'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  mono:    "'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '900' },
} as const;
// Shadows — depth-ladder (geen platte 2D-layout)
const SHADOW_DARK = {
  sm: '0 1px 2px rgba(0,0,0,0.45)',
  md: '0 4px 12px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)',
  lg: '0 12px 32px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
} as const;
const SHADOW_LIGHT = {
  sm: '0 1px 2px rgba(15,23,42,0.06)',
  md: '0 4px 12px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
  lg: '0 12px 32px rgba(15,23,42,0.10), 0 4px 8px rgba(15,23,42,0.06)',
} as const;

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background:    '#020617',              // slate-950 — diepste laag
    surface:       '#0F172A',              // slate-900 — kaarten
    surfaceAlt:    '#1E293B',              // slate-800 — verhoogde kaarten
    textPrimary:   '#F8FAFC',              // slate-50 — hoog contrast
    textSecondary: '#94A3B8',              // slate-400 — WCAG AA op slate-950 (5.4:1)
    border:        'rgba(148,163,184,0.18)', // slate-400 @ 18% — subtiele glas-rand
    accent:        '#A40D2F',              // Spee Solutions Rood (BRAND, behouden)
    accentMuted:   '#1A0410',              // diep-rood tint
    success:       '#22C55E',              // green-500 (helderder bij zon)
    warning:       '#F59E0B',              // amber-500
    danger:        '#EF4444',              // red-500
    chip:          '#1E293B',              // slate-800
  },
  spacing: SPACING,
  radius: RADIUS,
  shadow: SHADOW_DARK,
  font: FONT,
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background:    '#F8FAFC',              // slate-50
    surface:       '#FFFFFF',
    surfaceAlt:    '#F1F5F9',              // slate-100
    textPrimary:   '#020617',              // slate-950
    textSecondary: '#475569',              // slate-600 — 7.5:1 op witte bg
    border:        'rgba(15,23,42,0.10)',
    accent:        '#A40D2F',
    accentMuted:   '#FDE8ED',
    success:       '#16A34A',              // green-600 voor licht (donkerder voor contrast)
    warning:       '#D97706',              // amber-600
    danger:        '#DC2626',              // red-600
    chip:          '#F1F5F9',
  },
  spacing: SPACING,
  radius: RADIUS,
  shadow: SHADOW_LIGHT,
  font: FONT,
};
