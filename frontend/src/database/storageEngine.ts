import { Platform } from 'react-native';

export type RequestedStorageEngine = 'auto' | 'sqlite' | 'watermelon';
export type ActiveStorageEngine = 'web' | 'sqlite';

export type StorageEngineInfo = {
  requested: RequestedStorageEngine;
  active: ActiveStorageEngine;
  fallbackReason: string | null;
};

const normalizeRequestedEngine = (rawValue?: string | null): RequestedStorageEngine => {
  const normalized = String(rawValue ?? 'auto').trim().toLowerCase();

  if (normalized === 'sqlite') {
    return 'sqlite';
  }

  if (normalized === 'watermelon') {
    return 'watermelon';
  }

  return 'auto';
};

export const getStorageEngineInfo = (): StorageEngineInfo => {
  const requested = normalizeRequestedEngine(
    process.env.EXPO_PUBLIC_WKB_STORAGE_ENGINE
  );

  if (Platform.OS === 'web') {
    return {
      requested,
      active: 'web',
      fallbackReason:
        requested === 'watermelon'
          ? 'Web build gebruikt de web-store fallback; de Watermelon-migratie is alleen bedoeld voor native apparaten.'
          : null,
    };
  }

  if (requested === 'watermelon') {
    return {
      requested,
      active: 'sqlite',
      fallbackReason:
        'Deze build draait op de Watermelon-ready compatibiliteitslaag met een robuuste SQLite sync-queue.',
    };
  }

  return {
    requested,
    active: 'sqlite',
    fallbackReason: null,
  };
};

export const getStorageEngineLabel = () => {
  const info = getStorageEngineInfo();

  if (info.active === 'web') {
    return 'Web store';
  }

  return info.requested === 'watermelon' ? 'SQLite / Watermelon-ready' : 'SQLite';
};
