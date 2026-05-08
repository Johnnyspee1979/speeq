/**
 * MotionPanel — fade + subtiele slide bij content-wissel (bv. tab-switch).
 * Op web via Framer Motion `<AnimatePresence>`. Op native: directe render.
 *
 * Gebruik:
 *   <MotionPanel motionKey={activeTab}>
 *     {activeTab === 'dashboard' && <DashboardTab/>}
 *     {activeTab === 'bewijs' && <BewijsTab/>}
 *   </MotionPanel>
 *
 * Sprint 9 — design-2027.
 */

import React from 'react';
import { Platform, View } from 'react-native';

interface Props {
  /** Verandert deze, dan triggert de exit/enter-animatie (key-based). */
  motionKey: string;
  children: React.ReactNode;
}

export default function MotionPanel({ motionKey, children }: Props) {
  if (Platform.OS === 'web') {
    const { motion, AnimatePresence } = require('framer-motion');
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={motionKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{
            duration: 0.22,
            ease: [0.32, 0.72, 0, 1], // sterke easing — Apple-stijl
          }}
          style={{ width: '100%' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return <View style={{ width: '100%' }}>{children}</View>;
}
