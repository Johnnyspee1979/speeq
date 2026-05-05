import NetInfo from '@react-native-community/netinfo';
import { runSyncEngine } from './SyncEngine';

let inFlight = false;

export const triggerSyncIfOnline = async () => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await runSyncEngine();
  } finally {
    inFlight = false;
  }
};

export const registerAutoSync = () => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      triggerSyncIfOnline();
    }
  });

  return unsubscribe;
};
