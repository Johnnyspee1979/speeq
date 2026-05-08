/**
 * useNetworkSync — detecteert online/offline en triggert automatische sync
 *
 * Werkt uitsluitend op web (Platform.OS === 'web').
 * Native loopt via @react-native-community/netinfo (autoSync.ts).
 *
 * Wat het doet:
 *  1. Luistert naar window 'online'/'offline' events
 *  2. Bij 'online': roept syncEvidenceQueue() aan → upload wachtrij
 *  3. Registreert Service Worker Background Sync zodat sync ook werkt
 *     wanneer de PWA in de achtergrond zit
 *  4. Herhaalt sync elke 30 seconden als er items in de wachtrij zitten
 *
 * Gebruik:
 *   const { isOnline, isSyncing, pendingCount } = useNetworkSync();
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { syncEvidenceQueue } from '../services/sync';
import { getUnsyncedEvidence } from '../database/database';

export interface NetworkSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedCount: number;
  lastSyncAt: Date | null;
}

// Singleton guard — voorkomt dubbele sync-runs over meerdere hook instances
let syncInFlight = false;

async function runSync(): Promise<number> {
  if (syncInFlight) return 0;
  syncInFlight = true;
  try {
    const result = await syncEvidenceQueue();
    return result.status === 'synced' ? result.count : 0;
  } finally {
    syncInFlight = false;
  }
}

/** Registreer SW Background Sync tag (als de browser dat ondersteunt) */
export async function registerBgSync(): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('SyncManager' in window)
  ) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore — SyncManager is niet in alle TypeScript lib.dom versies
    await reg.sync.register('wkb-sync-evidence');
  } catch { /* niet ondersteund of blocked */ }
}

export function useNetworkSync(): NetworkSyncState {
  const [isOnline,        setIsOnline]        = useState(() =>
    Platform.OS === 'web' ? navigator.onLine : true
  );
  const [isSyncing,       setIsSyncing]       = useState(false);
  const [pendingCount,    setPendingCount]    = useState(0);
  const [lastSyncedCount, setLastSyncedCount] = useState(0);
  const [lastSyncAt,      setLastSyncAt]      = useState<Date | null>(null);

  const retryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const items = await getUnsyncedEvidence();
      setPendingCount(items.length);
    } catch { /* ignore */ }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const synced = await runSync();
      if (synced > 0) {
        setLastSyncedCount(synced);
        setLastSyncAt(new Date());
      }
      await refreshPending();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPending]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // ── Initialisatie ────────────────────────────────────────────────────────
    void refreshPending();

    // ── Online / offline events ──────────────────────────────────────────────
    const onOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };
    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // ── SW Background Sync bericht van service worker ────────────────────────
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BG_SYNC_REQUESTED') {
        void triggerSync();
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    // ── Interval: retry elke 30s als er wachtrij-items zijn ─────────────────
    retryTimer.current = setInterval(async () => {
      const items = await getUnsyncedEvidence().catch(() => []);
      if (items.length > 0 && navigator.onLine) {
        void triggerSync();
      }
    }, 30_000);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      if (retryTimer.current) clearInterval(retryTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh pending count na sync
  useEffect(() => {
    if (!isSyncing) void refreshPending();
  }, [isSyncing, refreshPending]);

  return { isOnline, isSyncing, pendingCount, lastSyncedCount, lastSyncAt };
}
