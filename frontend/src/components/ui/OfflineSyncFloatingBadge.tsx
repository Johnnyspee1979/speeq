/**
 * OfflineSyncFloatingBadge — floating wrapper rond SyncStatusBadge.
 *
 * Wordt op app-level in TenantProvider gemount, zodat de sync-status
 * altijd zichtbaar is wanneer offline-mode actief is — ongeacht welk
 * scherm de klant op zit.
 *
 * Positie:
 *   - Desktop / web: rechtsonder, 20px margin (boven de Vercel-watermark)
 *   - Mobiel: bottom-center, 16px margin van onderkant
 *
 * Zelf-verbergt wanneer offline_mode = false. Geen klant-impact in
 * cloud-mode (geen extra render-werk).
 *
 * Onderdeel van Week 4 deliverable, ge-wired in een wiring-PR (post-roadmap).
 */

import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SyncStatusBadge } from './SyncStatusBadge';
import { useOfflineMode } from '../../hooks/useOfflineMode';

export const OfflineSyncFloatingBadge: React.FC = () => {
  const offline = useOfflineMode();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!offline) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floating,
        isMobile ? styles.mobileAnchor : styles.desktopAnchor,
      ]}
    >
      <SyncStatusBadge compact />
    </View>
  );
};

const styles = StyleSheet.create({
  floating: {
    // @ts-ignore — 'fixed' is web-only en valide voor RN-web,
    // op native valt 'ie terug op 'absolute' (RN negeert onbekende waardes).
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    zIndex: 9999,
  },
  desktopAnchor: {
    right: 20,
    bottom: 20,
  },
  mobileAnchor: {
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
  },
});
