// frontend/src/components/ui/SecondaryButton.tsx
//
// Component-Driven Design — secundaire actie. Ondergeschikt aan PrimaryButton:
// transparante achtergrond + warme border. Geen schermschittering, geen
// hardgecodeerde hex. Integreert dynamisch met tenant_features white-labeling
// via de Warm Minimal `useTheme` hook.

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const SecondaryButton = ({ title, onPress, style, textStyle, disabled }: SecondaryButtonProps) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          // Verplichte transparante achtergrond met warme border
          backgroundColor: 'transparent',
          borderColor: theme.colors.borderWarm,
          borderWidth: 1,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            // Inter font (sans-serif) voor functionele acties
            fontFamily: theme.typography.sectionTitle.fontFamily,
            // Gebruik de diepe antracietkleur, absoluut GEEN puur zwart (#000000)
            color: theme.colors.textPrimary,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6, // Subtiel afgeronde hoeken passend bij de PrimaryButton
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row', // Puur Flexbox, GEEN CSS grid
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
