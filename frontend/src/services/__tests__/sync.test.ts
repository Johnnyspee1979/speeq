/**
 * Unit-tests voor sync — de offline→cloud sync-engine (Supabase Storage + DB).
 *
 * We mocken alle module-grenzen: supabase (chainbare builder + storage + auth),
 * de lokale database-laag, aiCloud, wkbCompliance, WkbTemplates, storageUrl,
 * OfflinePhotoStore en react-native (Platform). Zo testen we de orkestratie zonder
 * echte I/O. We borgen:
 *   - syncPresetsToCloud: guard, leeg, upsert-ok (telt), upsert-fout → 0;
 *   - syncProjectDeliveryStateToCloud: guard/idle/synced(+mark)/error;
 *   - syncEvidenceQueue: skipped/idle/error;
 *   - syncEvidenceToCloud: happy path (web, blob uit IndexedDB → upload → insert →
 *     cloud-AI → mark synced = 1) en de WKB_LOCKED-tak (geen retry, count 0).
 */

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

let mockConfigured = true;
const mockGetUser = jest.fn(() => Promise.resolve({ data: { user: { id: 'u-1' } } }));

let insertResult: { data: unknown; error: unknown } = { data: { id: 99 }, error: null };
let upsertResult: { error: unknown } = { error: null };
let uploadResult: { error: unknown } = { error: null };
const calls: Record<string, any> = {};

const builder: any = {
  insert: (p: unknown) => {
    (calls.insert ||= []).push(p);
    return builder;
  },
  select: () => builder,
  single: () => Promise.resolve(insertResult),
  update: (p: unknown) => {
    calls.update = p;
    return builder;
  },
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return Promise.resolve({ error: null });
  },
  upsert: (p: unknown, opts: unknown) => {
    (calls.upsert ||= []).push({ p, opts });
    return Promise.resolve(upsertResult);
  },
};

const mockStorageUpload = jest.fn<Promise<any>, unknown[]>(() => Promise.resolve(uploadResult));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => mockConfigured,
  supabase: {
    from: (...a: unknown[]) => {
      (calls.from ||= []).push(a);
      return builder;
    },
    auth: { getUser: () => mockGetUser() },
    storage: { from: () => ({ upload: (...a: unknown[]) => mockStorageUpload(...a) }) },
  },
}));

const mockGetUnsynced = jest.fn<Promise<any[]>, []>(() => Promise.resolve([]));
const mockGetAllPresets = jest.fn<Promise<any[]>, []>(() => Promise.resolve([]));
const mockGetPunchlist = jest.fn<Promise<any[]>, [string]>(() => Promise.resolve([]));
const mockGetGereed = jest.fn<Promise<any[]>, [string]>(() => Promise.resolve([]));
const mockGetConsumerItems = jest.fn<Promise<any[]>, [string]>(() => Promise.resolve([]));
const mockGetConsumerDocs = jest.fn<Promise<any[]>, [string]>(() => Promise.resolve([]));
const mockMarkPunchlist = jest.fn(() => Promise.resolve());
const mockMarkGereed = jest.fn(() => Promise.resolve());
const mockMarkConsumerItems = jest.fn(() => Promise.resolve());
const mockMarkConsumerDocs = jest.fn(() => Promise.resolve());
const mockMarkSyncedCloud = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());
const mockMarkFailed = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());
const mockUpdateAiStatus = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());

jest.mock('../../database/database', () => ({
  getUnsyncedEvidence: () => mockGetUnsynced(),
  getAllPresets: () => mockGetAllPresets(),
  getPunchlistItems: (p: string) => mockGetPunchlist(p),
  getGereedmeldingItems: (p: string) => mockGetGereed(p),
  getConsumerDossierItems: (p: string) => mockGetConsumerItems(p),
  getConsumerDossierDocuments: (p: string) => mockGetConsumerDocs(p),
  markPunchlistItemsSynced: () => mockMarkPunchlist(),
  markGereedmeldingItemsSynced: () => mockMarkGereed(),
  markConsumerDossierItemsSynced: () => mockMarkConsumerItems(),
  markConsumerDossierDocumentsSynced: () => mockMarkConsumerDocs(),
  markEvidenceSyncedWithCloudId: (...a: unknown[]) => mockMarkSyncedCloud(...a),
  markEvidenceSyncFailed: (...a: unknown[]) => mockMarkFailed(...a),
  updateEvidenceAiStatus: (...a: unknown[]) => mockUpdateAiStatus(...a),
}));

const mockRequestCloudAi = jest.fn<Promise<any>, unknown[]>(() =>
  Promise.resolve({ status: 'PASSED', confidence: 0.9, feedback: 'ok' }),
);
jest.mock('../aiCloud', () => ({
  requestCloudAiValidation: (...a: unknown[]) => mockRequestCloudAi(...a),
}));

jest.mock('../wkbCompliance', () => ({
  getEvidenceComplianceContext: () => ({
    disciplineId: 'd1',
    dossierScope: 'BORGING',
    stopMoment: 'wapening',
    requiresMeasurementTool: false,
  }),
}));

jest.mock('../../data/WkbTemplates', () => ({
  findWkbTaskTemplateByInspectionPointId: () => undefined,
}));

jest.mock('../../lib/storageUrl', () => ({
  resolveStorageUrl: () => Promise.resolve('signed://foto.jpg'),
}));

const mockGetOfflineBlob = jest.fn<Promise<any>, unknown[]>(() => Promise.resolve<any>({ size: 10 }));
jest.mock('../OfflinePhotoStore', () => ({
  getOfflinePhotoBlob: (...a: unknown[]) => mockGetOfflineBlob(...a),
}));

jest.mock('base64-arraybuffer', () => ({ decode: () => new ArrayBuffer(8) }));
jest.mock('expo-file-system', () => ({
  File: class {
    constructor(_u: string) {}
    base64() {
      return Promise.resolve('AAAA');
    }
  },
}));

import {
  syncPresetsToCloud,
  syncProjectDeliveryStateToCloud,
  syncEvidenceQueue,
  syncEvidenceToCloud,
} from '../sync';

const evidenceItem = (over: Record<string, unknown> = {}) => ({
  id: 'ev-123456',
  rowId: 1,
  mediaUri: 'blob:abc',
  inspectionPointId: 'kik-wapening-001',
  latitude: 52.1,
  longitude: 4.3,
  timestamp: '2026-05-02T14:32:00.000Z',
  projectId: 'p-1',
  exifHash: 'h',
  exifVerified: true,
  syncStatus: 'PENDING',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  mockConfigured = true;
  insertResult = { data: { id: 99 }, error: null };
  upsertResult = { error: null };
  uploadResult = { error: null };
  for (const k of Object.keys(calls)) delete calls[k];
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
  mockGetUnsynced.mockResolvedValue([]);
  mockGetAllPresets.mockResolvedValue([]);
  mockGetPunchlist.mockResolvedValue([]);
  mockGetGereed.mockResolvedValue([]);
  mockGetConsumerItems.mockResolvedValue([]);
  mockGetConsumerDocs.mockResolvedValue([]);
  mockGetOfflineBlob.mockResolvedValue({ size: 10 });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('syncPresetsToCloud', () => {
  it('0 zonder Supabase-config', async () => {
    mockConfigured = false;
    await expect(syncPresetsToCloud()).resolves.toBe(0);
  });

  it('0 zonder presets', async () => {
    mockGetAllPresets.mockResolvedValue([]);
    await expect(syncPresetsToCloud()).resolves.toBe(0);
  });

  it('upsert ok → aantal presets', async () => {
    mockGetAllPresets.mockResolvedValue([{ type: 't', value: 'v' }, { type: 't2', value: 'v2' }]);
    await expect(syncPresetsToCloud()).resolves.toBe(2);
    expect(calls.from).toContainEqual(['presets']);
  });

  it('upsert-fout → 0', async () => {
    mockGetAllPresets.mockResolvedValue([{ type: 't', value: 'v' }]);
    upsertResult = { error: { message: 'rls' } };
    await expect(syncPresetsToCloud()).resolves.toBe(0);
  });
});

describe('syncProjectDeliveryStateToCloud', () => {
  it('skipped zonder config', async () => {
    mockConfigured = false;
    await expect(syncProjectDeliveryStateToCloud('p-1')).resolves.toEqual({
      status: 'skipped',
      count: 0,
      message: 'Supabase niet ingesteld',
    });
  });

  it('idle wanneer er niets te syncen is', async () => {
    const res = await syncProjectDeliveryStateToCloud('p-1');
    expect(res).toEqual({ status: 'idle', count: 0 });
  });

  it('synced telt en markeert de juiste lijst', async () => {
    mockGetPunchlist.mockResolvedValue([
      { id: 'p1', title: 'Punt', checked: true, updatedAt: null },
    ]);
    const res = await syncProjectDeliveryStateToCloud('p-1');
    expect(res).toEqual({ status: 'synced', count: 1 });
    expect(mockMarkPunchlist).toHaveBeenCalledTimes(1);
    expect(mockMarkGereed).not.toHaveBeenCalled();
  });

  it('error bij een upsert-fout', async () => {
    mockGetPunchlist.mockResolvedValue([
      { id: 'p1', title: 'Punt', checked: true, updatedAt: null },
    ]);
    upsertResult = { error: { message: 'boom' } };
    const res = await syncProjectDeliveryStateToCloud('p-1');
    expect(res.status).toBe('error');
    expect(res.message).toContain('boom');
  });
});

describe('syncEvidenceQueue', () => {
  it('skipped zonder config', async () => {
    mockConfigured = false;
    await expect(syncEvidenceQueue()).resolves.toEqual({
      status: 'skipped',
      count: 0,
      message: 'Supabase niet ingesteld',
    });
  });

  it('idle zonder pending', async () => {
    mockGetUnsynced.mockResolvedValue([]);
    await expect(syncEvidenceQueue()).resolves.toEqual({ status: 'idle', count: 0 });
  });

  it('error wanneer er pending is maar niets gesynct kon worden', async () => {
    // 1e call (pending-telling) → 1 item; 2e call (binnen de engine) → leeg → 0 gesynct
    mockGetUnsynced.mockResolvedValueOnce([evidenceItem()]).mockResolvedValueOnce([]);
    const res = await syncEvidenceQueue();
    expect(res.status).toBe('error');
    expect(res.count).toBe(1);
  });
});

describe('syncEvidenceToCloud', () => {
  it('happy path (web): upload → insert → cloud-AI → mark synced = 1', async () => {
    mockGetUnsynced.mockResolvedValue([evidenceItem()]);
    const onProgress = jest.fn();
    const count = await syncEvidenceToCloud(onProgress);

    expect(count).toBe(1);
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockRequestCloudAi).toHaveBeenCalledTimes(1);
    expect(mockUpdateAiStatus).toHaveBeenCalledWith(1, 'PASSED', 0.9, 'ok');
    expect(mockMarkSyncedCloud).toHaveBeenCalledWith(1, 99);
    expect(onProgress).toHaveBeenCalled();
  });

  it('WKB_LOCKED: geen retry, markeert FAILED en telt niet mee', async () => {
    mockGetUnsynced.mockResolvedValue([evidenceItem()]);
    uploadResult = { error: { message: 'WKB_LOCKED: dossier afgesloten' } };
    const count = await syncEvidenceToCloud();
    expect(count).toBe(0);
    expect(mockMarkFailed).toHaveBeenCalledWith(1);
    expect(mockRequestCloudAi).not.toHaveBeenCalled();
  });

  it('0 zonder Supabase-config', async () => {
    mockConfigured = false;
    await expect(syncEvidenceToCloud()).resolves.toBe(0);
  });
});
