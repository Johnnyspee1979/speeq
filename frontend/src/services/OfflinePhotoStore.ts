/**
 * OfflinePhotoStore — slaat foto's op in IndexedDB zodat ze een page-refresh
 * overleven en later naar de cloud gesynchroniseerd kunnen worden.
 *
 * Sprint 8 — opslagformaat verschoven van Base64 data-URL naar native Blob.
 *   • IndexedDB ondersteunt Blob native → ~33% kleiner op disk dan Base64.
 *   • Sync-loop kan blob direct uploaden, geen base64-roundtrip meer.
 *   • Backward compatible: oude data-URL strings worden bij retrieval nog
 *     herkend en correct behandeld zodat foto's uit eerdere sessies niet
 *     verloren gaan.
 *
 * Gebruik:
 *   const dataUrl = await persistOfflinePhoto(blobUrl, evidenceId);
 *   // dataUrl wordt opgeslagen als mediaUri in lokale database (display-compat)
 *
 *   // Sync-pad gebruikt de raw Blob (sneller, geen base64-bloat):
 *   const blob = await getOfflinePhotoBlob(evidenceId);
 *
 *   // Na succesvolle upload:
 *   await deleteOfflinePhoto(evidenceId);
 */

import { Platform } from 'react-native';

const STORE_NAME = 'offline_photos';
const DB_NAME    = 'wkb-offline-photos';
const DB_VERSION = 1;

type StoredValue = Blob | string; // Blob = nieuw formaat (Sprint 8), string = legacy data-URL

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror   = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<StoredValue | null> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as StoredValue) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: StoredValue): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbGetAllKeys(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Persisteer een foto in IndexedDB als native Blob.
 * Returnt nog steeds een data-URL string voor backward compat met de
 * `mediaUri` velden in de lokale evidence-database; sync.ts pakt
 * intern de Blob op via `getOfflinePhotoBlob` en omzeilt zo de
 * base64-conversie tijdens upload.
 */
export async function persistOfflinePhoto(
  photoUri: string,
  evidenceId: string
): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof indexedDB === 'undefined') return null;

  try {
    let blob: Blob;
    let dataUrl: string;

    if (photoUri.startsWith('data:')) {
      // Data-URL binnenkomend: zet om naar Blob voor opslag, maar de
      // returnwaarde blijft de originele data-URL (geen extra conversie nodig).
      const response = await fetch(photoUri);
      blob = await response.blob();
      dataUrl = photoUri;
    } else {
      // blob:// of http://: fetch → Blob → eenmalig data-URL voor caller.
      const response = await fetch(photoUri);
      blob = await response.blob();
      dataUrl = await blobToDataUrl(blob);
    }

    const db = await openDb();
    await idbPut(db, evidenceId, blob);
    console.log(
      `[OfflinePhotoStore] 💾 Foto opgeslagen als Blob (${(blob.size / 1024).toFixed(0)} KB) voor ${evidenceId}`
    );
    return dataUrl;
  } catch (err) {
    console.error('[OfflinePhotoStore] Opslaan mislukt:', err);
    return null;
  }
}

/**
 * Lees opgeslagen offline foto als data-URL string.
 * Backward compatible: als IDB nog een legacy data-URL string bevat
 * (van vóór Sprint 8) wordt die direct teruggegeven; nieuwe Blob-entries
 * worden ad-hoc geconverteerd.
 */
export async function getOfflinePhoto(evidenceId: string): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const value = await idbGet(db, evidenceId);
    if (!value) return null;
    if (typeof value === 'string') return value;             // legacy entry
    return await blobToDataUrl(value);                       // Sprint 8 entry
  } catch {
    return null;
  }
}

/**
 * Sprint 8 — geef de raw Blob terug. Gebruikt door sync.ts om uploads
 * zonder base64-roundtrip uit te voeren. Werkt ook voor legacy data-URL
 * entries: die worden on-the-fly omgezet.
 */
export async function getOfflinePhotoBlob(evidenceId: string): Promise<Blob | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const value = await idbGet(db, evidenceId);
    if (!value) return null;
    if (value instanceof Blob) return value;
    // Legacy: data-URL string → Blob via fetch
    const response = await fetch(value);
    return await response.blob();
  } catch {
    return null;
  }
}

/** Verwijder na succesvolle upload */
export async function deleteOfflinePhoto(evidenceId: string): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await idbDelete(db, evidenceId);
  } catch { /* stil falen */ }
}

/** Aantal opgeslagen offline foto's */
export async function getOfflinePhotoCount(): Promise<number> {
  if (Platform.OS !== 'web') return 0;
  if (typeof indexedDB === 'undefined') return 0;
  try {
    const db = await openDb();
    const keys = await idbGetAllKeys(db);
    return keys.length;
  } catch { return 0; }
}

// ── Hulpfunctie ───────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
