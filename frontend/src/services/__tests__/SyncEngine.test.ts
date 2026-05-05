const fetchNetworkStateMock = jest.fn();
const syncPresetsToCloudMock = jest.fn();
const syncEvidenceQueueMock = jest.fn();

const getUserMock = jest.fn();
const storageUploadMock = jest.fn();
const storageGetPublicUrlMock = jest.fn();
const storageFromMock = jest.fn();
const singleMock = jest.fn();
const updateEqMock = jest.fn();
const updateMock = jest.fn();
const fromMock = jest.fn();
const fileBase64Mock = jest.fn();
const decodeMock = jest.fn();
const getUnsyncedEvidenceMock = jest.fn();
const getPunchlistItemsMock = jest.fn();
const getGereedmeldingItemsMock = jest.fn();
const getConsumerDossierItemsMock = jest.fn();
const getConsumerDossierDocumentsMock = jest.fn();
const markPunchlistItemsSyncedMock = jest.fn();
const markGereedmeldingItemsSyncedMock = jest.fn();
const markConsumerDossierItemsSyncedMock = jest.fn();
const markConsumerDossierDocumentsSyncedMock = jest.fn();
const markEvidenceSyncedWithCloudIdMock = jest.fn();
const markEvidenceSyncFailedMock = jest.fn();
const updateEvidenceAiStatusMock = jest.fn();
const requestCloudAiValidationMock = jest.fn();
const isSupabaseConfiguredMock = jest.fn();

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: fileBase64Mock,
  })),
}));

jest.mock('base64-arraybuffer', () => ({
  decode: (...args: unknown[]) => decodeMock(...args),
}));

jest.mock('../../database/database', () => ({
  getUnsyncedEvidence: (...args: unknown[]) => getUnsyncedEvidenceMock(...args),
  getPunchlistItems: (...args: unknown[]) => getPunchlistItemsMock(...args),
  getGereedmeldingItems: (...args: unknown[]) => getGereedmeldingItemsMock(...args),
  getConsumerDossierItems: (...args: unknown[]) =>
    getConsumerDossierItemsMock(...args),
  getConsumerDossierDocuments: (...args: unknown[]) =>
    getConsumerDossierDocumentsMock(...args),
  markPunchlistItemsSynced: (...args: unknown[]) =>
    markPunchlistItemsSyncedMock(...args),
  markGereedmeldingItemsSynced: (...args: unknown[]) =>
    markGereedmeldingItemsSyncedMock(...args),
  markConsumerDossierItemsSynced: (...args: unknown[]) =>
    markConsumerDossierItemsSyncedMock(...args),
  markConsumerDossierDocumentsSynced: (...args: unknown[]) =>
    markConsumerDossierDocumentsSyncedMock(...args),
  markEvidenceSyncedWithCloudId: (...args: unknown[]) =>
    markEvidenceSyncedWithCloudIdMock(...args),
  markEvidenceSyncFailed: (...args: unknown[]) => markEvidenceSyncFailedMock(...args),
  getAllPresets: jest.fn().mockResolvedValue([]),
  updateEvidenceAiStatus: (...args: unknown[]) => updateEvidenceAiStatusMock(...args),
}));

jest.mock('../aiCloud', () => ({
  requestCloudAiValidation: (...args: unknown[]) =>
    requestCloudAiValidationMock(...args),
}));

jest.mock('../wkbCompliance', () => ({
  getEvidenceComplianceContext: () => ({
    disciplineId: 'constructie_fundering',
    disciplineTitle: 'Constructie & Fundering',
    title: 'Mock inspectiepunt',
    standards: 'Mock norm',
    stopMoment: null,
    requiresMeasurementTool: false,
    dossierScope: 'BEVOEGD_GEZAG',
    selectionSource: 'WKB',
  }),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfiguredMock(),
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { runSyncEngine } from '../SyncEngine';
import { syncEvidenceToCloud, syncProjectDeliveryStateToCloud } from '../sync';

describe('Wkb Sync-Engine', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    isSupabaseConfiguredMock.mockReturnValue(true);
    fetchNetworkStateMock.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    syncPresetsToCloudMock.mockResolvedValue(0);
    syncEvidenceQueueMock.mockResolvedValue({ status: 'synced', count: 0 });
    getUserMock.mockResolvedValue({ data: { user: { id: 'worker-1' } } });
    storageUploadMock.mockResolvedValue({ error: null });
    storageGetPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/evidence-1.jpg' },
    });
    storageFromMock.mockReturnValue({
      upload: storageUploadMock,
      getPublicUrl: storageGetPublicUrlMock,
    });
    singleMock.mockResolvedValue({ data: { id: 77 }, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({
      eq: updateEqMock,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'evidence') {
        return {
          insert: () => ({
            select: () => ({
              single: singleMock,
            }),
          }),
          update: updateMock,
        };
      }

      return {
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };
    });
    fileBase64Mock.mockResolvedValue('base64-binary');
    decodeMock.mockReturnValue(new ArrayBuffer(8));
    requestCloudAiValidationMock.mockResolvedValue({
      status: 'PASSED',
      confidence: 0.97,
      feedback: 'Foto technisch akkoord.',
    });
    updateEvidenceAiStatusMock.mockResolvedValue(undefined);
    getPunchlistItemsMock.mockResolvedValue([]);
    getGereedmeldingItemsMock.mockResolvedValue([]);
    getConsumerDossierItemsMock.mockResolvedValue([]);
    getConsumerDossierDocumentsMock.mockResolvedValue([]);
    markPunchlistItemsSyncedMock.mockResolvedValue(undefined);
    markGereedmeldingItemsSyncedMock.mockResolvedValue(undefined);
    markConsumerDossierItemsSyncedMock.mockResolvedValue(undefined);
    markConsumerDossierDocumentsSyncedMock.mockResolvedValue(undefined);
    markEvidenceSyncedWithCloudIdMock.mockResolvedValue(undefined);
    markEvidenceSyncFailedMock.mockResolvedValue(undefined);
    getUnsyncedEvidenceMock.mockResolvedValue([]);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as jest.Mock;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('breekt synchronisatie af als de bouwplaats offline is', async () => {
    fetchNetworkStateMock.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const result = await runSyncEngine({
      fetchNetworkState: fetchNetworkStateMock,
      syncPresetsToCloud: syncPresetsToCloudMock,
      syncEvidenceQueue: syncEvidenceQueueMock,
    });

    expect(result).toEqual({
      status: 'skipped',
      count: 0,
      message: 'Geen stabiele internetverbinding voor synchronisatie.',
    });
    expect(syncPresetsToCloudMock).not.toHaveBeenCalled();
    expect(syncEvidenceQueueMock).not.toHaveBeenCalled();
  });

  test('pusht PENDING bewijslast naar de cloud en markeert lokaal als SYNCED', async () => {
    getUnsyncedEvidenceMock.mockResolvedValue([
      {
        rowId: 11,
        id: 'evidence-1',
        projectId: '104A',
        inspectionPointId: 'wapening-001',
        mediaUri: 'file:///tmp/evidence-1.jpg',
        timestamp: '2026-03-14T10:00:00.000Z',
        latitude: 52.01,
        longitude: 4.31,
        gpsAccuracy: 3,
        exifHash: 'sha256-evidence-1',
        exifVerified: true,
        userId: 'worker-1',
        ifcGuid: null,
        fieldNote: 'Wapening gefotografeerd voor stort.',
        syncStatus: 'PENDING',
        aiStatus: 'PENDING',
        aiConfidence: null,
        aiNotes: null,
      },
    ]);

    const syncedCount = await syncEvidenceToCloud();

    expect(syncedCount).toBe(1);
    expect(storageUploadMock).toHaveBeenCalledTimes(1);
    expect(singleMock).toHaveBeenCalledTimes(1);
    expect(markEvidenceSyncedWithCloudIdMock).toHaveBeenCalledWith(11, 77);
    expect(markEvidenceSyncFailedMock).not.toHaveBeenCalled();
    expect(updateEvidenceAiStatusMock).toHaveBeenCalledWith(
      11,
      'PASSED',
      0.97,
      'Foto technisch akkoord.'
    );
  });

  test('zet lokaal op FAILED bij een 403 RBAC-fout vanuit de cloud', async () => {
    getUnsyncedEvidenceMock.mockResolvedValue([
      {
        rowId: 21,
        id: 'evidence-rbac',
        projectId: '104A',
        inspectionPointId: 'wapening-007',
        mediaUri: 'file:///tmp/evidence-rbac.jpg',
        timestamp: '2026-03-14T11:00:00.000Z',
        latitude: 52.02,
        longitude: 4.32,
        gpsAccuracy: 4,
        exifHash: 'sha256-evidence-rbac',
        exifVerified: true,
        userId: 'worker-2',
        ifcGuid: null,
        fieldNote: 'Upload vanuit onderaannemer.',
        syncStatus: 'PENDING',
        aiStatus: 'PENDING',
        aiConfidence: null,
        aiNotes: null,
      },
    ]);
    singleMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Geen rechten voor dit project', status: 403 },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Geen rechten voor dit project', status: 403 },
      });

    const syncedCount = await syncEvidenceToCloud();

    expect(syncedCount).toBe(0);
    expect(singleMock).toHaveBeenCalledTimes(2);
    expect(markEvidenceSyncFailedMock).toHaveBeenCalledWith(21);
    expect(markEvidenceSyncedWithCloudIdMock).not.toHaveBeenCalled();
  });

  test('synchroniseert consumentendossier-context naar de cloud en markeert lokaal als SYNCED', async () => {
    getPunchlistItemsMock.mockResolvedValue([
      {
        id: 'p1',
        title: 'Restpunt opgelost',
        checked: true,
        updatedAt: '2026-03-14T12:00:00.000Z',
      },
    ]);
    getGereedmeldingItemsMock.mockResolvedValue([
      {
        id: 'req_1',
        title: 'Verklaring aanwezig',
        checked: true,
        updatedAt: '2026-03-14T12:00:00.000Z',
      },
    ]);
    getConsumerDossierItemsMock.mockResolvedValue([
      {
        id: 'cd_1',
        title: 'As-built aanwezig',
        checked: true,
        updatedAt: '2026-03-14T12:00:00.000Z',
      },
    ]);
    getConsumerDossierDocumentsMock.mockResolvedValue([
      {
        id: 'cdd_1',
        requirementId: 'cd_1',
        title: 'As-built tekeningen',
        category: 'AS_BUILT',
        referenceValue: 'Revisiemap A',
        notes: 'Serverlocatie toegevoegd',
        updatedAt: '2026-03-14T12:00:00.000Z',
      },
    ]);

    const result = await syncProjectDeliveryStateToCloud('104A');

    expect(result).toEqual({ status: 'synced', count: 4 });
    expect(fromMock).toHaveBeenCalledWith('project_checklists');
    expect(fromMock).toHaveBeenCalledWith('consumer_dossier_documents');
    expect(markPunchlistItemsSyncedMock).toHaveBeenCalledWith('104A');
    expect(markGereedmeldingItemsSyncedMock).toHaveBeenCalledWith('104A');
    expect(markConsumerDossierItemsSyncedMock).toHaveBeenCalledWith('104A');
    expect(markConsumerDossierDocumentsSyncedMock).toHaveBeenCalledWith('104A');
  });
});
