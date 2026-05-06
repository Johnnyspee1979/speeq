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
  // Blob-URLs (mobiele camera in PWA) en http-URLs werken NIET met expo-file-system.
  // De promise zou anders voor altijd hangen. Gebruik fetch + ArrayBuffer.
  if (mediaUri.startsWith('blob:') || mediaUri.startsWith('http')) {
    try {
      const response = await fetch(mediaUri);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      return createEvidenceHashFromBase64(base64);
    } catch {
      // Fallback: tijdstempel-hash zodat opslaan niet blokkeert
      return createEvidenceHashFromBase64(`fallback-${Date.now()}`);
    }
  }

  // Natief bestandspad — expo-file-system werkt hier correct
  const file = new File(mediaUri);
  const base64 = await file.base64();
  return createEvidenceHashFromBase64(base64);
};
