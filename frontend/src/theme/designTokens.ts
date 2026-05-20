// frontend/src/theme/designTokens.ts
// Warm Minimal design system — verankerd in de frontend architectuur.
// Géén puur wit (#FFFFFF), géén puur zwart (#000000), géén techno-blauw.
// Schaalbaar voor white-labeling per bouwbedrijf via tenant_features.

import { Platform } from 'react-native';

// Side-effect: injecteer Google Fonts <link> in document.head op web.
// Expo's web export negeert frontend/web/index.html, dus statische link-tags
// daar bereiken productie niet — dit module-level effect omzeilt dat.
import './injectGoogleFonts';

// Two-Font System families. Web gebruikt de Google Fonts namen (geladen via
// injectGoogleFonts.ts); native blijft de expo-font alias gebruiken die later
// via useFonts() kan worden geregistreerd.
const HEADLINE_FAMILY = Platform.OS === 'web'
  ? '"Playfair Display", Georgia, serif'
  : 'Playfair-Italic';

const INTER_FAMILY = Platform.OS === 'web'
  ? '"Inter", system-ui, -apple-system, sans-serif'
  : 'Inter';

export const designTokens = {
  colors: {
    // Basis en Oppervlakten
    background:    '#FBF6EE',       // Primaire crèmetint voor root views (voorkomt verblinding)
    backgroundAlt: '#F3EDE2',       // Alternatieve warme 'Oatmeal' tint
    surface:       '#EADBC7',       // Zacht beige voor evidence-cards en modals
    surfaceAlt:    '#D8D1C7',       // Gestructureerd warm grijs voor tabbladen

    // Typografie
    textPrimary:   '#2B2B2B',       // Diep antraciet voor hoofdtekst en data
    textSecondary: '#2F2A25',       // Espresso-kleur voor secundaire tekst
    textMuted:     '#575B5F',       // Gedempt grijs voor timestamps en kleine labels

    // Status Indicatoren (Pills)
    statusSuccess:    '#1F4D3A',    // Gedempt bosgroen voor 'Goedgekeurd'
    statusSuccessAlt: '#568203',    // Alternatief groen
    statusWarning:    '#F88363',    // Zonsondergang-oranje / Terracotta voor 'Actie vereist'
    statusWarningAlt: '#FF5733',    // Alternatief oranje

    // Randen en Scheidingslijnen
    borderWarm:    '#C9B099',       // Subtiele warme randen voor outlines van cards
    borderWarmAlt: '#D7C2AA',       // Alternatieve warme border voor divider lijnen
  },

  // Two-Font System implementatie
  // Gewicht wordt via fontWeight gestuurd ipv via family-suffix, zodat één
  // family-naam (Playfair Display / Inter) werkt over alle stijlen heen.
  typography: {
    headline: {
      fontFamily: HEADLINE_FAMILY,
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700' as const,   // Bold
      fontStyle: 'italic' as const, // Italic voor PageHeader titels
    },
    sectionTitle: {
      fontFamily: INTER_FAMILY,
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '600' as const,   // SemiBold
    },
    bodyData: {
      fontFamily: INTER_FAMILY,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,   // Regular
    },
    caption: {
      fontFamily: INTER_FAMILY,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,   // Medium
      color: '#575B5F',
    },
  },

  // Layout primitives (radius + spacing)
  radius: {
    sm: 8,
    md: 10,
    lg: 14,
    xl: 18,
    pill: 999,
  },
  spacing: {
    s1: 4,
    s2: 8,
    s3: 12,
    s4: 16,
    s5: 20,
    s6: 24,
    s7: 28,
    s8: 32,
  },
};

export type DesignTokens = typeof designTokens;
export type ColorTokens = DesignTokens['colors'];
export type TypographyTokens = DesignTokens['typography'];

// Web-fallbacks voor de Two-Font System families (Playfair Display + Inter).
// Native build kan dit overschrijven via expo-font.
export const fontStacks = {
  headline: Platform.OS === 'web'
    ? '"Playfair Display", Georgia, serif'
    : 'serif',
  inter: Platform.OS === 'web'
    ? '"Inter", system-ui, -apple-system, sans-serif'
    : 'System',
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY ALIAS — `tokens` blijft beschikbaar zodat bestaande UI-primitives
// (PrimaryButton, StatusPill, etc.) niet breken. Mapt naar de nieuwe waarden.
// Nieuwe code dient `designTokens` of de `useDesignTokens()` hook te gebruiken.
// ─────────────────────────────────────────────────────────────────────────────

export const tokens = {
  // Calm palette aliassen
  cream:          designTokens.colors.background,
  creamSoft:      designTokens.colors.backgroundAlt,
  ink:            designTokens.colors.textPrimary,
  inkSoft:        designTokens.colors.textMuted,
  beige:          designTokens.colors.borderWarm,
  beigeSoft:      designTokens.colors.borderWarmAlt,
  forest:         designTokens.colors.statusSuccess,
  forestSoft:     'rgba(31,77,58,0.10)',
  terracotta:     designTokens.colors.statusWarning,
  terracottaSoft: 'rgba(248,131,99,0.12)',
  amber:          '#9a6c1c',
  amberSoft:      'rgba(154,108,28,0.12)',

  // Compat met eerste pass
  primary:        designTokens.colors.textPrimary,
  primarySoft:    'rgba(43,43,43,0.08)',
  primaryBorder:  'rgba(43,43,43,0.25)',
  danger:         designTokens.colors.statusWarning,
  dangerSoft:     'rgba(248,131,99,0.12)',
  warning:        '#9a6c1c',
  warningSoft:    'rgba(154,108,28,0.12)',
  surfaceWarm:    'rgba(244,236,221,0.5)',
  borderWarm:     designTokens.colors.borderWarm,
  borderWarmSoft: designTokens.colors.borderWarmAlt,
  hoverWarm:      'rgba(234,219,199,0.4)',

  // Radius
  radiusSm:   designTokens.radius.sm,
  radiusMd:   designTokens.radius.md,
  radiusLg:   designTokens.radius.lg,
  radiusXl:   designTokens.radius.xl,
  radiusPill: designTokens.radius.pill,

  // Spacing
  s1: designTokens.spacing.s1,
  s2: designTokens.spacing.s2,
  s3: designTokens.spacing.s3,
  s4: designTokens.spacing.s4,
  s5: designTokens.spacing.s5,
  s6: designTokens.spacing.s6,
  s7: designTokens.spacing.s7,
  s8: designTokens.spacing.s8,

  // Type
  fontSerif: fontStacks.headline,
  fontSans:  fontStacks.inter,

  titleLg: 40,
  titleMd: 32,
  titleSm: 22,
  body:    14,
  small:   12,
  micro:   10,
};

export type Tokens = typeof tokens;
