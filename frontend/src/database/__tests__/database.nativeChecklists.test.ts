/**
 * @jest-environment node
 *
 * Gedrag-tests voor de PRESET-, AI-STATUS-, CHECKLIST-, DOCUMENT- en DSO-LOG-tak
 * van de NATIVE-adapter in database/database.ts (Platform.OS='ios' → nativeAdapter,
 * bovenop expo-sqlite). Dit zijn de per-project dossieronderdelen + vrije labels
 * die op telefoon/tablet in SQLite bewaard worden. We draaien geen echte SQLite-
 * engine; we borgen het niveau dat hier fout kan gaan: WELKE query naar de db gaat
 * en MET WELKE parameters (incl. boolean→0/1 en de PENDING-defaults).
 *
 * We borgen:
 *  - get/add/removePreset + getAllPresets gebruiken de juiste SELECT/INSERT/DELETE
 *    met type-dan-waarde-sortering;
 *  - updateEvidenceAiStatus[ByCloudId] valt terug op 'PENDING' en filtert op
 *    id resp. cloud_record_id;
 *  - savePunchlistItems mapt checked→0/1, geeft de updatedAt terug en upsert met
 *    PENDING; getPunchlistItems sorteert op item_id; mark→SYNCED;
 *  - saveConsumerDossierDocuments stuurt 8 kolomwaarden in de juiste volgorde;
 *  - insertDsoLog schrijft reference_id/status/created_at; getDsoLogs sorteert
 *    nieuwste-eerst.
 *
 * react-native (Platform=ios), expo-sqlite (spy-db) en config/presets zijn
 * gemockt → geen native runtime → @jest-environment node.
 */

const execAsync = jest.fn(async (_sql: string) => {});
const runAsync = jest.fn(async (_sql: string, _params?: unknown[]) => ({ lastInsertRowId: 1, changes: 1 }));
const getFirstAsync = jest.fn(async (_sql: string, _params?: unknown[]) => null as unknown);
const getAllAsync = jest.fn(async (_sql: string, _params?: unknown[]) => [] as unknown[]);
const fakeDb = { execAsync, runAsync, getFirstAsync, getAllAsync };

const openDatabaseAsync = jest.fn(async (_name: string) => fakeDb);

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabaseAsync: (name: string) => openDatabaseAsync(name),
}));
jest.mock('../../config/presets', () => ({ PROJECT_PRESETS: [], INSPECTION_PRESETS: [] }));

import {
  getProjectPresets,
  getInspectionPresets,
  addPreset,
  removePreset,
  getAllPresets,
  updateEvidenceAiStatus,
  updateEvidenceAiStatusByCloudId,
  getPunchlistItems,
  savePunchlistItems,
  markPunchlistItemsSynced,
  saveConsumerDossierDocuments,
  insertDsoLog,
  getDsoLogs,
} from '../database';

describe('nativeAdapter — presets', () => {
  it('getProjectPresets selecteert op type met value-sortering', async () => {
    getAllAsync.mockResolvedValueOnce([{ value: 'Aanbouw' }] as unknown[]);
    const out = await getProjectPresets();
    expect(out).toEqual(['Aanbouw']);
    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SELECT value FROM presets WHERE type = ?');
    expect(sql).toContain('ORDER BY value ASC');
    expect(params).toEqual(['project']);
  });

  it('getInspectionPresets filtert op inspection', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getInspectionPresets();
    const [, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['inspection']);
  });

  it('addPreset doet INSERT OR IGNORE met type+waarde', async () => {
    await addPreset('project', 'Dakkapel');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT OR IGNORE INTO presets');
    expect(params).toEqual(['project', 'Dakkapel']);
  });

  it('removePreset verwijdert exact het type+waarde-paar', async () => {
    await removePreset('inspection', 'Liggers');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM presets WHERE type = ? AND value = ?');
    expect(params).toEqual(['inspection', 'Liggers']);
  });

  it('getAllPresets sorteert type-dan-waarde', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getAllPresets();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('ORDER BY type ASC, value ASC');
  });
});

describe('nativeAdapter — AI-status', () => {
  it('updateEvidenceAiStatus valt terug op PENDING en filtert op id', async () => {
    await updateEvidenceAiStatus(7, undefined, null, null);
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE evidence SET ai_status = ?');
    expect(sql).toContain('WHERE id = ?');
    expect(params).toEqual(['PENDING', null, null, 7]);
  });

  it('updateEvidenceAiStatusByCloudId filtert op cloud_record_id', async () => {
    await updateEvidenceAiStatusByCloudId(99, 'PASSED', 0.8, 'akkoord');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE cloud_record_id = ?');
    expect(params).toEqual(['PASSED', 0.8, 'akkoord', 99]);
  });
});

describe('nativeAdapter — punchlist', () => {
  it('savePunchlistItems mapt checked→1, geeft updatedAt terug en upsert PENDING', async () => {
    const updatedAt = await savePunchlistItems('P', [{ id: 'a', title: 'Eerste', checked: true }]);
    expect(typeof updatedAt).toBe('string');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO punchlist_checks');
    expect(sql).toContain("sync_status = 'PENDING'");
    expect(params).toEqual(['P', 'a', 'Eerste', 1, updatedAt]);
  });

  it('getPunchlistItems filtert op project en sorteert op item_id', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getPunchlistItems('P');
    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM punchlist_checks');
    expect(sql).toContain('WHERE project_id = ?');
    expect(sql).toContain('ORDER BY item_id ASC');
    expect(params).toEqual(['P']);
  });

  it('markPunchlistItemsSynced zet SYNCED op het project', async () => {
    await markPunchlistItemsSynced('P');
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE punchlist_checks');
    expect(sql).toContain("sync_status = 'SYNCED'");
    expect(params).toEqual(['P']);
  });
});

describe('nativeAdapter — consumentendossier-documenten', () => {
  it('saveConsumerDossierDocuments stuurt 8 kolomwaarden in volgorde', async () => {
    const updatedAt = await saveConsumerDossierDocuments('P', [
      { id: 'd1', requirementId: 'R1', title: 'A', category: 'AS_BUILT', referenceValue: 'ref', notes: 'n' },
    ]);
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO consumer_dossier_documents');
    expect(params).toEqual(['P', 'd1', 'R1', 'A', 'AS_BUILT', 'ref', 'n', updatedAt]);
  });
});

describe('nativeAdapter — DSO-logs', () => {
  it('insertDsoLog schrijft reference_id/status/created_at', async () => {
    await insertDsoLog({ reference_id: 'A', status: 'OK', created_at: '2026-06-01T00:00:00Z' });
    const [sql, params] = runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO dso_log');
    expect(params).toEqual(['A', 'OK', '2026-06-01T00:00:00Z']);
  });

  it('getDsoLogs sorteert nieuwste-eerst (created_at DESC)', async () => {
    getAllAsync.mockResolvedValueOnce([]);
    await getDsoLogs();
    const [sql] = getAllAsync.mock.calls[0] as [string];
    expect(sql).toContain('FROM dso_log');
    expect(sql).toContain('ORDER BY created_at DESC');
  });
});
