// frontend/src/components/ui/PageHeader.tsx
//
// Claude Design v2 — display font Bricolage Grotesque, géén italic.
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
        Claude Design v2 — Bricolage Grotesque, géén italic.
        Alle waarden via designTokens.typography.headline (single source of truth).
      */}
      <Text
        style={{
          fontFamily: theme.typography.headline.fontFamily,
          fontSize: theme.typography.headline.fontSize,
          lineHeight: theme.typography.headline.lineHeight,
          color: theme.colors.textPrimary,
          fontWeight: '700',
          letterSpacing: -0.5,
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
