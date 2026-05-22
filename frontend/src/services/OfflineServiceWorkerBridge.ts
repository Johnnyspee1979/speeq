/**
 * OfflineServiceWorkerBridge — koppelt de browser Service Worker
 * (web/sw.js) aan de OfflineSyncEngine.
 *
 * Wat dit oplost:
 *   sw.js heeft een `sync` event-handler die bij Background Sync
 *   `BG_SYNC_REQUESTED` postMessage'd naar open tabs. De bestaande
 *   useNetworkSync-hook luistert hier al naar, maar die hook werkt
 *   tegen de OUDE cloud-mode queue. De nieuwe OfflineSyncEngine
 *   (offline-mode toggle) kende dit signaal nog niet.
 *
 * Wat het doet:
 *   - Registreert het 'wkb-sync-evidence' sync-tag bij de SW zodra
 *     offline-mode actief is en er pending items zijn.
 *   - Luistert op `BG_SYNC_REQUESTED` messages en triggert
 *     syncOfflineQueueNow().
 *
 * Beide bridges (useNetworkSync + deze) kunnen naast elkaar bestaan —
 * elk reageert op zijn eigen queue. Bij tenants die op offline-mode
 * staan is de cloud-mode queue leeg, en omgekeerd.
 *
 * Aan te roepen in een top-level provider (TenantProvider o.i.d.)
 * wanneer offline-mode actief is. Idempotent — herhaalde aanroep is
 * no-op.
 *
 * Onderdeel van docs/strategie/offline-mode-roadmap.md (week 8+).
 */

import { Platform } from 'react-native';
import { syncOfflineQueueNow } from './OfflineSyncEngine';

let attached = false;
let messageHandler: ((event: MessageEvent) => void) | null = null;

/**
 * Registreer de Background Sync tag bij de Service Worker.
 * Returnt true bij succes, false als SyncManager niet beschikbaar is
 * (Safari, Firefox-stable, etc. — fallback is dan de periodieke timer
 * in OfflineSyncEngine).
 */
export async function registerOfflineSyncTag(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (typeof window === 'undefined' || !('SyncManager' in window)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error — SyncManager type niet in alle lib.dom versies
    await reg.sync.register('wkb-sync-evidence');
    return true;
  } catch {
    return false;
  }
}

/**
 * Start luisteren naar SW-messages. Idempotent.
 */
export function attachOfflineServiceWorkerBridge(): void {
  if (attached) return;
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  messageHandler = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (data?.type === 'BG_SYNC_REQUESTED') {
      void syncOfflineQueueNow();
    }
  };
  navigator.serviceWorker.addEventListener('message', messageHandler);
  attached = true;
}

/**
 * Stop luisteren. Cleanup bij offline-mode uitschakelen.
 */
export function detachOfflineServiceWorkerBridge(): void {
  if (!attached) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    attached = false;
    return;
  }
  if (messageHandler) {
    navigator.serviceWorker.removeEventListener('message', messageHandler);
    messageHandler = null;
  }
  attached = false;
}

/**
 * Voor tests — reset interne staat.
 * @internal
 */
export function __resetOfflineServiceWorkerBridgeForTests(): void {
  attached = false;
  messageHandler = null;
}
