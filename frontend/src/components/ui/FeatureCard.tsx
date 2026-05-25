/**
 * FeatureCard — Warm Minimal kaart in shadcn-stijl, vertaald naar React Native.
 *
 * Per Johnny 25 mei: de tool moet er "makkelijker" uitzien.
 * Een shadcn FeatureCard (gezien op thiings.co) ademt rust via:
 *  • Veel witruimte (32px padding ipv 14)
 *  • Centred align
 *  • Ronde icoon-achtergrond met subtle bg
 *  • Soft border + rounded corners (16px)
 *  • Hover-lift op web (translateY -2px + shadow)
 *  • Compositionele opbouw: icon → titel → beschrijving
 *
 * Geen tailwind, geen className, geen framer-motion — alles met
 * RN StyleSheet + Pressable hover-states (web-only).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface FeatureCardProps {
  /** Icon-element bovenaan (Text/Emoji of <Image />). */
  icon: React.ReactNode;
  /** Titel — kort, max 3 woorden ideaal. */
  title: string;
  /** Beschrijving — 1-2 zinnen, niet te lang. */
  description?: string;
  /** Optionele tap-handler. Maakt card pressable + voegt focus-ring toe. */
  onPress?: () => void;
  /** Trailing slot (bv. een Switch, badge of chevron). */
  trailing?: React.ReactNode;
  /** Extra style override. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility-label voor screen readers. */
  accessibilityLabel?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  onPress,
  trailing,
  style,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Inner content — gedeeld tussen Pressable en View modes
  const content = (
    <>
      <View style={styles.iconWrap}>
        {typeof icon === 'string' ? (
          <Text style={styles.iconText}>{icon}</Text>
        ) : (
          icon
        )}
      </View>
      <View style={{ flex: 1, alignItems: trailing ? 'flex-start' : 'center' }}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={3}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.card, trailing ? styles.cardHorizontal : null, style]}
        accessibilityLabel={accessibilityLabel ?? title}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={(state) => {
        // RN-Web voegt 'hovered' toe maar @types/react-native kent 't niet.
        const hovered = (state as unknown as { hovered?: boolean }).hovered;
        return [
          styles.card,
          trailing ? styles.cardHorizontal : null,
          Platform.OS === 'web' && hovered ? styles.cardHovered : null,
          state.pressed ? styles.cardPressed : null,
          style,
        ];
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </Pressable>
  );
};

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.borderWarm,
      padding: 24,
      alignItems: 'center',
      gap: 16,
      // Subtle elevation op web (RN native krijgt niets standaard)
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'transform, box-shadow, border-color',
            transitionDuration: '180ms',
          } as unknown as ViewStyle)
        : {}),
    },
    cardHorizontal: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      gap: 14,
    },
    cardHovered: {
      transform: [{ translateY: -2 }],
      borderColor: theme.colors.borderWarm,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' } as unknown as ViewStyle)
        : {}),
    },
    cardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor:
        theme.name === 'dark'
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 26,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
      marginBottom: 4,
      textAlign: 'center',
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    trailing: {
      marginLeft: 'auto',
      alignSelf: 'center',
    },
  });
}

export default FeatureCard;
