/**
 * @jest-environment node
 *
 * Gedrag-tests voor de NATIVE-tak van de offline-opslag (database/offlineDb.ts →
 * getOfflineStorage op Platform.OS='ios' → createNativeStorage). Dit is de
 * expo-sqlite-adapter die op telefoon/tablet de offline bewijzen + sync-queue
 * bewaart. We draaien geen echte SQLite-engine; we borgen het OfflineStorage-
 * contract op het niveau dat hier daadwerkelijk fout kan gaan: WELKE query naar
 * de db gaat, MET WELKE parameters, en hoe het resultaat terug-gemapt wordt.
 * Een fout hier stuurt de verkeerde kolommen mee, vergeet de client_version-bump
 * of geeft de nieuwe rij-id niet terug.
 *
 * We borgen:
 *  - getOfflineStorage kiest native: opent 'speeq_offline.db', voert het
 *    CREATE-TABLE-schema uit en draait de offline-migraties op die db;
 *  - insert stuurt 25 kolomwaarden en geeft lastInsertRowId terug als id;
 *  - update bouwt een SET-clause uit de patch (zónder id/uuid), bumpt
 *    client_version en is een no-op bij een lege patch;
 *  - get/list mappen de db-rijen door (met/zonder projectId-filter);
 *  - de sync-queue-queries (insert/list ASC/mark/remove) kloppen;
 *  - clearAll leegt beide tabellen.
 *
 * react-native (Platform=ios), expo-sqlite (spy-db) en offlineMigrations zijn
 * gemockt → geen native runtime → @jest-environment node.
 */

import type { LocalEvidenceRow, SyncQueueRow } from '../offlineDb';

// ─── Spy-db (expo-sqlite) ───────────────────────────────────────────────────────
const execAsync = jest.fn(async (_sql: string) => {});
const runAsync = jest.fn(async (_sql: string, _params?: unknown[]) => ({ lastInsertRowId: 1, changes: 1 }));
const getFirstAsync = jest.fn(async (_sql: string, _params?: unknown[]) => null as unknown);
const getAllAsync = jest.fn(async (_sql: string, _params?: unknown[]) => [] as unknown[]);
const fakeDb = { execAsync, runAsync, getFirstAsync, getAllAsync };

// Plain logs die clearMocks NIET wist → eenmalige init blijft verifieerbaar.
const openDbNames: string[] = [];
const execSqlLog: string[] = [];
const migrationDbs: unknown[] = [];

const openDatabaseAsync = jest.fn(async (name: string) => {
  openDbNames.push(name);
  return fakeDb;
});
execAsync.mockImplementation(async (sql: string) => {
  execSqlLog.push(sql);
});

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: (name: string) => openDatabaseAsync(name),
}));
jest.mock('../offlineMigrations', () => ({
  runOfflineMigrations: (db: unknown) => {
    migrationDbs.push(db);
    return Promise.resolve({ applied: [], startedAtVersion: 1, finishedAtVersion: 1 });
  },
}));

import { getOfflineStorage } from '../offlineDb';

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

let storage: Awaited<ReturnType<typeof getOfflineStorage>>;
beforeEach(async () => {
  storage = await getOfflineStorage();
});

describe('getOfflineStorage (native) — init', () => {
  it('opent de native db, legt het schema aan en draait de migraties', () => {
    expect(openDbNames).toContain('speeq_offline.db');
    const schema = execSqlLog.join('\n');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS evidence_local');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
    expect(migrationDbs[0]).toBe(fakeDb);
  });
});

describe('evidence — insert', () => {
  it('stuurt 25 kolomwaarden en geeft lastInsertRowId terug als id', async () => {
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 7, changes: 1 });
    const created = await storage.insertEvidence(evRow({ uuid: 'u1', project_id: 'P1' }));
    expect(created.id).toBe(7);

    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO evidence_local');
    expect(params).toHaveLength(25);
    expect(params[0]).toBe('u1');
  });
});

describe('evidence — update', () => {
  it('bouwt een SET-clause zonder id/uuid en bumpt client_version', async () => {
    await storage.updateEvidence('u1', { ai_status: 'PASSED', uuid: 'POGING' } as Partial<LocalEvidenceRow>);
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ai_status = ?');
    expect(sql).not.toContain('uuid = ?,'); // uuid niet in de SET-lijst
    expect(sql).toContain('client_version = client_version + 1');
    expect(sql).toContain('WHERE uuid = ?');
    // params = [ai_status, updated_at(iso), uuid]
    expect(params[0]).toBe('PASSED');
    expect(params[params.length - 1]).toBe('u1');
  });

  it('is een no-op bij een lege patch (geen query)', async () => {
    await storage.updateEvidence('u1', {});
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('evidence — get / list', () => {
  it('getEvidence mapt de db-rij door, of null', async () => {
    const fake = { uuid: 'u1', id: 3 } as unknown as LocalEvidenceRow;
    getFirstAsync.mockResolvedValueOnce(fake);
    expect(await storage.getEvidence('u1')).toBe(fake);

    getFirstAsync.mockResolvedValueOnce(null);
    expect(await storage.getEvidence('weg')).toBeNull();
  });

  it('listEvidence filtert op projectId met DESC-volgorde', async () => {
    getAllAsync.mockResolvedValueOnce([{ uuid: 'a' }] as unknown[]);
    const out = await storage.listEvidence({ projectId: 'P1' });
    expect(out).toEqual([{ uuid: 'a' }]);
    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE project_id = ?');
    expect(sql).toContain('ORDER BY timestamp DESC');
    expect(params).toEqual(['P1']);
  });

  it('listEvidence zonder filter haalt alles in DESC-volgorde', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await storage.listEvidence();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('ORDER BY timestamp DESC');
    expect(sql).not.toContain('WHERE');
  });
});

describe('sync-queue', () => {
  it('enqueue → INSERT met juiste parameters', async () => {
    await storage.enqueueSyncOperation({
      evidence_uuid: 'u1',
      operation: 'create',
      payload: '{}',
      attempts: 0,
      last_attempt_at: null,
      last_error: null,
      created_at: '2026-06-01T00:00:00Z',
    });
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO sync_queue');
    expect(params[0]).toBe('u1');
    expect(params).toHaveLength(7);
  });

  it('listPendingSync sorteert oudste-eerst (created_at ASC)', async () => {
    getAllAsync.mockResolvedValueOnce([{ id: 1 }] as unknown as SyncQueueRow[]);
    await storage.listPendingSync();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('FROM sync_queue');
    expect(sql).toContain('ORDER BY created_at ASC');
  });

  it('markSyncAttempt verhoogt attempts en zet last_error', async () => {
    await storage.markSyncAttempt(5, 'netwerk weg');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('attempts = attempts + 1');
    expect(params[1]).toBe('netwerk weg');
    expect(params[2]).toBe(5);
  });

  it('removeSyncOperation verwijdert op id', async () => {
    await storage.removeSyncOperation(9);
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM sync_queue WHERE id = ?');
    expect(params).toEqual([9]);
  });
});

describe('clearAll', () => {
  it('leegt beide tabellen', async () => {
    await storage.clearAll();
    const [sql] = execAsync.mock.calls[execAsync.mock.calls.length - 1] as [string];
    expect(sql).toContain('DELETE FROM evidence_local');
    expect(sql).toContain('DELETE FROM sync_queue');
  });
});
