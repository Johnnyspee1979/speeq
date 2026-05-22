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
import {
  attachOfflineServiceWorkerBridge,
  detachOfflineServiceWorkerBridge,
  registerOfflineSyncTag,
} from '../services/OfflineServiceWorkerBridge';
import { useOfflineMode } from '../hooks/useOfflineMode';

export function OfflineSyncBootstrap(): null {
  const offline = useOfflineMode();

  useEffect(() => {
    if (offline) {
      startOfflineSyncEngine();
      attachOfflineServiceWorkerBridge();
      // Tag-registratie is best-effort — Safari/Firefox-stable hebben geen
      // SyncManager, dan valt het terug op de periodieke timer in de engine.
      void registerOfflineSyncTag();
    } else {
      stopOfflineSyncEngine();
      detachOfflineServiceWorkerBridge();
    }
    return () => {
      // Bij unmount altijd opruimen — voorkomt timer-leaks bij tenant-switch
      stopOfflineSyncEngine();
      detachOfflineServiceWorkerBridge();
    };
  }, [offline]);

  return null;
}
