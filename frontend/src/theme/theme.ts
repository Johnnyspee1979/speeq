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

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background:    '#F0F2F8',
    surface:       '#FFFFFF',
    surfaceAlt:    '#E8ECF5',
    textPrimary:   '#0A0D18',
    textSecondary: '#6B7280',
    border:        'rgba(0,0,0,0.08)',
    accent:        '#A40D2F',
    accentMuted:   '#FDE8ED',
    success:       '#059669',
    warning:       '#D97706',
    danger:        '#DC2626',
    chip:          '#0A0D18',
  },
};
