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
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background:    '#04060E',              // Space black
    surface:       '#080B14',              // Deep navy surface
    surfaceAlt:    '#0C0F1C',              // Card layer
    textPrimary:   '#ECEEF4',              // Warm near-white
    textSecondary: '#3D4A62',              // Deep slate muted
    border:        'rgba(255,255,255,0.07)', // Ultra-subtle glass border
    accent:        '#A40D2F',              // Spee Solutions Rood
    accentMuted:   '#0E0509',              // Near-black red tint
    success:       '#059669',              // Emerald
    warning:       '#D97706',              // Amber
    danger:        '#DC2626',              // Red
    chip:          '#1A2236',              // Dark chip bg
  },
};

// Light Calm Design theme — SpeeQ premium
//   - Achtergrond: warm cream (#FBF6EE) — geen puur wit, geen techno-blauw
//   - Primary text: antraciet (#2B2B2B) — geen puur zwart
//   - Accent: bosgroen (#1F4D3A) voor succes/approved
//   - Borders: warm beige (#EADBC7)
//   - Danger/accent: terracotta (#F88363) — warm, niet schreeuwerig
// Volgt `designTokens.colors` 1-op-1 zodat bestaande schermen (die via
// `theme.colors.X` werken) automatisch het Warm Minimal palet adopteren.
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background:    '#FBF6EE',              // designTokens.colors.background
    surface:       '#F3EDE2',              // = backgroundAlt — cards staan iets dieper dan root
    surfaceAlt:    '#EADBC7',              // designTokens.colors.surface — tactiele beige
    textPrimary:   '#2B2B2B',              // designTokens.colors.textPrimary
    textSecondary: '#2F2A25',              // designTokens.colors.textSecondary (espresso)
    border:        '#C9B099',              // designTokens.colors.borderWarm
    accent:        '#1F4D3A',              // statusSuccess (bosgroen)
    accentMuted:   'rgba(31,77,58,0.10)',  // Soft forest tint
    success:       '#1F4D3A',
    warning:       '#9A6C1C',              // Rustige amber
    danger:        '#F88363',              // statusWarning (terracotta)
    chip:          '#2B2B2B',
  },
};
