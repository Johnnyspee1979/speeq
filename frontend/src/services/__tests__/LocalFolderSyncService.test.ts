/**
 * @jest-environment jsdom
 *
 * Gedrag-tests voor de lokale-map-sync (services/LocalFolderSyncService.ts). Deze
 * module schrijft borgingsbewijzen (foto + notitie) via de File System Access API
 * naar een door de gebruiker gekozen PC-map en bewaart de gekozen map-handle in
 * IndexedDB. Een fout hier laat bewijzen niet (of dubbel) wegschrijven, of mist
 * een ontbrekende-rechten/-map situatie. We borgen de publieke API + de guard-
 * logica met een compacte in-memory IndexedDB- en FileSystem-handle-shim:
 *  - isFolderSyncSupported() volgt window.showDirectoryPicker;
 *  - requestFolderAccess geeft de mapnaam terug, of null bij annuleren/niet-support;
 *  - getLinkedFolderName/unlinkFolder doen een correcte IndexedDB-roundtrip;
 *  - syncToLocalFolder geeft notSupported / noFolder / noPermission op de juiste
 *    momenten, en schrijft in het happy-path foto + notitie (idempotent: bestaande
 *    foto wordt overgeslagen).
 *
 * Geen RN/Expo nodig; window komt uit jsdom, indexedDB/fetch/showDirectoryPicker
 * worden per test geïnjecteerd. fake-indexeddb is niet beschikbaar → eigen shim.
 */

import {
  isFolderSyncSupported,
  requestFolderAccess,
  unlinkFolder,
  getLinkedFolderName,
  syncToLocalFolder,
  type SyncEvidenceRow,
} from '../LocalFolderSyncService';

// ─── Minimale, event-correcte IndexedDB-shim ────────────────────────────────────
// Ondersteunt exact wat de module gebruikt: open → (onupgradeneeded→createObjectStore)
// → onsuccess; transaction/objectStore met put/delete (tx.oncomplete) en get
// (req.onsuccess + req.result). Eén gedeelde opslag over alle open()-calls.
type Store = Map<string, unknown>;
function makeFakeIndexedDB() {
  const dbs = new Map<string, Map<string, Store>>();
  return {
    open(name: string) {
      const req: Record<string, unknown> = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (!dbs.has(name)) dbs.set(name, new Map());
        const stores = dbs.get(name)!;
        const db = {
          createObjectStore(storeName: string) {
            if (!stores.has(storeName)) stores.set(storeName, new Map());
            return {};
          },
          transaction(storeName: string) {
            const tx: Record<string, unknown> = { oncomplete: null, onerror: null };
            tx.objectStore = () => {
              if (!stores.has(storeName)) stores.set(storeName, new Map());
              const map = stores.get(storeName)!;
              const complete = () =>
                queueMicrotask(() => (tx.oncomplete as (() => void) | null)?.());
              return {
                put(val: unknown, key: string) { map.set(key, val); complete(); return {}; },
                delete(key: string) { map.delete(key); complete(); return {}; },
                get(key: string) {
                  const r: Record<string, unknown> = { result: undefined, onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    r.result = map.get(key);
                    (r.onsuccess as (() => void) | null)?.();
                  });
                  return r;
                },
              };
            };
            return tx;
          },
        };
        req.result = db;
        (req.onupgradeneeded as (() => void) | null)?.();
        (req.onsuccess as (() => void) | null)?.();
      });
      return req;
    },
  };
}

// ─── Minimale FileSystemDirectoryHandle-shim ────────────────────────────────────
interface FakeFile { content: unknown }
interface FakeWritable { write(d: unknown): Promise<void>; close(): Promise<void> }
interface FakeFileHandle { createWritable(): Promise<FakeWritable> }
interface FakeDir {
  name: string;
  _dirs: Map<string, FakeDir>;
  _files: Map<string, FakeFile>;
  queryPermission(): Promise<'granted' | 'denied'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  getDirectoryHandle(n: string, opts?: { create?: boolean }): Promise<FakeDir>;
  getFileHandle(n: string, opts?: { create?: boolean }): Promise<FakeFileHandle>;
}
function makeDirHandle(name = 'root', perm: 'granted' | 'denied' = 'granted'): FakeDir {
  const dirs = new Map<string, FakeDir>();
  const files = new Map<string, FakeFile>();
  return {
    name,
    _dirs: dirs,
    _files: files,
    async queryPermission() { return perm; },
    async requestPermission() { return perm; },
    async getDirectoryHandle(n: string, opts?: { create?: boolean }) {
      if (!dirs.has(n)) {
        if (!opts?.create) throw new Error('niet gevonden');
        dirs.set(n, makeDirHandle(n, perm));
      }
      return dirs.get(n)!;
    },
    async getFileHandle(n: string, opts?: { create?: boolean }) {
      if (!files.has(n)) {
        if (!opts?.create) throw new Error('niet gevonden');
        const file: FakeFile = { content: null };
        files.set(n, file);
        return {
          async createWritable() {
            return {
              async write(d: unknown) { file.content = d; },
              async close() {},
            };
          },
        };
      }
      const existing = files.get(n)!;
      return {
        async createWritable() {
          return { async write(d: unknown) { existing.content = d; }, async close() {} };
        },
      };
    },
  };
}

const win = () => globalThis as unknown as { showDirectoryPicker?: unknown; indexedDB?: unknown; fetch?: unknown };

const setPicker = (handle: unknown | null) => {
  if (handle === null) {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  } else if (handle instanceof Error) {
    (window as unknown as Record<string, unknown>).showDirectoryPicker = jest.fn(() => Promise.reject(handle));
  } else {
    (window as unknown as Record<string, unknown>).showDirectoryPicker = jest.fn(() => Promise.resolve(handle));
  }
};

beforeEach(() => {
  win().indexedDB = makeFakeIndexedDB();
  delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
});

const row = (over: Partial<SyncEvidenceRow> & Pick<SyncEvidenceRow, 'id' | 'inspection_point_id'>): SyncEvidenceRow => ({
  media_uri: null,
  photo_uri: null,
  timestamp: '2026-06-01T10:30:00Z',
  ai_status: null,
  ai_notes: null,
  field_note: null,
  latitude: null,
  longitude: null,
  ...over,
});

describe('isFolderSyncSupported', () => {
  it('is false zonder showDirectoryPicker en true ermee', () => {
    expect(isFolderSyncSupported()).toBe(false);
    setPicker(makeDirHandle('Documenten'));
    expect(isFolderSyncSupported()).toBe(true);
  });
});

describe('requestFolderAccess', () => {
  it('geeft de gekozen mapnaam terug en bewaart de handle', async () => {
    setPicker(makeDirHandle('Bewijzen'));
    const name = await requestFolderAccess('p1');
    expect(name).toBe('Bewijzen');
    expect(await getLinkedFolderName('p1')).toBe('Bewijzen');
  });

  it('geeft null wanneer de API niet wordt ondersteund', async () => {
    expect(await requestFolderAccess('p2')).toBeNull();
  });

  it('geeft null wanneer de gebruiker annuleert', async () => {
    setPicker(new Error('AbortError'));
    expect(await requestFolderAccess('p3')).toBeNull();
  });
});

describe('getLinkedFolderName / unlinkFolder', () => {
  it('geeft null voor een onbekend project', async () => {
    expect(await getLinkedFolderName('leeg')).toBeNull();
  });

  it('ontkoppelt een eerder gekoppelde map', async () => {
    setPicker(makeDirHandle('Map'));
    await requestFolderAccess('p4');
    expect(await getLinkedFolderName('p4')).toBe('Map');
    await unlinkFolder('p4');
    expect(await getLinkedFolderName('p4')).toBeNull();
  });
});

describe('syncToLocalFolder — guards', () => {
  it('meldt notSupported zonder showDirectoryPicker', async () => {
    const res = await syncToLocalFolder('x', 'Proj', []);
    expect(res).toMatchObject({ ok: false, notSupported: true });
  });

  it('meldt noFolder wanneer er geen handle bewaard is', async () => {
    setPicker(makeDirHandle('Map')); // wel ondersteund, maar niets gekoppeld
    const res = await syncToLocalFolder('geen-handle', 'Proj', []);
    expect(res).toMatchObject({ ok: false, noFolder: true });
  });

  it('meldt noPermission wanneer rechten geweigerd zijn', async () => {
    setPicker(makeDirHandle('Map', 'denied'));
    await requestFolderAccess('p5');
    const res = await syncToLocalFolder('p5', 'Proj', []);
    expect(res).toMatchObject({ ok: false, noPermission: true });
  });
});

describe('syncToLocalFolder — happy path', () => {
  const originalFetch = win().fetch;
  afterEach(() => { win().fetch = originalFetch; });

  it('schrijft foto + notitie en slaat een al bestaande foto over', async () => {
    win().fetch = jest.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }),
    ) as unknown as typeof fetch;

    const handle = makeDirHandle('Bewijzen');
    setPicker(handle);
    await requestFolderAccess('p6');

    const items: SyncEvidenceRow[] = [
      row({ id: 'abc12345xyz', inspection_point_id: 'BP-1', media_uri: 'https://x/f.jpg', field_note: 'scheur', ai_status: 'PASSED', latitude: 52.08, longitude: 4.31 }),
    ];

    const progress: Array<[number, number]> = [];
    const first = await syncToLocalFolder('p6', 'Mijn Project', items, (d, t) => progress.push([d, t]));
    expect(first.ok).toBe(true);
    expect(first.synced).toBe(1);
    expect(first.errors).toEqual([]);
    expect(progress).toEqual([[1, 1]]);

    // map-structuur: Bewijzen / Mijn Project / BP-1 / <foto>.jpg + <notitie>.txt
    const projDir = handle._dirs.get('Mijn Project')!;
    const pointDir = projDir._dirs.get('BP-1')!;
    const fileNames = [...pointDir._files.keys()];
    expect(fileNames.some((n) => n.endsWith('_foto_abc12345.jpg'))).toBe(true);
    expect(fileNames.some((n) => n.endsWith('_notitie_abc12345.txt'))).toBe(true);

    // Tweede sync: foto bestaat al → overgeslagen, niet opnieuw gefetcht.
    (win().fetch as jest.Mock).mockClear();
    const second = await syncToLocalFolder('p6', 'Mijn Project', items);
    expect(second.synced).toBe(0);
    expect(second.skipped).toBe(1);
    expect(win().fetch as jest.Mock).not.toHaveBeenCalled();
  });
});
