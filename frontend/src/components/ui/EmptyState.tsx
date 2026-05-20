import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon = '📭', title, subtitle, action }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.backgroundAlt,
          borderColor: theme.colors.borderWarmAlt,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.s8,
          marginBottom: theme.spacing.s4,
        },
      ]}
    >
      <Text style={[styles.icon, { marginBottom: theme.spacing.s2 }]}>{icon}</Text>
      <Text
        style={[
          styles.title,
          { color: theme.colors.textPrimary, marginBottom: theme.spacing.s1 },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
      {action ? (
        <View style={[styles.actionWrap, { marginTop: theme.spacing.s4 }]}>
          {action}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, alignItems: 'center' },
  icon: { fontSize: 32 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 19,
  },
  actionWrap: { alignItems: 'center' },
});
