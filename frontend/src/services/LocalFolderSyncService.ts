/**
 * LocalFolderSyncService — schrijft borgingsbewijzen direct naar een map op de PC.
 *
 * Gebruikt de File System Access API (Chrome 86+ / Edge 86+).
 * De gekozen map-handle wordt opgeslagen in IndexedDB zodat de gebruiker
 * slechts één keer een map hoeft te kiezen.
 *
 * Werkt NIET in Firefox of Safari — geeft dan een duidelijke melding.
 *
 * Mappenstructuur op de PC:
 *   [Gekozen map]/
 *     └── [ProjectNaam]/
 *         └── [borgingspuntID]/
 *             ├── 2025-05-02_14-32_foto_abc123.jpg
 *             └── 2025-05-02_14-32_notitie_abc123.txt
 */

// ─── Feature detection ────────────────────────────────────────────────────────

export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME    = 'wkb-folder-sync-v1';
const STORE_NAME = 'handles';
const DB_VERSION = 1;

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(key);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteHandle(key: string): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ─── Permission helpers ───────────────────────────────────────────────────────

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    // @ts-expect-error — FileSystemHandle.queryPermission is in the spec but missing from TS lib
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    // @ts-expect-error
    const req = await handle.requestPermission({ mode: 'readwrite' });
    return req === 'granted';
  } catch {
    return false;
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function safeName(name: string): string {
  return (name ?? 'onbekend').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'onbekend';
}

function stampToFilename(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'PASSED':       return '✅ Goedgekeurd';
    case 'FAILED':       return '❌ Afgekeurd';
    case 'NEEDS_REVIEW': return '⚠️ Review vereist';
    case 'PENDING':      return '⏳ In behandeling';
    default:             return '○ Onbekend';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FolderSyncStatus {
  linked: boolean;
  folderName: string | null;   // naam van de gekozen bovenliggende map
  lastSync: string | null;     // ISO timestamp van laatste succesvolle sync
  syncedCount: number;
}

/** De sleutel waarmee de handle per project wordt opgeslagen */
function handleKey(projectId: string): string {
  return `project_${projectId}`;
}

/**
 * Vraagt de gebruiker eenmalig een map te kiezen.
 * Slaat de handle op in IndexedDB voor toekomstige sessies.
 */
export async function requestFolderAccess(projectId: string): Promise<string | null> {
  if (!isFolderSyncSupported()) return null;
  try {
    // @ts-expect-error — showDirectoryPicker not yet in all TS libs
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: `wkb-project-${projectId}`,
      mode: 'readwrite',
      startIn: 'documents',
    });
    await saveHandle(handleKey(projectId), handle);
    return handle.name;
  } catch {
    // Gebruiker heeft geannuleerd
    return null;
  }
}

/**
 * Verwijdert de gekoppelde map voor een project.
 */
export async function unlinkFolder(projectId: string): Promise<void> {
  await deleteHandle(handleKey(projectId));
}

/**
 * Geeft de naam van de gekoppelde map terug, of null als er geen is.
 */
export async function getLinkedFolderName(projectId: string): Promise<string | null> {
  try {
    const handle = await loadHandle(handleKey(projectId));
    return handle?.name ?? null;
  } catch {
    return null;
  }
}

// ─── Typen voor evidence ──────────────────────────────────────────────────────

export interface SyncEvidenceRow {
  id: string;
  inspection_point_id: string;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string;
  ai_status: string | null;
  ai_notes: string | null;
  field_note: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

export interface FileSyncResult {
  ok: boolean;
  synced: number;
  skipped: number;
  errors: string[];
  noPermission?: boolean;
  notSupported?: boolean;
  noFolder?: boolean;
}

/**
 * Synchroniseert een lijst van evidence-items naar de gekoppelde PC-map.
 * Bestanden die al bestaan worden overgeslagen (idempotent).
 */
export async function syncToLocalFolder(
  projectId: string,
  projectName: string,
  items: SyncEvidenceRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<FileSyncResult> {

  if (!isFolderSyncSupported()) {
    return { ok: false, synced: 0, skipped: 0, errors: [], notSupported: true };
  }

  const handle = await loadHandle(handleKey(projectId));
  if (!handle) {
    return { ok: false, synced: 0, skipped: 0, errors: [], noFolder: true };
  }

  const hasPermission = await verifyPermission(handle);
  if (!hasPermission) {
    return { ok: false, synced: 0, skipped: 0, errors: [], noPermission: true };
  }

  // Map: [gekozen map] / [ProjectNaam] / [borgingspuntID] / bestanden
  const projectFolder = await handle.getDirectoryHandle(safeName(projectName), { create: true });

  let synced  = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item     = items[i];
    const stamp    = stampToFilename(item.timestamp);
    const shortId  = item.id.slice(0, 8);
    const photoUrl = item.media_uri ?? item.photo_uri ?? null;

    try {
      const pointFolder = await projectFolder.getDirectoryHandle(
        safeName(item.inspection_point_id), { create: true }
      );

      // ── Foto ──
      if (photoUrl) {
        const fotoName = `${stamp}_foto_${shortId}.jpg`;
        // Controleer of bestand al bestaat (skip als ja)
        let alreadyExists = false;
        try {
          await pointFolder.getFileHandle(fotoName, { create: false });
          alreadyExists = true;
        } catch { /* bestaat niet */ }

        if (!alreadyExists) {
          const res  = await fetch(photoUrl);
          if (res.ok) {
            const buf        = await res.arrayBuffer();
            const fileHandle = await pointFolder.getFileHandle(fotoName, { create: true });
            const writable   = await fileHandle.createWritable();
            await writable.write(buf);
            await writable.close();
            synced++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      }

      // ── Notitie (altijd overschrijven zodat AI-status up-to-date is) ──
      const hasNote = item.field_note || item.ai_notes || item.ai_status;
      if (hasNote) {
        let txt  = `Borgingspunt : ${item.inspection_point_id}\n`;
        txt += `Tijdstip     : ${new Date(item.timestamp).toLocaleString('nl-NL')}\n`;
        txt += `Status       : ${statusLabel(item.ai_status)}\n`;
        if (item.field_note)  txt += `\nNotitie vakman:\n${item.field_note}\n`;
        if (item.ai_notes)    txt += `\nAI beoordeling:\n${item.ai_notes}\n`;
        if (item.gps_lat && item.gps_lng) {
          txt += `\nGPS: https://maps.google.com/?q=${item.gps_lat},${item.gps_lng}\n`;
        }

        const noteName   = `${stamp}_notitie_${shortId}.txt`;
        const noteHandle = await pointFolder.getFileHandle(noteName, { create: true });
        const writable   = await noteHandle.createWritable();
        await writable.write(new Blob([txt], { type: 'text/plain' }));
        await writable.close();
      }

    } catch (err) {
      errors.push(`${shortId}: ${err instanceof Error ? err.message : 'onbekende fout'}`);
    }

    onProgress?.(i + 1, items.length);
  }

  return { ok: true, synced, skipped, errors };
}
