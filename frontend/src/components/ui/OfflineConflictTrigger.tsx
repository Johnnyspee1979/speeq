/**
 * OfflineConflictTrigger — floating "Actie vereist" knop die alleen
 * verschijnt wanneer er sync-conflicts zijn die de werkvoorbereider
 * handmatig moet oplossen.
 *
 * Polling: countConflicts() elke 15s. Geen network-roundtrip nodig —
 * leest puur uit lokale SQLite/IDB.
 *
 * Klik → OfflineConflictResolutionModal.
 *
 * Positie: links van de OfflineSyncFloatingBadge (rechtsonder op desktop,
 * onderaan op mobiel). Self-hide bij offline_mode=false of 0 conflicts.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { designTokens } from '../../theme/designTokens';

const theme = designTokens;
import { useOfflineMode } from '../../hooks/useOfflineMode';
import { useSimpleMode } from '../../hooks/useSimpleMode';
import { countConflicts } from '../../services/OfflineConflictResolver';
import { OfflineConflictResolutionModal } from './OfflineConflictResolutionModal';

const POLL_INTERVAL_MS = 15_000;

export const OfflineConflictTrigger: React.FC = () => {
  const offline = useOfflineMode();
  const simpleMode = useSimpleMode();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const n = await countConflicts();
      setCount(n);
    } catch {
      /* lege storage of init-race — negeer */
    }
  }, []);

  useEffect(() => {
    if (!offline) return;
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [offline, refresh]);

  if (simpleMode) return null;
  if (!offline) return null;
  if (count === 0 && !modalOpen) return null;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.floating,
          isMobile ? styles.mobileAnchor : styles.desktopAnchor,
        ]}
      >
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          accessibilityLabel={`${count} sync-conflict${count === 1 ? '' : 'en'} — open`}
        >
          <Text style={styles.btnIcon}>!</Text>
          <Text style={styles.btnText}>
            {count} {count === 1 ? 'conflict' : 'conflicten'}
          </Text>
        </Pressable>
      </View>

      <OfflineConflictResolutionModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          void refresh();
        }}
        onAllResolved={() => {
          setCount(0);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  floating: {
    // @ts-ignore — 'fixed' is web-only voor RN-web; native negeert.
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    zIndex: 9998,
  },
  desktopAnchor: {
    right: 180,
    bottom: 24,
  },
  mobileAnchor: {
    left: 0,
    right: 0,
    bottom: 68,
    alignItems: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.statusWarning,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#2B2B2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnIcon: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    width: 22,
    height: 22,
    textAlign: 'center',
    lineHeight: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 11,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
