/**
 * @jest-environment node
 *
 * Gedrag-tests voor de NATIVE-tak van de evidence-/sync-queue-adapter in
 * database/database.ts (op Platform.OS='ios' → nativeAdapter, bovenop expo-sqlite).
 * Op telefoon/tablet schrijft de vakman elk bewijs als één rij in de `evidence`-
 * tabel plus één wachtrij-entry in `sync_queue`. We draaien geen echte SQLite-
 * engine; we borgen het niveau dat hier daadwerkelijk fout kan gaan: WELKE query
 * naar de db gaat, MET WELKE parameters, en hoe booleans naar 0/1 worden gemapt.
 * Een fout hier stuurt de verkeerde kolommen mee, vergeet de sync-queue-entry of
 * verwart de SYNCED-vlag.
 *
 * We borgen:
 *  - initDatabase opent 'wkb_evidence.db' en legt het evidence-/sync_queue-schema aan;
 *  - saveEvidenceLocally stuurt 35 kolomwaarden, mapt exifVerified→1/0 en
 *    syncStatus 'SYNCED'→synced 1, schrijft een sync_queue-entry en geeft de
 *    lastInsertRowId terug;
 *  - getAllEvidence haalt nieuwste-eerst (timestamp DESC) op;
 *  - getUnsyncedEvidence joint sync_queue↔evidence en sorteert oudste-eerst;
 *  - markEvidenceSyncedWithCloudId zet SYNCED + cloud_record_id en verwijdert de
 *    queue-entry; markEvidenceSyncFailed zet FAILED.
 *
 * react-native (Platform=ios), expo-sqlite (spy-db) en config/presets zijn
 * gemockt → geen native runtime → @jest-environment node.
 */

import type { WkbEvidence } from '../../types/Evidence';

// ─── Spy-db (expo-sqlite) ───────────────────────────────────────────────────────
const execAsync = jest.fn(async (_sql: string) => {});
const runAsync = jest.fn(async (_sql: string, _params?: unknown[]) => ({ lastInsertRowId: 1, changes: 1 }));
const getFirstAsync = jest.fn(async (_sql: string, _params?: unknown[]) => null as unknown);
const getAllAsync = jest.fn(async (_sql: string, _params?: unknown[]) => [] as unknown[]);
const fakeDb = { execAsync, runAsync, getFirstAsync, getAllAsync };

// Plain logs die clearMocks NIET wist → eenmalige init/open blijft verifieerbaar.
const openDbNames: string[] = [];
const execSqlLog: string[] = [];

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
jest.mock('../../config/presets', () => ({ PROJECT_PRESETS: [], INSPECTION_PRESETS: [] }));

import {
  initDatabase,
  saveEvidenceLocally,
  getAllEvidence,
  getUnsyncedEvidence,
  markEvidenceSyncedWithCloudId,
  markEvidenceSyncFailed,
} from '../database';

const ev = (over: Partial<WkbEvidence> & Pick<WkbEvidence, 'id'>): WkbEvidence => ({
  projectId: 'P',
  inspectionPointId: 'BP-1',
  mediaUri: 'file://x.jpg',
  timestamp: '2026-06-01T00:00:00Z',
  latitude: 52,
  longitude: 4,
  gpsAccuracy: 5,
  exifHash: 'hash',
  exifVerified: true,
  syncStatus: 'PENDING',
  ...over,
});

describe('nativeAdapter — init', () => {
  it('opent wkb_evidence.db en legt het evidence-/sync_queue-schema aan', async () => {
    await initDatabase();
    expect(openDbNames).toContain('wkb_evidence.db');
    const schema = execSqlLog.join('\n');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS evidence');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
    expect(schema).toContain('PRAGMA journal_mode = WAL');
  });
});

describe('nativeAdapter — saveEvidenceLocally', () => {
  it('stuurt 35 kolomwaarden, mapt exifVerified→1 en geeft de rowId terug', async () => {
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 7, changes: 1 });
    const created = await saveEvidenceLocally(ev({ id: 'a' }));
    expect(created).toBe(7);

    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO evidence');
    expect(params).toHaveLength(35);
    expect(params[0]).toBe('a'); // evidence_id
    expect(params[12]).toBe(1); // exif_verified
    expect(params[20]).toBe('PENDING'); // sync_status
    expect(params[21]).toBe(0); // synced (niet SYNCED)
  });

  it('schrijft een sync_queue-entry met de nieuwe rowId', async () => {
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 9, changes: 1 });
    await saveEvidenceLocally(ev({ id: 'b' }));
    const [sql, params] = runAsync.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO sync_queue');
    expect(params[0]).toBe(9); // evidence_row_id
    expect(params[1]).toBe('b'); // evidence_id
  });

  it('mapt syncStatus SYNCED naar synced=1', async () => {
    await saveEvidenceLocally(ev({ id: 'c', syncStatus: 'SYNCED' }));
    const [, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(params[20]).toBe('SYNCED');
    expect(params[21]).toBe(1);
  });
});

describe('nativeAdapter — get', () => {
  it('getAllEvidence haalt nieuwste-eerst op (timestamp DESC)', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getAllEvidence();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('SELECT * FROM evidence');
    expect(sql).toContain('ORDER BY timestamp DESC');
  });

  it('getUnsyncedEvidence joint sync_queue↔evidence en sorteert oudste-eerst', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getUnsyncedEvidence();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('FROM sync_queue q');
    expect(sql).toContain('INNER JOIN evidence e');
    expect(sql).toContain('ORDER BY q.updated_at ASC');
  });
});

describe('nativeAdapter — sync-markeringen', () => {
  it('markEvidenceSyncedWithCloudId zet SYNCED + cloud_record_id en verwijdert de queue-entry', async () => {
    await markEvidenceSyncedWithCloudId(3, 555);
    const [updSql, updParams] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(updSql).toContain("sync_status = 'SYNCED'");
    expect(updSql).toContain('cloud_record_id = ?');
    expect(updParams).toEqual([555, 3]);

    const [delSql, delParams] = runAsync.mock.calls[1] as [string, unknown[]];
    expect(delSql).toContain('DELETE FROM sync_queue WHERE evidence_row_id = ?');
    expect(delParams).toEqual([3]);
  });

  it('markEvidenceSyncFailed zet FAILED op de evidence-rij', async () => {
    await markEvidenceSyncFailed(4);
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("sync_status = 'FAILED'");
    expect(params).toEqual([4]);
  });
});
