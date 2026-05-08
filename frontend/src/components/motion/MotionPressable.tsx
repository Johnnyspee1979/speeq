/**
 * MotionPressable — een knop met spring scale-feedback bij tap/hover.
 * Op web vervangt het de TouchableOpacity met Framer Motion-animatie.
 * Op native blijft het een standaard Pressable met activeOpacity.
 *
 * Gebruik:
 *   <MotionPressable onPress={handle} accessibilityLabel="Maak foto">
 *     <Text>📷</Text>
 *   </MotionPressable>
 *
 * Sprint 9 — design-2027.
 */

import React from 'react';
import { Platform, Pressable, ViewStyle, GestureResponderEvent } from 'react-native';

interface Props {
  onPress?: (e?: GestureResponderEvent) => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Hoeveel de knop schaalt bij press (default 0.94) */
  pressScale?: number;
  /** Hoeveel de knop schaalt bij hover (default 1.04, alleen web) */
  hoverScale?: number;
}

export default function MotionPressable({
  onPress,
  children,
  style,
  accessibilityLabel,
  disabled,
  pressScale = 0.94,
  hoverScale = 1.04,
}: Props) {
  if (Platform.OS === 'web') {
    const { motion } = require('framer-motion');
    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : (style ?? {});
    return (
      <motion.button
        type="button"
        onClick={disabled ? undefined : () => onPress?.()}
        disabled={disabled}
        aria-label={accessibilityLabel}
        whileHover={disabled ? undefined : { scale: hoverScale }}
        whileTap={disabled ? undefined : { scale: pressScale }}
        transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...flatStyle,
        }}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style ?? {}),
        { opacity: disabled ? 0.5 : pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}
