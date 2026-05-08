/**
 * OfflinePhotoStore — slaat foto's op als base64 data-URL in IndexedDB
 *
 * Waarom: blob:// URLs zijn vluchtig — ze verdwijnen bij page refresh of
 * tab-sluiting. IndexedDB overleeft dat wél. Zodra het netwerk terugkomt
 * laadt syncEvidenceQueue() de data-URL en upload hij de foto.
 *
 * Gebruik:
 *   const dataUrl = await persistOfflinePhoto(blobUrl, evidenceId);
 *   // Sla dataUrl op als mediaUri in lokale database
 *
 *   // Na succesvolle sync:
 *   await deleteOfflinePhoto(evidenceId);
 */

import { Platform } from 'react-native';

const STORE_NAME = 'offline_photos';
const DB_NAME    = 'wkb-offline-photos';
const DB_VERSION = 1;

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

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
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

/** Zet een blob:// of http URL om naar een data:// URL en sla op in IndexedDB */
export async function persistOfflinePhoto(
  photoUri: string,
  evidenceId: string
): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof indexedDB === 'undefined') return null;

  try {
    // Al een data-URL → direct opslaan (geen fetch nodig)
    if (photoUri.startsWith('data:')) {
      const db = await openDb();
      await idbPut(db, evidenceId, photoUri);
      return photoUri;
    }

    // blob:// of http:// → ophalen als blob → omzetten naar base64 data-URL
    const response = await fetch(photoUri);
    const blob     = await response.blob();
    const dataUrl  = await blobToDataUrl(blob);
    const db       = await openDb();
    await idbPut(db, evidenceId, dataUrl);
    console.log(`[OfflinePhotoStore] 💾 Foto opgeslagen (${(dataUrl.length / 1024).toFixed(0)} KB) voor ${evidenceId}`);
    return dataUrl;
  } catch (err) {
    console.error('[OfflinePhotoStore] Opslaan mislukt:', err);
    return null;
  }
}

/** Lees opgeslagen offline foto op */
export async function getOfflinePhoto(evidenceId: string): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return idbGet(db, evidenceId);
  } catch { return null; }
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
