import { Platform } from 'react-native';
import { runSyncEngine } from './SyncEngine';

let inFlight = false;

export const triggerSyncIfOnline = async () => {
  if (inFlight) return;
  inFlight = true;
  try {
    await runSyncEngine();
  } finally {
    inFlight = false;
  }
};

export const registerAutoSync = (): (() => void) => {
  // ── Web: gebruik window online/offline events ────────────────────────────
  if (Platform.OS === 'web') {
    const handler = () => { void triggerSyncIfOnline(); };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }

  // ── Native: gebruik @react-native-community/netinfo ──────────────────────
  // Dynamic import voorkomt dat de web-bundle NetInfo probeert te importeren
  let unsubscribe: (() => void) | null = null;
  import('@react-native-community/netinfo').then(({ default: NetInfo }) => {
    unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void triggerSyncIfOnline();
    });
  }).catch(() => { /* NetInfo niet beschikbaar */ });

  return () => { unsubscribe?.(); };
};
