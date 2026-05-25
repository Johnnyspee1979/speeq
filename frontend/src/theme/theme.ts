export type Theme = {
  name: 'dark' | 'light' | 'modern';
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

// Claude Design v2 dark — zinc-950 met brighter navy/green voor legibility.
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background:    '#09090B',              // zinc-950
    surface:       '#18181B',              // zinc-900
    surfaceAlt:    '#27272A',              // zinc-800
    textPrimary:   '#FAFAFA',              // zinc-50
    textSecondary: '#A1A1AA',              // zinc-400
    border:        '#27272A',              // zinc-800
    accent:        '#3B6BA6',              // brighter navy voor dark mode
    accentMuted:   'rgba(59,107,166,0.15)',
    success:       '#22C55E',              // green-500 (brighter)
    warning:       '#F59E0B',              // amber-500
    danger:        '#EF4444',              // red-500
    chip:          '#27272A',
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
// Claude Design v2 light — navy + green + zinc (Johnny 25 mei: "één systeem").
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background:    '#FFFFFF',
    surface:       '#FFFFFF',
    surfaceAlt:    '#F4F4F5',              // zinc-100
    textPrimary:   '#18181B',              // zinc-900
    textSecondary: '#52525B',              // zinc-600
    border:        '#E4E4E7',              // zinc-200
    accent:        '#1B3A5C',              // navy (primary CTA)
    accentMuted:   'rgba(27,58,92,0.10)',
    success:       '#16A34A',              // green-600 (brand-green)
    warning:       '#D97706',              // orange-600
    danger:        '#DC2626',              // red-600
    chip:          '#18181B',
  },
};
