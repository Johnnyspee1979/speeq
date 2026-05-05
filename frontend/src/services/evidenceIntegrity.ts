import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

export const createEvidenceId = () => {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `wkb-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const createEvidenceHashFromBase64 = async (base64: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);

export const createEvidenceHash = async (mediaUri: string) => {
  const file = new File(mediaUri);
  const base64 = await file.base64();

  return createEvidenceHashFromBase64(base64);
};
