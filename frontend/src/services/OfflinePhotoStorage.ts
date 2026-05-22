/**
 * OfflinePhotoStorage — platform-aware binary-storage voor foto's.
 *
 * Vervangt de eerdere "base64 in IndexedDB"-aanpak — die schaalde niet
 * boven ~50 foto's vanwege IndexedDB-limits en 33% base64-overhead.
 *
 * Strategie:
 *  - Native (iOS/Android): expo-file-system documentDirectory/photos/
 *    → files krijgen permanent file:// URI's
 *  - Web: Blob in localforage (efficiënter dan base64-string)
 *    → blob:// URL on-demand via URL.createObjectURL
 *
 * Beide kanten leveren één gezamenlijke API:
 *   savePhoto(uuid, dataUriOrBlob)  →  Promise<string>  (local URI)
 *   loadPhoto(uuid)                 →  Promise<string | null>
 *   removePhoto(uuid)               →  Promise<void>
 *   getPhotoSize(uuid)              →  Promise<number>  (bytes)
 *
 * URI's worden opgeslagen in LocalEvidenceRow.photo_uri en/of media_uri.
 * Sync-engine pakt deze op en uploadt naar Supabase Storage bij netwerk.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md §8.
 */

import { Platform } from 'react-native';
import localforage from 'localforage';

// ─── Public API types ───────────────────────────────────────────────────────

export interface OfflinePhotoStorage {
  init(): Promise<void>;
  /**
   * Sla een foto op. Input kan zijn:
   *  - data-URI string (data:image/jpeg;base64,...)
   *  - Blob object
   *  - File object
   *  - http(s):// URL (wordt eerst gefetcht)
   * Returns een lokale URI die direct in een <Image src> gebruikt kan worden.
   */
  savePhoto(uuid: string, input: string | Blob): Promise<string>;
  loadPhoto(uuid: string): Promise<string | null>;
  removePhoto(uuid: string): Promise<void>;
  getPhotoSize(uuid: string): Promise<number>;
  clearAll(): Promise<void>;
}

// ─── Native implementation (expo-file-system) ───────────────────────────────

async function createNativeStorage(): Promise<OfflinePhotoStorage> {
  // Lazy-import zodat web-bundle expo-file-system niet meeneemt.
  // 'expo-file-system/legacy' geeft de stable v55-API met documentDirectory +
  // EncodingType (de nieuwe Paths/File API is in alpha en breekt op web).
  const FileSystem = await import('expo-file-system/legacy');
  const PHOTOS_DIR = `${FileSystem.documentDirectory}speeq_photos/`;

  // Zorg dat folder bestaat
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }

  function pathFor(uuid: string): string {
    return `${PHOTOS_DIR}${uuid}.jpg`;
  }

  async function fetchAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Photo fetch faalt: ${response.status}`);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('FileReader gaf geen string'));
      reader.onerror = () => reject(new Error('FileReader fout'));
      reader.readAsDataURL(blob);
    });
  }

  return {
    async init() {
      /* dir is al boven aangemaakt */
    },

    async savePhoto(uuid, input) {
      const path = pathFor(uuid);

      // Pak base64 uit input
      let base64: string;
      if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          base64 = input.split(',')[1] ?? '';
        } else if (input.startsWith('file://')) {
          // Reeds een lokaal pad — kopieer naar onze folder
          await FileSystem.copyAsync({ from: input, to: path });
          return path;
        } else if (input.startsWith('http')) {
          // Externe URL — fetch + sla op
          const dataUri = await fetchAsBase64(input);
          base64 = dataUri.split(',')[1] ?? '';
        } else {
          // Aanname: pure base64 zonder data-prefix
          base64 = input;
        }
      } else {
        // Blob → base64
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('FileReader gaf geen string'));
          reader.onerror = () => reject(new Error('FileReader fout'));
          reader.readAsDataURL(input);
        });
        base64 = dataUri.split(',')[1] ?? '';
      }

      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return path;
    },

    async loadPhoto(uuid) {
      const path = pathFor(uuid);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists ? path : null;
    },

    async removePhoto(uuid) {
      const path = pathFor(uuid);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) await FileSystem.deleteAsync(path);
    },

    async getPhotoSize(uuid) {
      const path = pathFor(uuid);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists && 'size' in info ? (info.size as number) : 0;
    },

    async clearAll() {
      const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
      if (info.exists) {
        await FileSystem.deleteAsync(PHOTOS_DIR);
        await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
      }
    },
  };
}

// ─── Web implementation (Blob in IndexedDB) ──────────────────────────────────

async function createWebStorage(): Promise<OfflinePhotoStorage> {
  const photoStore = localforage.createInstance({
    name: 'speeq_offline',
    storeName: 'photo_blobs',
  });

  // Map van uuid → object-URL voor snelle lookup zonder herhaalde Blob-decodering.
  // Object-URLs blijven geldig tot URL.revokeObjectURL.
  const urlCache = new Map<string, string>();

  function dataUriToBlob(dataUri: string): Blob {
    const [meta, base64] = dataUri.split(',');
    const mimeMatch = /data:([^;]+);/.exec(meta);
    const mime = mimeMatch?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  return {
    async init() {
      /* localforage instances zijn lazy */
    },

    async savePhoto(uuid, input) {
      let blob: Blob;
      if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          blob = dataUriToBlob(input);
        } else if (input.startsWith('blob:')) {
          // Al een blob URL — fetch hem als Blob terug
          const r = await fetch(input);
          blob = await r.blob();
        } else if (input.startsWith('http')) {
          const r = await fetch(input);
          if (!r.ok) throw new Error(`Photo fetch faalt: ${r.status}`);
          blob = await r.blob();
        } else {
          // Pure base64 zonder data-prefix — vermoed jpeg
          blob = dataUriToBlob(`data:image/jpeg;base64,${input}`);
        }
      } else {
        blob = input;
      }

      await photoStore.setItem(uuid, blob);

      // Revoke oude object-URL als bestond
      const oldUrl = urlCache.get(uuid);
      if (oldUrl) URL.revokeObjectURL(oldUrl);

      const url = URL.createObjectURL(blob);
      urlCache.set(uuid, url);
      return url;
    },

    async loadPhoto(uuid) {
      // Bestaande object-URL hergebruiken
      const cached = urlCache.get(uuid);
      if (cached) return cached;

      const blob = await photoStore.getItem<Blob>(uuid);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(uuid, url);
      return url;
    },

    async removePhoto(uuid) {
      const cached = urlCache.get(uuid);
      if (cached) {
        URL.revokeObjectURL(cached);
        urlCache.delete(uuid);
      }
      await photoStore.removeItem(uuid);
    },

    async getPhotoSize(uuid) {
      const blob = await photoStore.getItem<Blob>(uuid);
      return blob?.size ?? 0;
    },

    async clearAll() {
      // Revoke alle URLs
      for (const url of urlCache.values()) URL.revokeObjectURL(url);
      urlCache.clear();
      await photoStore.clear();
    },
  };
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let cached: OfflinePhotoStorage | null = null;
let initPromise: Promise<OfflinePhotoStorage> | null = null;

export async function getOfflinePhotoStorage(): Promise<OfflinePhotoStorage> {
  if (cached) return cached;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const impl =
      Platform.OS === 'web' ? await createWebStorage() : await createNativeStorage();
    await impl.init();
    cached = impl;
    return impl;
  })();

  return initPromise;
}
