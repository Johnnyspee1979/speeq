// frontend/src/components/ui/PageHeader.tsx
//
// Two-Font System — schreeflettertype Playfair Display, Bold + Italic.
// Maximaal 1 Call to Action aan de rechterkant. Geen kleuren of fonts
// gehardcodeerd: alles komt uit `useTheme()`.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface PageHeaderProps {
  title: string;
  // Maximaal 1 CTA component toegestaan aan de rechterkant
  rightAction?: React.ReactNode;
}

export const PageHeader = ({ title, rightAction }: PageHeaderProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.borderWarm,
        },
      ]}
    >
      {/*
        Two-Font System: Serif Bold + Italic voor de titel.
        Haalt data verplicht uit designTokens.ts
      */}
      <Text
        style={{
          fontFamily: theme.typography.headline.fontFamily,
          fontSize: theme.typography.headline.fontSize,
          lineHeight: theme.typography.headline.lineHeight,
          color: theme.colors.textPrimary,
          fontWeight: '700',
          fontStyle: 'italic',
        }}
      >
        {title}
      </Text>

      {/* Container voor de PrimaryButton (max 1) */}
      {rightAction && (
        <View style={styles.actionContainer}>{rightAction}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1, // Warme border afscheiding
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
