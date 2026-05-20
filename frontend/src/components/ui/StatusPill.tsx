// frontend/src/components/ui/StatusPill.tsx
//
// Calm Design — gedempte aardse kleuren voor Laag 1 ("De Status").
// Geen schreeuwerige neon-verkeerslichten. Bosgroen voor goedgekeurd,
// terracotta voor actie vereist, warm grijs voor neutraal.
//
// Typografie: Inter-Medium via theme.typography.caption.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type StatusType = 'success' | 'warning' | 'neutral';

interface StatusPillProps {
  status: StatusType;
  label: string;
}

export const StatusPill = ({ status, label }: StatusPillProps) => {
  const { theme } = useTheme();

  // Bepaal de kleuren op basis van de status en onze design tokens
  const getPillStyles = () => {
    switch (status) {
      case 'success':
        return {
          backgroundColor: theme.colors.statusSuccess, // Gedempt bosgroen
          textColor: theme.colors.background,          // Lichte crèmekleur voor contrast
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.statusWarning, // Terracotta / zonsondergang-oranje
          textColor: theme.colors.textPrimary,         // Diep antraciet voor leesbaarheid
        };
      case 'neutral':
      default:
        return {
          backgroundColor: theme.colors.surfaceAlt,    // Warm grijs / beige
          textColor: theme.colors.textPrimary,
        };
    }
  };

  const { backgroundColor, textColor } = getPillStyles();

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text
        style={[
          styles.text,
          {
            fontFamily: theme.typography.caption.fontFamily, // Verplicht Inter-Medium
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            color: textColor,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 9999, // Extreem afgerond voor de duidelijke 'pill' vorm
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
