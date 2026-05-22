/**
 * OfflineSyncBootstrap — start/stop de OfflineSyncEngine op basis van
 * de tenant-toggle `offline_mode`. Rendert niets — pure side-effect.
 *
 * Wordt op app-niveau gemount via TenantProvider, zodat de engine
 * onafhankelijk van scherm-navigatie draait.
 *
 * Lifecycle:
 *   - offline_mode = true  → startOfflineSyncEngine()
 *   - offline_mode = false → stopOfflineSyncEngine()
 *   - tenant-switch (component unmount) → stopOfflineSyncEngine() via cleanup
 *
 * Idempotent — start/stop is no-op wanneer de engine al in juiste staat staat.
 */

import { useEffect } from 'react';
import {
  startOfflineSyncEngine,
  stopOfflineSyncEngine,
} from '../services/OfflineSyncEngine';
import { useOfflineMode } from '../hooks/useOfflineMode';

export function OfflineSyncBootstrap(): null {
  const offline = useOfflineMode();

  useEffect(() => {
    if (offline) {
      startOfflineSyncEngine();
    } else {
      stopOfflineSyncEngine();
    }
    return () => {
      // Bij unmount altijd opruimen — voorkomt timer-leaks bij tenant-switch
      stopOfflineSyncEngine();
    };
  }, [offline]);

  return null;
}
