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

// shadcn-stijl tokens (hardcoded — bewust losgekoppeld van Warm Minimal
// theme zodat deze primitive er identiek uitziet als het 21st.dev voorbeeld
// dat Johnny stuurde. Card = wit, border = slate-200, icon-bg = slate-100.)
const SHADCN = {
  cardBg:        '#FFFFFF',
  cardBorder:    '#E2E8F0', // slate-200
  iconBg:        '#F1F5F9', // slate-100
  textPrimary:   '#0F172A', // slate-900
  textMuted:     '#64748B', // slate-500
};

function createStyles(_theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    card: {
      backgroundColor: SHADCN.cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: SHADCN.cardBorder,
      padding: 32,
      alignItems: 'center',
      gap: 16,
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'transform, box-shadow, border-color',
            transitionDuration: '300ms',
            transitionTimingFunction: 'ease-in-out',
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
      transform: [{ translateY: -8 }],
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' } as unknown as ViewStyle)
        : {}),
    },
    cardPressed: {
      opacity: 0.92,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: SHADCN.iconBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    iconText: {
      fontSize: 28,
    },
    title: {
      color: SHADCN.textPrimary,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.3,
      marginBottom: 8,
      textAlign: 'center',
    },
    description: {
      color: SHADCN.textMuted,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
    },
    trailing: {
      marginLeft: 'auto',
      alignSelf: 'center',
    },
  });
}

export default FeatureCard;
