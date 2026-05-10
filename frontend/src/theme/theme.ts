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

// Light Govtech theme — SpeeQ brand
//   - Achtergrond: bijna-wit met subtiele blauw-grijze zweem (overheidssfeer)
//   - Primary text: SpeeQ donkerblauw uit het logo (#1B3A5C)
//   - Accent: SpeeQ groen uit het logo (#7CB94B) — koppelt merk aan "akkoord"
//     status, want dezelfde groene tint wordt gebruikt voor PASSED-bewijs.
//   - Borders: ultra-subtiel grijs voor de "Dutch Govtech" rust
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background:    '#F8FAFC',              // Bijna-wit met blauwzweem
    surface:       '#FFFFFF',              // Cards / panels
    surfaceAlt:    '#F1F5F9',              // Muted achtergrond (sidebar header etc.)
    textPrimary:   '#1B3A5C',              // SpeeQ donkerblauw (logo)
    textSecondary: '#64748B',              // Slate muted
    border:        'rgba(15,23,42,0.08)',  // Ultra-subtiel border
    accent:        '#7CB94B',              // SpeeQ groen (logo) — = success
    accentMuted:   '#EAF5DC',              // Lichte groene tint voor backgrounds/badges
    success:       '#7CB94B',              // Zelfde groen — accent IS success
    warning:       '#D97706',              // Amber
    danger:        '#DC2626',              // Red
    chip:          '#1B3A5C',              // Logo navy voor chips
  },
};
