import NetInfo from '@react-native-community/netinfo';
import { syncEvidenceQueue, syncPresetsToCloud, type SyncResult } from './sync';

type ConnectivityState = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

type SyncEngineDependencies = {
  fetchNetworkState: () => Promise<ConnectivityState>;
  syncPresetsToCloud: () => Promise<number>;
  syncEvidenceQueue: () => Promise<SyncResult>;
};

const defaultDependencies: SyncEngineDependencies = {
  fetchNetworkState: () => NetInfo.fetch(),
  syncPresetsToCloud,
  syncEvidenceQueue,
};

const hasStableConnection = (state: ConnectivityState) =>
  Boolean(state.isConnected) &&
  (state.isInternetReachable == null || state.isInternetReachable === true);

export const runSyncEngine = async (
  dependencies: SyncEngineDependencies = defaultDependencies
): Promise<SyncResult> => {
  const networkState = await dependencies.fetchNetworkState();

  if (!hasStableConnection(networkState)) {
    return {
      status: 'skipped',
      count: 0,
      message: 'Geen stabiele internetverbinding voor synchronisatie.',
    };
  }

  await dependencies.syncPresetsToCloud();
  return dependencies.syncEvidenceQueue();
};

export { hasStableConnection };
