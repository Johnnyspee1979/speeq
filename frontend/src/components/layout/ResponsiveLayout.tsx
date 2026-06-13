import React, { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useTenantBranding } from '../../hooks/useTenantBranding';

export interface ResponsiveLayoutItem {
  key: string;
  label: string;
  desktopLabel?: string;
  icon?: React.ElementType;
}

interface ResponsiveLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  items: ResponsiveLayoutItem[];
  title: string;
  statusLabel?: string;
  desktopSubtitle?: string;
  userName?: string | null;
  headerRightAddon?: React.ReactNode;
  children: React.ReactNode;
}

// Web-only shadow helper
const webStyle = (styles: Record<string, unknown>) =>
  Platform.OS === 'web' ? (styles as any) : {};

/**
 * Per Johnny 25 mei: sidebar van 12 items voelt "te veel". Werk-items
 * dagelijks zichtbaar, instellingen achter "▼ Instellingen" collapse.
 * Niets verwijderd — alleen verborgen tot nodig.
 */
const SETTINGS_KEYS = new Set([
  'team',
  'branding',
  'modules',
  'presets',
  'dso',
  'about',
  'maker',
]);

export function ResponsiveLayout({
  activeTab,
  onTabChange,
  items,
  title,
  statusLabel,
  desktopSubtitle,
  userName,
  headerRightAddon,
  children,
}: ResponsiveLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const branding = useTenantBranding();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const brandTitle = branding.companyName ?? title;
  const brandColor = branding.primaryColor ?? theme.colors.accent;
  const brandLogo = branding.logoUrl ?? null;
  const styles = useMemo(
    () => createStyles(theme, isDesktop, brandColor),
    [theme, isDesktop, brandColor]
  );

  // Determine sync dot color from statusLabel
  const syncDotColor =
    statusLabel?.startsWith('✅') ? '#059669'
    : statusLabel?.startsWith('❌') ? '#DC2626'
    : statusLabel?.startsWith('⚠️') ? '#D97706'
    : '#3D4A62';

  const renderNavButton = (item: ResponsiveLayoutItem, mode: 'sidebar' | 'bottom') => {
    const active = activeTab === item.key;
    const label = mode === 'sidebar' ? item.desktopLabel ?? item.label : item.label;
    const IconComponent = item.icon;

    if (mode === 'bottom') {
      return (
        <TouchableOpacity
          key={`bottom-${item.key}`}
          style={[styles.bottomButton, active && styles.bottomButtonActive]}
          onPress={() => onTabChange(item.key)}
          activeOpacity={0.75}
        >
          {IconComponent ? (
            <IconComponent
              color={active ? '#FFFFFF' : theme.colors.textSecondary}
              size={20}
              strokeWidth={active ? 2.5 : 1.6}
            />
          ) : null}
          <Text
            style={[
              styles.bottomButtonText,
              active && styles.bottomButtonTextActive,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={`sidebar-${item.key}`}
        style={[styles.sidebarButton, active && styles.sidebarButtonActive]}
        onPress={() => onTabChange(item.key)}
        activeOpacity={0.75}
      >
        {active && <View style={styles.sidebarActiveBar} />}
        <View style={styles.sidebarButtonInner}>
          {IconComponent ? (
            <IconComponent
              color={active ? theme.colors.accent : theme.colors.textSecondary}
              size={17}
              strokeWidth={active ? 2.5 : 1.6}
            />
          ) : null}
          <Text
            style={[
              styles.sidebarButtonText,
              active && styles.sidebarButtonTextActive,
            ]}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top accent stripe */}
      <View style={styles.accentStripe} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <View style={styles.titleRow}>
              {brandLogo ? (
                <Image
                  source={{ uri: brandLogo }}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.titleDot} />
              )}
              <Text style={styles.title}>{brandTitle}</Text>
            </View>
            {isDesktop && desktopSubtitle ? (
              <Text style={styles.subtitle}>{desktopSubtitle}</Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            {headerRightAddon}
            {statusLabel ? (
              <View
                style={styles.statusPill}
                // Volle tekst zichtbaar op hover via title-attribute (web)
                {...(Platform.OS === 'web' ? { title: statusLabel } as object : {})}
              >
                <View style={[styles.statusDot, { backgroundColor: syncDotColor }]} />
                {/* Tekst verborgen op desktop — alleen bolletje. Tooltip toont
                    de volle melding. Per Johnny 25 mei: "Geen nieuwe uplo..." was
                    afgekapt en onduidelijk. */}
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.themeToggle}
              onPress={toggleTheme}
              accessibilityLabel="Wissel thema: warm → modern → donker"
              {...(Platform.OS === 'web'
                ? ({ title: `Thema: ${theme.name === 'modern' ? 'Modern' : theme.name === 'dark' ? 'Donker' : 'Warm'} — klik voor volgende` } as object)
                : {})}
            >
              <Text style={styles.themeToggleText}>
                {/* 2-mode toggle: ☀ light / ☾ dark */}
                {theme.name === 'dark' ? '☀' : '☾'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isDesktop ? (
        <View style={styles.desktopShell}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <Text style={styles.sidebarLabel}>WERKMODUS</Text>
            <View style={styles.sidebarDivider} />
            <SidebarItems
              items={items}
              activeTab={activeTab}
              renderNavButton={renderNavButton}
              styles={styles}
            />

            {/* Bottom brand mark */}
            <View style={styles.sidebarFooter}>
              <View style={[styles.titleDot, { opacity: 0.4 }]} />
              <Text style={styles.sidebarBrand}>{branding.companyName ?? 'Spee Solutions'}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.contentArea}>
            <View style={styles.contentFrame}>{children}</View>
          </View>
        </View>
      ) : (
        <View style={styles.mobileShell}>
          <View style={styles.mobileContent}>{children}</View>

          {/* Persoonlijke balk boven de tabs */}
          {userName ? (
            <View style={styles.userBar}>
              <Text style={styles.userBarText}>
                Hallo {userName}
              </Text>
              <Text style={styles.userBarBrand}>
                {branding.companyName ? `Made by Spee Solutions · ${branding.companyName}` : 'Made by Spee Solutions'}
              </Text>
            </View>
          ) : null}

          {/* Floating island nav */}
          <View style={styles.bottomNavWrapper}>
            <View
              style={[
                styles.bottomNav,
                webStyle({
                  boxShadow: '0 -1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)',
                }),
              ]}
            >
              {items.map((item) => renderNavButton(item, 'bottom'))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * SidebarItems — splits items in werk (zichtbaar) + instellingen (collapse).
 * Settings auto-expanded wanneer een settings-item actief is.
 */
interface SidebarItemsProps {
  items: ResponsiveLayoutItem[];
  activeTab: string;
  renderNavButton: (item: ResponsiveLayoutItem, mode: 'sidebar' | 'bottom') => React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}
function SidebarItems({ items, activeTab, renderNavButton, styles }: SidebarItemsProps) {
  const workItems = items.filter((it) => !SETTINGS_KEYS.has(it.key));
  const settingsItems = items.filter((it) => SETTINGS_KEYS.has(it.key));
  const activeIsSettings = settingsItems.some((it) => it.key === activeTab);
  const [showSettings, setShowSettings] = useState(false);
  const visible = showSettings || activeIsSettings;

  return (
    <>
      {workItems.map((item) => renderNavButton(item, 'sidebar'))}

      {settingsItems.length > 0 ? (
        <>
          <TouchableOpacity
            style={[styles.sidebarButton]}
            onPress={() => setShowSettings((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Instellingen verbergen' : 'Instellingen tonen'}
            accessibilityState={{ expanded: visible }}
          >
            <View style={styles.sidebarButtonInner}>
              <Text
                style={[
                  styles.sidebarButtonText,
                  { opacity: 0.7, fontStyle: 'italic', fontSize: 13 },
                ]}
              >
                {visible ? '▲ Instellingen' : '▼ Instellingen'}
              </Text>
            </View>
          </TouchableOpacity>
          {visible
            ? settingsItems.map((item) => renderNavButton(item, 'sidebar'))
            : null}
        </>
      ) : null}
    </>
  );
}

const createStyles = (
  theme: { name: 'dark' | 'light' | 'modern'; colors: Record<string, string> },
  isDesktop: boolean,
  brandColor: string
) => {
  const isDark = theme.name === 'dark';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    // Top accent stripe (3px brand color)
    accentStripe: {
      height: 3,
      backgroundColor: brandColor,
    },
    brandLogo: {
      width: isDesktop ? 32 : 24,
      height: isDesktop ? 32 : 24,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
    },

    // Header
    header: {
      paddingTop: isDesktop ? 18 : 12,
      paddingBottom: isDesktop ? 16 : 12,
      backgroundColor: theme.colors.surface,
    },
    headerRow: {
      width: '100%',
      maxWidth: isDesktop ? 1440 : undefined,
      paddingHorizontal: isDesktop ? 28 : 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerCopy: {
      flex: 1,
      paddingRight: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    titleDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: brandColor,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: isDesktop ? 22 : 18,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
      marginLeft: 16,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: 140,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusPillText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    themeToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },

    // Desktop layout
    desktopShell: {
      flex: 1,
      flexDirection: 'row',
    },
    sidebar: {
      width: 236,
      backgroundColor: theme.colors.surface,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
      paddingTop: 24,
      paddingHorizontal: 14,
      paddingBottom: 20,
      gap: 4,
    },
    sidebarLabel: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      paddingHorizontal: 12,
      marginBottom: 6,
    },
    sidebarDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    sidebarButton: {
      minHeight: 46,
      borderRadius: 10,
      paddingHorizontal: 12,
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    sidebarButtonActive: {
      backgroundColor: isDark ? 'rgba(164,13,47,0.08)' : 'rgba(164,13,47,0.06)',
    },
    sidebarActiveBar: {
      position: 'absolute',
      left: 0,
      top: 8,
      bottom: 8,
      width: 3,
      borderRadius: 2,
      backgroundColor: brandColor,
    },
    sidebarButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sidebarButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    sidebarButtonTextActive: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    sidebarFooter: {
      marginTop: 'auto' as any,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingTop: 20,
    },
    sidebarBrand: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      opacity: 0.6,
    },
    contentArea: {
      flex: 1,
      overflow: 'auto' as any,
    },
    contentFrame: {
      flex: 1,
      width: '100%',
      maxWidth: 1440,
      alignSelf: 'center',
    },

    // Mobile layout
    mobileShell: {
      flex: 1,
    },
    mobileContent: {
      flex: 1,
      overflow: 'auto' as any,
    },

    // Persoonlijke balk boven de tabs
    userBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 5,
    },
    userBarText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
      letterSpacing: 0.2,
    },
    userBarBrand: {
      fontSize: 10,
      fontWeight: '500',
      color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
      letterSpacing: 0.1,
    },

    // Floating island nav
    bottomNavWrapper: {
      paddingHorizontal: 10,
      paddingBottom: 10,
      paddingTop: 6,
      backgroundColor: theme.colors.background,
    },
    bottomNav: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#0C0F1C' : '#FFFFFF',
      borderRadius: 26,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    bottomButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 7,
      paddingHorizontal: 3,
      borderRadius: 18,
      minHeight: 52,
    },
    bottomButtonActive: {
      backgroundColor: brandColor,
    },
    bottomButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    bottomButtonTextActive: {
      color: '#FFFFFF',
    },
  });
};
