import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type Props = TouchableOpacityProps & {
  label: string;
  loading?: boolean;
  size?: 'sm' | 'md';
};

export function PrimaryButton({
  label,
  loading,
  size = 'md',
  disabled,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...rest}
      activeOpacity={0.85}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.textPrimary,
          borderRadius: theme.radius.md,
        },
        size === 'sm' ? styles.sm : styles.md,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.background} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' && styles.textSm,
            { color: theme.colors.background },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sm: { paddingHorizontal: 12, paddingVertical: 7, minHeight: 32 },
  md: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 40 },
  disabled: { opacity: 0.55 },
  text: { fontWeight: '700', fontSize: 13, letterSpacing: 0.2 },
  textSm: { fontSize: 12 },
});
