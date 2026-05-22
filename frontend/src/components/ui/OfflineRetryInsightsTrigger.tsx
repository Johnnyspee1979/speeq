/**
 * OfflineRetryInsightsTrigger — sleutel-combinatie (Ctrl+Shift+D) opent
 * het sync-diagnose-paneel. Niet op een knop, want de werkvoorbereider
 * heeft 'm 95% van de tijd niet nodig en het visueel toevoegen leidt
 * af van de hoofdtaak (foto's beoordelen).
 *
 * Op mobiel: long-press (1.5s) op de OfflineSyncFloatingBadge zou een
 * mooi gebaar zijn, maar dat vergt wijziging aan de badge zelf. Voor
 * nu: web-only via toetsenbord.
 *
 * Self-hide bij offline_mode = false.
 */

import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import { OfflineRetryInsightsPanel } from './OfflineRetryInsightsPanel';

export const OfflineRetryInsightsTrigger: React.FC = () => {
  const offline = useOfflineMode();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!offline) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+D — bewust niet conflicterend met browser-shortcuts
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offline]);

  if (!offline) return null;

  return (
    <OfflineRetryInsightsPanel visible={open} onClose={() => setOpen(false)} />
  );
};
