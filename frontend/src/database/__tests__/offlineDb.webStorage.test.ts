/**
 * @jest-environment node
 *
 * Gedrag-tests voor de WEB-tak van de offline-opslag (database/offlineDb.ts →
 * getOfflineStorage op Platform.OS='web' → createWebStorage). Dit is de
 * localforage/IndexedDB-adapter die offline bewijzen + de sync-queue bewaart
 * wanneer de app als PWA draait. Een fout hier laat lokaal vastgelegde foto's
 * verdwijnen, dubbel tellen of in de verkeerde volgorde syncen. We borgen het
 * publieke OfflineStorage-contract met een in-memory localforage-shim:
 *  - getOfflineStorage cachet één instance en kiest de web-implementatie;
 *  - insert kent een oplopende id toe en is per uuid terugleesbaar;
 *  - update merget de patch, bumpt client_version en laat id/uuid ongemoeid
 *    (onbekende uuid = no-op);
 *  - listEvidence sorteert nieuwste-eerst op timestamp en filtert op projectId;
 *  - de sync-queue enqueue/list (oudste-eerst) / markSyncAttempt / remove werkt;
 *  - clearAll leegt alle stores én reset de id-tellers.
 *
 * react-native (Platform), localforage en offlineMigrations zijn gemockt → geen
 * native runtime / IndexedDB nodig → @jest-environment node.
 */

type Item = unknown;
const registry = new Map<string, Map<string, Item>>();
const storeFor = (storeName: string): Map<string, Item> => {
  if (!registry.has(storeName)) registry.set(storeName, new Map());
  return registry.get(storeName)!;
};

// Plain array (geen jest-mock) → blijft staan ondanks clearMocks tussen tests.
const createdStoreNames: string[] = [];

const mockCreateInstance = jest.fn((cfg: { name: string; storeName: string }) => {
  const { storeName } = cfg;
  createdStoreNames.push(storeName);
  return {
    async getItem<T>(key: string): Promise<T | null> {
      const m = storeFor(storeName);
      return m.has(key) ? (m.get(key) as T) : null;
    },
    async setItem<T>(key: string, val: T): Promise<T> {
      storeFor(storeName).set(key, val);
      return val;
    },
    async removeItem(key: string): Promise<void> {
      storeFor(storeName).delete(key);
    },
    async iterate<T, U>(cb: (value: T, key: string, i: number) => U): Promise<void> {
      let i = 0;
      for (const [key, value] of storeFor(storeName)) cb(value as T, key, ++i);
    },
    async clear(): Promise<void> {
      storeFor(storeName).clear();
    },
  };
});

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('localforage', () => ({
  __esModule: true,
  default: { createInstance: (cfg: { name: string; storeName: string }) => mockCreateInstance(cfg) },
}));
jest.mock('../offlineMigrations', () => ({ runOfflineMigrations: jest.fn() }));

import { getOfflineStorage, type LocalEvidenceRow, type SyncQueueRow } from '../offlineDb';

// Bouw een complete evidence-rij (zonder id) met overschrijfbare velden.
const evRow = (
  over: Partial<Omit<LocalEvidenceRow, 'id'>> & Pick<LocalEvidenceRow, 'uuid'>,
): Omit<LocalEvidenceRow, 'id'> => ({
  remote_id: null,
  project_id: null,
  inspection_point_id: null,
  photo_uri: null,
  media_uri: null,
  timestamp: null,
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  exif_hash: null,
  exif_verified: null,
  field_note: null,
  betonkwaliteit: null,
  milieuklasse: null,
  volume: null,
  leverdatum: null,
  ai_status: null,
  ai_confidence: null,
  ai_notes: null,
  sync_status: 'pending',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  last_sync_at: null,
  client_version: 1,
  ...over,
});

const queueRow = (over: Partial<Omit<SyncQueueRow, 'id'>> & Pick<SyncQueueRow, 'evidence_uuid' | 'created_at'>): Omit<SyncQueueRow, 'id'> => ({
  operation: 'create',
  payload: '{}',
  attempts: 0,
  last_attempt_at: null,
  last_error: null,
  ...over,
});

let storage: Awaited<ReturnType<typeof getOfflineStorage>>;

beforeEach(async () => {
  storage = await getOfflineStorage();
  await storage.clearAll();
});

describe('getOfflineStorage (web)', () => {
  it('cachet één gedeelde instance', async () => {
    const a = await getOfflineStorage();
    const b = await getOfflineStorage();
    expect(a).toBe(b);
  });

  it('kiest de web-implementatie (localforage-stores)', () => {
    expect(createdStoreNames).toEqual(
      expect.arrayContaining(['evidence_local', 'sync_queue', 'meta']),
    );
  });
});

describe('evidence — insert / get', () => {
  it('kent oplopende id-s toe en is per uuid terugleesbaar', async () => {
    const a = await storage.insertEvidence(evRow({ uuid: 'u-a' }));
    const b = await storage.insertEvidence(evRow({ uuid: 'u-b' }));
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);

    const back = await storage.getEvidence('u-a');
    expect(back).toMatchObject({ uuid: 'u-a', id: 1 });
  });

  it('geeft null voor een onbekende uuid', async () => {
    expect(await storage.getEvidence('weg')).toBeNull();
  });
});

describe('evidence — update', () => {
  it('merget de patch, bumpt client_version en laat id/uuid staan', async () => {
    await storage.insertEvidence(evRow({ uuid: 'u1', client_version: 1, ai_status: null }));
    await storage.updateEvidence('u1', { ai_status: 'PASSED', uuid: 'POGING-OVERSCHRIJVEN' } as Partial<LocalEvidenceRow>);

    const row = await storage.getEvidence('u1');
    expect(row).toMatchObject({ uuid: 'u1', id: 1, ai_status: 'PASSED', client_version: 2 });
  });

  it('is een no-op voor een onbekende uuid', async () => {
    await storage.updateEvidence('bestaat-niet', { ai_status: 'FAILED' });
    expect(await storage.getEvidence('bestaat-niet')).toBeNull();
  });
});

describe('evidence — list', () => {
  it('sorteert nieuwste-eerst op timestamp', async () => {
    await storage.insertEvidence(evRow({ uuid: 'oud', timestamp: '2026-01-01T00:00:00Z' }));
    await storage.insertEvidence(evRow({ uuid: 'nieuw', timestamp: '2026-06-01T00:00:00Z' }));
    await storage.insertEvidence(evRow({ uuid: 'mid', timestamp: '2026-03-01T00:00:00Z' }));

    const order = (await storage.listEvidence()).map((r) => r.uuid);
    expect(order).toEqual(['nieuw', 'mid', 'oud']);
  });

  it('filtert op projectId', async () => {
    await storage.insertEvidence(evRow({ uuid: 'p1-a', project_id: 'P1' }));
    await storage.insertEvidence(evRow({ uuid: 'p2-a', project_id: 'P2' }));
    const only = await storage.listEvidence({ projectId: 'P1' });
    expect(only.map((r) => r.uuid)).toEqual(['p1-a']);
  });
});

describe('sync-queue', () => {
  it('enqueue + list (oudste-eerst) + markSyncAttempt + remove', async () => {
    await storage.enqueueSyncOperation(queueRow({ evidence_uuid: 'u-b', created_at: '2026-06-02T00:00:00Z' }));
    await storage.enqueueSyncOperation(queueRow({ evidence_uuid: 'u-a', created_at: '2026-06-01T00:00:00Z' }));

    const pending = await storage.listPendingSync();
    expect(pending.map((r) => r.evidence_uuid)).toEqual(['u-a', 'u-b']);

    const first = pending[0];
    await storage.markSyncAttempt(first.id, 'netwerk weg');
    const afterMark = (await storage.listPendingSync()).find((r) => r.id === first.id)!;
    expect(afterMark.attempts).toBe(1);
    expect(afterMark.last_error).toBe('netwerk weg');
    expect(afterMark.last_attempt_at).not.toBeNull();

    await storage.removeSyncOperation(first.id);
    expect((await storage.listPendingSync()).some((r) => r.id === first.id)).toBe(false);
  });

  it('markSyncAttempt op onbekende id is een no-op', async () => {
    await storage.markSyncAttempt(999, 'x');
    expect(await storage.listPendingSync()).toEqual([]);
  });
});

describe('clearAll', () => {
  it('leegt alle stores en reset de id-teller', async () => {
    await storage.insertEvidence(evRow({ uuid: 'x' }));
    await storage.enqueueSyncOperation(queueRow({ evidence_uuid: 'x', created_at: '2026-06-01T00:00:00Z' }));

    await storage.clearAll();
    expect(await storage.listEvidence()).toEqual([]);
    expect(await storage.listPendingSync()).toEqual([]);

    // Teller gereset → eerste insert na clear krijgt opnieuw id 1.
    const again = await storage.insertEvidence(evRow({ uuid: 'y' }));
    expect(again.id).toBe(1);
  });
});
