/**
 * MotionTabIndicator — een gedeelde "pill" die vloeiend tussen tabs animeert
 * op web via Framer Motion's `layoutId`. Op native rendert hij als een
 * standaard onderlijn-view.
 *
 * Sprint 9 — design-2027.
 */

import React from 'react';
import { Platform, View, ViewStyle } from 'react-native';

interface Props {
  active: boolean;
  color: string;
  /** Gedeelde layoutId per tab-bar — zelfde id over alle tabs in één bar! */
  layoutId: string;
}

export default function MotionTabIndicator({ active, color, layoutId }: Props) {
  if (!active) return null;

  if (Platform.OS === 'web') {
    // Lazy-import zodat native bundles framer-motion niet hoeven te kennen
    const { motion } = require('framer-motion');
    return (
      <motion.div
        layoutId={layoutId}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 32,
          mass: 0.6,
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -1,
          height: 2,
          background: color,
          borderRadius: 2,
        }}
      />
    );
  }

  // Native: gewone view (geen FLIP-magic, maar wel correct active state)
  const style: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    backgroundColor: color,
    borderRadius: 2,
  };
  return <View style={style} />;
}
