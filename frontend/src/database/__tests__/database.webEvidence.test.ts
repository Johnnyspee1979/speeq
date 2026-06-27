/**
 * @jest-environment node
 *
 * Gedrag-tests voor de EVIDENCE- + SYNC-QUEUE-tak van de web-adapter in
 * database/database.ts (saveEvidenceLocally / getAllEvidence /
 * getUnsyncedEvidence / markEvidenceSyncedWithCloudId / markEvidenceSyncFailed /
 * updateEvidenceAiStatus[ByCloudId], op Platform.OS='web'). Dit is het hart van
 * de offline-vastlegging: per bewijs één rij + één sync-queue-entry. Een fout
 * hier dubbeltelt een foto bij her-opslaan, verliest de AI-status, of houdt een
 * reeds-gesynct bewijs in de wachtrij.
 *
 * We borgen het publieke contract via een in-memory localforage-shim (de web-
 * store schrijft één WebDatabaseState-blob):
 *  - nieuw bewijs krijgt een oplopend rowId; her-opslaan met hetzelfde id
 *    hergebruikt het rowId, dedupliceert en bumpt de teller NIET;
 *  - her-opslaan behoudt bestaande AI-velden;
 *  - getAllEvidence sorteert nieuwste-eerst; getUnsyncedEvidence bevat alle
 *    in de wachtrij staande bewijzen;
 *  - markSyncedWithCloudId zet SYNCED + cloudRecordId en haalt het uit de queue;
 *  - updateAiStatus(ByCloudId) werkt de AI-velden bij (null → 'PENDING').
 *
 * react-native (Platform=web), expo-sqlite, config/presets en localforage zijn
 * gemockt → @jest-environment node.
 */

import type { WkbEvidence } from '../../types/Evidence';

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
  saveEvidenceLocally,
  insertEvidence,
  getAllEvidence,
  getUnsyncedEvidence,
  markEvidenceSyncedWithCloudId,
  markEvidenceSyncFailed,
  updateEvidenceAiStatus,
  updateEvidenceAiStatusByCloudId,
} from '../database';
import type { StoredWkbEvidence } from '../../types/Evidence';

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

beforeEach(() => {
  mockRegistry.clear();
});

describe('saveEvidenceLocally — rowId + dedupe', () => {
  it('kent oplopende rowId-s toe aan nieuw bewijs', async () => {
    expect(await saveEvidenceLocally(ev({ id: 'a' }))).toBe(1);
    expect(await saveEvidenceLocally(ev({ id: 'b' }))).toBe(2);
  });

  it('hergebruikt het rowId, dedupliceert en bumpt de teller niet bij her-opslaan', async () => {
    const r1 = await saveEvidenceLocally(ev({ id: 'a' }));
    const r1again = await saveEvidenceLocally(ev({ id: 'a', fieldNote: 'gewijzigd' }));
    expect(r1again).toBe(r1); // zelfde rowId
    // teller niet gebumpt → volgend NIEUW bewijs krijgt rowId 2, niet 3
    expect(await saveEvidenceLocally(ev({ id: 'c' }))).toBe(2);

    const all = await getAllEvidence();
    expect(all.filter((e) => e.id === 'a')).toHaveLength(1); // geen dubbel
  });

  it('behoudt bestaande AI-velden bij her-opslaan', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await updateEvidenceAiStatus(rowId, 'PASSED', 0.91, 'ziet er goed uit');
    await saveEvidenceLocally(ev({ id: 'a', fieldNote: 'nieuwe notitie' }));

    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).toBe('PASSED');
    expect(a.aiConfidence).toBe(0.91);
    expect(a.fieldNote).toBe('nieuwe notitie');
  });
});

describe('insertEvidence — veld-mapping', () => {
  it('mapt het gedocumenteerde subset en is terugleesbaar', async () => {
    const rowId = await insertEvidence({
      ...ev({ id: 'ie1' }),
      userId: 'u-9',
      fieldNote: 'notitie',
    } as StoredWkbEvidence);
    expect(rowId).toBe(1);

    const a = (await getAllEvidence()).find((e) => e.id === 'ie1')!;
    expect(a.mediaUri).toBe('file://x.jpg');
    expect(a.userId).toBe('u-9');
    expect(a.fieldNote).toBe('notitie');
    expect(a.syncStatus).toBe('PENDING');
  });

  it('zet userId/fieldNote op null wanneer afwezig', async () => {
    await insertEvidence(ev({ id: 'ie2' }) as StoredWkbEvidence);
    const a = (await getAllEvidence()).find((e) => e.id === 'ie2')!;
    expect(a.userId ?? null).toBeNull();
    expect(a.fieldNote ?? null).toBeNull();
  });

  it('draagt AI-velden niet mee (worden pas later via update gezet)', async () => {
    await insertEvidence({
      ...ev({ id: 'ie3' }),
      aiStatus: 'PASSED',
      aiConfidence: 0.99,
    } as StoredWkbEvidence);
    const a = (await getAllEvidence()).find((e) => e.id === 'ie3')!;
    expect(a.aiStatus).not.toBe('PASSED');
  });
});

describe('getAllEvidence / getUnsyncedEvidence', () => {
  it('getAllEvidence sorteert nieuwste-eerst op timestamp', async () => {
    await saveEvidenceLocally(ev({ id: 'oud', timestamp: '2026-01-01T00:00:00Z' }));
    await saveEvidenceLocally(ev({ id: 'nieuw', timestamp: '2026-06-01T00:00:00Z' }));
    expect((await getAllEvidence()).map((e) => e.id)).toEqual(['nieuw', 'oud']);
  });

  it('getUnsyncedEvidence bevat alle bewijzen in de wachtrij', async () => {
    await saveEvidenceLocally(ev({ id: 'a' }));
    await saveEvidenceLocally(ev({ id: 'b' }));
    const ids = (await getUnsyncedEvidence()).map((e) => e.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('markEvidenceSyncedWithCloudId', () => {
  it('zet SYNCED + cloudRecordId en haalt het bewijs uit de wachtrij', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await markEvidenceSyncedWithCloudId(rowId, 555);

    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.syncStatus).toBe('SYNCED');
    expect(a.cloudRecordId).toBe(555);
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(false);
  });
});

describe('markEvidenceSyncFailed', () => {
  it('zet FAILED en houdt het bewijs in de wachtrij', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await markEvidenceSyncFailed(rowId);

    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.syncStatus).toBe('FAILED');
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(true);
  });
});

describe('updateEvidenceAiStatus(ByCloudId)', () => {
  it('werkt de AI-velden bij op rowId', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await updateEvidenceAiStatus(rowId, 'NEEDS_REVIEW', 0.4, 'twijfel');
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).toBe('NEEDS_REVIEW');
    expect(a.aiConfidence).toBe(0.4);
    expect(a.aiNotes).toBe('twijfel');
  });

  it('valt terug op PENDING wanneer status undefined is', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await updateEvidenceAiStatus(rowId, undefined, null, null);
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).toBe('PENDING');
  });

  it('werkt de AI-velden bij op cloudRecordId', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await markEvidenceSyncedWithCloudId(rowId, 777);
    await updateEvidenceAiStatusByCloudId(777, 'PASSED', 0.8, 'akkoord');
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).toBe('PASSED');
    expect(a.aiConfidence).toBe(0.8);
  });
});

describe('herstel- en her-sync-stromen', () => {
  it('een FAILED bewijs kan alsnog SYNCED worden en verlaat de wachtrij', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await markEvidenceSyncFailed(rowId);
    expect((await getAllEvidence()).find((e) => e.id === 'a')!.syncStatus).toBe('FAILED');
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(true);

    await markEvidenceSyncedWithCloudId(rowId, 42);
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.syncStatus).toBe('SYNCED');
    expect(a.cloudRecordId).toBe(42);
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(false);
  });

  it('her-opslaan van een gesynct bewijs zet het terug in de wachtrij maar behoudt cloudRecordId', async () => {
    const rowId = (await saveEvidenceLocally(ev({ id: 'a' })))!;
    await markEvidenceSyncedWithCloudId(rowId, 99);
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(false);

    // Vakman bewerkt het bewijs → her-opslaan (default syncStatus PENDING).
    await saveEvidenceLocally(ev({ id: 'a', fieldNote: 'bijgewerkt' }));
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.syncStatus).toBe('PENDING');
    expect(a.fieldNote).toBe('bijgewerkt');
    expect(a.cloudRecordId).toBe(99); // koppeling met de cloud blijft behouden
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(true);
  });
});

describe('edge-cases — onbekende doelen laten bestaande rijen ongemoeid', () => {
  it('markEvidenceSyncedWithCloudId op een onbekende rowId is een veilige no-op', async () => {
    await saveEvidenceLocally(ev({ id: 'a' }));
    await markEvidenceSyncedWithCloudId(999, 12);
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.syncStatus).toBe('PENDING');
    expect(a.cloudRecordId).not.toBe(12);
    expect((await getUnsyncedEvidence()).some((e) => e.id === 'a')).toBe(true);
  });

  it('updateEvidenceAiStatus op een onbekende rowId raakt bestaande rijen niet', async () => {
    await saveEvidenceLocally(ev({ id: 'a' }));
    await updateEvidenceAiStatus(999, 'PASSED', 0.9, 'x');
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).not.toBe('PASSED');
  });

  it('updateEvidenceAiStatusByCloudId op een onbekende cloudId raakt bestaande rijen niet', async () => {
    await saveEvidenceLocally(ev({ id: 'a' }));
    await updateEvidenceAiStatusByCloudId(999, 'PASSED', 0.9, 'x');
    const a = (await getAllEvidence()).find((e) => e.id === 'a')!;
    expect(a.aiStatus).not.toBe('PASSED');
  });
});
