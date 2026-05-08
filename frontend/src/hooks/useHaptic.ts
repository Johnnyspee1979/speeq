/**
 * useHaptic — tactiele feedback voor mobiele acties.
 *
 * Sprint 9 — UI UX Pro Max guideline:
 *   "Tactile feedback improves interaction feel — use for confirmations
 *    and important actions; don't overuse on every tap."
 *
 * Web: Vibration API (navigator.vibrate). Werkt op Android Chrome/Firefox.
 *      iOS Safari ondersteunt het niet — silent no-op, geen crash.
 * Native (Expo): expo-haptics (lazy-loaded, valt terug op no-op als niet beschikbaar).
 *
 * Gebruik:
 *   const haptic = useHaptic();
 *   haptic('light');   // tap
 *   haptic('medium');  // confirmation
 *   haptic('heavy');   // critical action (lock dossier, delete, etc.)
 *   haptic('success'); // PASSED status
 *   haptic('warning'); // NEEDS_REVIEW
 *   haptic('error');   // FAILED / sync-failure
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';

export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   10,
  medium:  20,
  heavy:   40,
  success: [12, 30, 12],
  warning: [20, 30, 20],
  error:   [30, 60, 30, 60, 30],
};

let expoHaptics: typeof import('expo-haptics') | null = null;
function tryLoadExpoHaptics() {
  if (expoHaptics !== null) return expoHaptics;
  try {
    expoHaptics = require('expo-haptics');
  } catch {
    expoHaptics = null;
  }
  return expoHaptics;
}

export function useHaptic() {
  return useCallback((pattern: HapticPattern = 'light') => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(WEB_PATTERNS[pattern]); } catch { /* iOS ignores */ }
      }
      return;
    }

    const h = tryLoadExpoHaptics();
    if (!h) return;
    try {
      switch (pattern) {
        case 'light':   h.impactAsync(h.ImpactFeedbackStyle.Light); break;
        case 'medium':  h.impactAsync(h.ImpactFeedbackStyle.Medium); break;
        case 'heavy':   h.impactAsync(h.ImpactFeedbackStyle.Heavy); break;
        case 'success': h.notificationAsync(h.NotificationFeedbackType.Success); break;
        case 'warning': h.notificationAsync(h.NotificationFeedbackType.Warning); break;
        case 'error':   h.notificationAsync(h.NotificationFeedbackType.Error); break;
      }
    } catch { /* stil falen */ }
  }, []);
}
