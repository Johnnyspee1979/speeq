/**
 * Unit-tests voor OfflineCloudPuller.
 *
 * Gedekt:
 *   - Geen actieve tenant → bail-out met error
 *   - Lege fetch → bijwerkt last-pull-iso, geen inserts
 *   - Nieuwe remote rij → insert + photo-cache call
 *   - Remote == local versie → skipped, geen update
 *   - Remote < local versie → skipped (lokaal wint)
 *   - Remote > local versie zonder pending → update doorgevoerd
 *   - Remote > local versie MÉT pending push → conflict, sync_status='error'
 *   - Supabase fetch-error → in errors[]
 */

import type { LocalEvidenceRow, SyncQueueRow } from '../../database/offlineDb';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockGetEvidence = jest.fn();
const mockListEvidence = jest.fn();
const mockInsertEvidence = jest.fn();
const mockUpdateEvidence = jest.fn();
const mockListPendingSync = jest.fn();

jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({
      getEvidence: mockGetEvidence,
      listEvidence: mockListEvidence,
      insertEvidence: mockInsertEvidence,
      updateEvidence: mockUpdateEvidence,
      listPendingSync: mockListPendingSync,
    }),
  ),
}));

const mockSupabaseFetch = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        gt: () => ({
          order: () => ({
            limit: () => mockSupabaseFetch(),
          }),
        }),
      }),
    }),
  },
}));

const mockGetActiveTenantId = jest.fn();
jest.mock('../../config/tenant', () => ({
  getActiveTenantId: () => mockGetActiveTenantId(),
}));

const mockSavePhoto = jest.fn();
const mockLoadPhoto = jest.fn();
jest.mock('../OfflinePhotoStorage', () => ({
  getOfflinePhotoStorage: jest.fn(() =>
    Promise.resolve({
      savePhoto: mockSavePhoto,
      loadPhoto: mockLoadPhoto,
    }),
  ),
}));

// localforage — in-memory mock voor pullMetaStore
const localforageData = new Map<string, string>();
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    createInstance: () => ({
      getItem: (key: string) =>
        Promise.resolve(localforageData.get(key) ?? null),
      setItem: (key: string, val: string) => {
        localforageData.set(key, val);
        return Promise.resolve(val);
      },
      removeItem: (key: string) => {
        localforageData.delete(key);
        return Promise.resolve();
      },
    }),
  },
}));

import { pullCloudIntoLocal, resetPullState } from '../OfflineCloudPuller';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeLocalRow(overrides: Partial<LocalEvidenceRow> = {}): LocalEvidenceRow {
  return {
    id: 1,
    uuid: 'uuid-local',
    remote_id: null,
    project_id: 'proj-1',
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
    sync_status: 'synced',
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    last_sync_at: '2026-05-22T10:00:00Z',
    client_version: 1,
    ...overrides,
  };
}

function makeRemoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    client_uuid: 'uuid-local',
    client_version: 2,
    project_id: 'proj-1',
    inspection_point_id: null,
    photo_uri: 'https://cdn.example.com/p.jpg',
    media_uri: 'https://cdn.example.com/p.jpg',
    timestamp: '2026-05-22T12:00:00Z',
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
    ai_status: 'approved',
    ai_confidence: 0.9,
    ai_notes: null,
    updated_at: '2026-05-22T12:00:00Z',
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetEvidence.mockReset().mockResolvedValue(null);
  mockListEvidence.mockReset().mockResolvedValue([]);
  mockInsertEvidence.mockReset().mockResolvedValue(undefined);
  mockUpdateEvidence.mockReset().mockResolvedValue(undefined);
  mockListPendingSync.mockReset().mockResolvedValue([]);
  mockSupabaseFetch.mockReset();
  mockGetActiveTenantId.mockReset().mockReturnValue('tenant-1');
  mockSavePhoto.mockReset().mockResolvedValue('local://cached.jpg');
  mockLoadPhoto.mockReset().mockResolvedValue(null);
  localforageData.clear();
  await resetPullState();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('pullCloudIntoLocal — bail-outs', () => {
  it('bail-out zonder actieve tenant', async () => {
    mockGetActiveTenantId.mockReturnValue(null);

    const result = await pullCloudIntoLocal();

    expect(result.fetched).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Geen actieve tenant/);
    expect(mockSupabaseFetch).not.toHaveBeenCalled();
  });

  it('vangt Supabase fetch-error en stopt', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    const result = await pullCloudIntoLocal();

    expect(result.fetched).toBe(0);
    expect(result.errors[0]).toMatch(/connection refused/);
  });
});

describe('pullCloudIntoLocal — lege fetch', () => {
  it('update last-pull-iso ook bij 0 results', async () => {
    mockSupabaseFetch.mockResolvedValue({ data: [], error: null });

    const result = await pullCloudIntoLocal();

    expect(result.fetched).toBe(0);
    expect(result.inserted).toBe(0);
    // Tweede call: zou de eerder gezette ISO moeten gebruiken (geen 30d-window meer)
    expect(localforageData.has('speeq_offline_last_pull_iso')).toBe(true);
  });
});

describe('pullCloudIntoLocal — nieuwe rij vanuit cloud', () => {
  it('insert lokaal + cache de foto', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ id: 200, client_uuid: 'uuid-cloud-new' })],
      error: null,
    });
    // Geen lokale match → insert-pad
    mockGetEvidence.mockResolvedValue(null);
    mockListEvidence.mockResolvedValue([]);

    const result = await pullCloudIntoLocal();

    expect(result.inserted).toBe(1);
    expect(mockInsertEvidence).toHaveBeenCalledTimes(1);
    expect(mockSavePhoto).toHaveBeenCalledWith(
      'uuid-cloud-new',
      'https://cdn.example.com/p.jpg',
    );

    // Lokale rij krijgt de cached URI als photo_uri
    const insertCall = mockInsertEvidence.mock.calls[0][0] as Partial<LocalEvidenceRow>;
    expect(insertCall.photo_uri).toBe('local://cached.jpg');
    expect(insertCall.sync_status).toBe('synced');
  });

  it('fallback uuid bij ontbrekend client_uuid', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ id: 300, client_uuid: null })],
      error: null,
    });

    const result = await pullCloudIntoLocal();

    expect(result.inserted).toBe(1);
    const inserted = mockInsertEvidence.mock.calls[0][0] as Partial<LocalEvidenceRow>;
    expect(inserted.uuid).toBe('cloud-300');
  });
});

describe('pullCloudIntoLocal — versie-vergelijking', () => {
  it('skipped bij remote == local versie', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ client_version: 3 })],
      error: null,
    });
    mockGetEvidence.mockResolvedValue(makeLocalRow({ client_version: 3 }));

    const result = await pullCloudIntoLocal();

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockUpdateEvidence).not.toHaveBeenCalled();
  });

  it('skipped bij remote < local (lokaal wint)', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ client_version: 1 })],
      error: null,
    });
    mockGetEvidence.mockResolvedValue(makeLocalRow({ client_version: 5 }));

    const result = await pullCloudIntoLocal();

    expect(result.skipped).toBe(1);
    expect(mockUpdateEvidence).not.toHaveBeenCalled();
  });
});

describe('pullCloudIntoLocal — remote nieuwer, geen pending push', () => {
  it('overschrijft lokale rij', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ client_version: 5, ai_status: 'approved' })],
      error: null,
    });
    mockGetEvidence.mockResolvedValue(makeLocalRow({ client_version: 2 }));
    mockListPendingSync.mockResolvedValue([]);

    const result = await pullCloudIntoLocal();

    expect(result.updated).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'uuid-local',
      expect.objectContaining({
        ai_status: 'approved',
        client_version: 5,
        sync_status: 'synced',
      }),
    );
  });
});

describe('pullCloudIntoLocal — conflict: remote nieuwer MET pending push', () => {
  it('markeert lokale rij als error, geen overschrijving', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ client_version: 5 })],
      error: null,
    });
    mockGetEvidence.mockResolvedValue(makeLocalRow({ client_version: 2 }));
    mockListPendingSync.mockResolvedValue([
      { id: 1, evidence_uuid: 'uuid-local', operation: 'update' } as SyncQueueRow,
    ]);

    const result = await pullCloudIntoLocal();

    expect(result.conflicts).toBe(1);
    expect(result.updated).toBe(0);
    // Eerste updateEvidence-call: alleen sync_status='error', niets meer
    expect(mockUpdateEvidence).toHaveBeenCalledWith('uuid-local', {
      sync_status: 'error',
    });
  });
});

describe('pullCloudIntoLocal — fallback identificatie op remote_id', () => {
  it('vindt lokale rij via remote_id wanneer client_uuid niet matcht', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [makeRemoteRow({ id: 999, client_uuid: 'unknown-uuid' })],
      error: null,
    });
    mockGetEvidence.mockResolvedValue(null); // client_uuid hit faalt
    mockListEvidence.mockResolvedValue([
      makeLocalRow({ uuid: 'old-uuid', remote_id: 999, client_version: 1 }),
    ]);

    const result = await pullCloudIntoLocal();

    // Remote v2 > local v1 → moet update doen op de gevonden lokale rij
    expect(result.updated).toBe(1);
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'old-uuid',
      expect.objectContaining({ client_version: 2 }),
    );
  });
});

describe('pullCloudIntoLocal — error-isolatie per rij', () => {
  it('vangt per-rij errors, gaat door met de rest', async () => {
    mockSupabaseFetch.mockResolvedValue({
      data: [
        makeRemoteRow({ id: 1, client_uuid: 'fail-uuid' }),
        makeRemoteRow({ id: 2, client_uuid: 'ok-uuid', client_version: 5 }),
      ],
      error: null,
    });

    mockGetEvidence.mockImplementation((uuid: string) => {
      if (uuid === 'fail-uuid') return Promise.reject(new Error('db error'));
      return Promise.resolve(makeLocalRow({ uuid: 'ok-uuid', client_version: 2 }));
    });
    mockListPendingSync.mockResolvedValue([]);

    const result = await pullCloudIntoLocal();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/row 1.*db error/);
    expect(result.updated).toBe(1); // de ok-row is wel verwerkt
  });
});
