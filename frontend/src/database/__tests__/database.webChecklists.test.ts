/**
 * @jest-environment node
 *
 * Gedrag-tests voor de CHECKLIST-, DOCUMENT- en DSO-LOG-takken van de web-adapter
 * in database/database.ts (punchlist / gereedmelding / consumentendossier-items
 * + -documenten + DSO-logs, op Platform.OS='web'). Dit zijn de per-project
 * dossieronderdelen die offline bewaard worden en later syncen. Een fout hier
 * verliest de id-sortering, vergeet de PENDING/SYNCED-status of mist de
 * referentie-/notitie-defaults van een document.
 *
 * We borgen het publieke contract via een in-memory localforage-shim (de web-
 * store schrijft één WebDatabaseState-blob):
 *  - save → get is een roundtrip, op id gesorteerd, met de teruggegeven
 *    updatedAt op elk item en syncStatus 'PENDING';
 *  - mark*Synced zet alles op 'SYNCED';
 *  - documenten krijgen lege-string defaults voor referenceValue/notes;
 *  - insertDsoLog kent een id toe (nextDsoLogId), vervangt bij gelijk id, en
 *    getDsoLogs sorteert nieuwste-eerst.
 *
 * react-native (Platform=web), expo-sqlite, config/presets en localforage zijn
 * gemockt → @jest-environment node.
 */

const mockRegistry = new Map<string, Map<string, unknown>>();
const mockStoreFor = (storeName: string): Map<string, unknown> => {
  if (!mockRegistry.has(storeName)) mockRegistry.set(storeName, new Map());
  return mockRegistry.get(storeName)!;
};

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-sqlite', () => ({ __esModule: true, openDatabaseAsync: jest.fn() }));
jest.mock('../../config/presets', () => ({ PROJECT_PRESETS: [], INSPECTION_PRESETS: [] }));
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    createInstance: ({ storeName }: { name: string; storeName: string }) => ({
      async getItem<T>(key: string): Promise<T | null> {
        const m = mockStoreFor(storeName);
        return m.has(key) ? (m.get(key) as T) : null;
      },
      async setItem<T>(key: string, val: T): Promise<T> {
        mockStoreFor(storeName).set(key, val);
        return val;
      },
    }),
  },
}));

import {
  getPunchlistItems,
  savePunchlistItems,
  markPunchlistItemsSynced,
  getGereedmeldingItems,
  saveGereedmeldingItems,
  markGereedmeldingItemsSynced,
  getConsumerDossierItems,
  saveConsumerDossierItems,
  markConsumerDossierItemsSynced,
  getConsumerDossierDocuments,
  saveConsumerDossierDocuments,
  markConsumerDossierDocumentsSynced,
  insertDsoLog,
  getDsoLogs,
} from '../database';

beforeEach(() => {
  mockRegistry.clear(); // verse web-store per test
});

describe('punchlist — roundtrip + sync', () => {
  const P = 'proj-1';

  it('save → get is op id gesorteerd, met updatedAt en status PENDING', async () => {
    const updatedAt = await savePunchlistItems(P, [
      { id: 'b', title: 'Tweede', checked: true },
      { id: 'a', title: 'Eerste', checked: false },
    ]);
    const items = await getPunchlistItems(P);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items.map((i) => i.checked)).toEqual([false, true]);
    expect(items.every((i) => i.syncStatus === 'PENDING')).toBe(true);
    expect(items.every((i) => i.updatedAt === updatedAt)).toBe(true);
  });

  it('markPunchlistItemsSynced zet alles op SYNCED', async () => {
    await savePunchlistItems(P, [{ id: 'a', title: 'x', checked: false }]);
    await markPunchlistItemsSynced(P);
    const items = await getPunchlistItems(P);
    expect(items.every((i) => i.syncStatus === 'SYNCED')).toBe(true);
  });

  it('geeft een lege lijst voor een onbekend project', async () => {
    expect(await getPunchlistItems('leeg')).toEqual([]);
  });
});

describe('gereedmelding — roundtrip + sync', () => {
  const P = 'proj-2';
  it('save → get gesorteerd, mark → SYNCED', async () => {
    await saveGereedmeldingItems(P, [
      { id: 'z', title: 'Z', checked: true },
      { id: 'm', title: 'M', checked: false },
    ]);
    expect((await getGereedmeldingItems(P)).map((i) => i.id)).toEqual(['m', 'z']);
    await markGereedmeldingItemsSynced(P);
    expect((await getGereedmeldingItems(P)).every((i) => i.syncStatus === 'SYNCED')).toBe(true);
  });
});

describe('consumentendossier-items — roundtrip + sync', () => {
  const P = 'proj-3';
  it('save → get gesorteerd, mark → SYNCED', async () => {
    await saveConsumerDossierItems(P, [
      { id: '2', title: 'Twee', checked: false },
      { id: '1', title: 'Een', checked: true },
    ]);
    expect((await getConsumerDossierItems(P)).map((i) => i.id)).toEqual(['1', '2']);
    await markConsumerDossierItemsSynced(P);
    expect((await getConsumerDossierItems(P)).every((i) => i.syncStatus === 'SYNCED')).toBe(true);
  });
});

describe('consumentendossier-documenten — defaults + sync', () => {
  const P = 'proj-4';
  it('vult lege-string defaults voor referenceValue/notes en sorteert op id', async () => {
    await saveConsumerDossierDocuments(P, [
      { id: 'b', requirementId: 'R2', title: 'B', category: 'AS_BUILT', referenceValue: 'ref', notes: 'n' },
      { id: 'a', requirementId: 'R1', title: 'A', category: 'AS_BUILT' } as never,
    ]);
    const docs = await getConsumerDossierDocuments(P);
    expect(docs.map((d) => d.id)).toEqual(['a', 'b']);
    const a = docs.find((d) => d.id === 'a')!;
    expect(a.referenceValue).toBe('');
    expect(a.notes).toBe('');
    expect(docs.every((d) => d.syncStatus === 'PENDING')).toBe(true);
  });

  it('markConsumerDossierDocumentsSynced zet alles op SYNCED', async () => {
    await saveConsumerDossierDocuments(P, [
      { id: 'a', requirementId: 'R1', title: 'A', category: 'AS_BUILT', referenceValue: '', notes: '' },
    ]);
    await markConsumerDossierDocumentsSynced(P);
    expect((await getConsumerDossierDocuments(P)).every((d) => d.syncStatus === 'SYNCED')).toBe(true);
  });
});

describe('DSO-logs — id-toekenning + sortering', () => {
  it('kent oplopende id-s toe en sorteert nieuwste-eerst', async () => {
    await insertDsoLog({ reference_id: 'A', status: 'OK', created_at: '2026-06-01T00:00:00Z' });
    await insertDsoLog({ reference_id: 'B', status: 'OK', created_at: '2026-06-02T00:00:00Z' });
    const logs = await getDsoLogs();
    expect(logs.map((l) => l.reference_id)).toEqual(['B', 'A']);
    expect(logs.map((l) => l.id).sort()).toEqual([1, 2]);
  });

  it('vervangt een log met een expliciet gelijk id', async () => {
    await insertDsoLog({ reference_id: 'A', status: 'PENDING', created_at: '2026-06-01T00:00:00Z' });
    await insertDsoLog({ id: 1, reference_id: 'A', status: 'DONE', created_at: '2026-06-01T00:00:00Z' });
    const logs = await getDsoLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: 1, status: 'DONE' });
  });
});
