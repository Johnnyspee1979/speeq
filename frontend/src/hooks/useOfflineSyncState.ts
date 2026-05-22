/**
 * useOfflineSyncState — abonneert op de OfflineSyncEngine en geeft de
 * actuele sync-status terug voor UI-componenten.
 *
 * Gebruik bv. in een statusbalk:
 *   const sync = useOfflineSyncState();
 *   if (sync.status === 'syncing') return <Indicator />;
 *
 * Onderdeel van Week 4 deliverable (sync-status UI).
 */

import { useEffect, useState } from 'react';
import {
  subscribeOfflineSync,
  getOfflineSyncState,
  type OfflineSyncState,
} from '../services/OfflineSyncEngine';

export function useOfflineSyncState(): OfflineSyncState {
  const [state, setState] = useState<OfflineSyncState>(getOfflineSyncState());

  useEffect(() => {
    const unsubscribe = subscribeOfflineSync(setState);
    return unsubscribe;
  }, []);

  return state;
}
