/**
 * Unit-tests voor EvidenceRepository (cloud + local implementaties).
 *
 * Gedekt:
 *
 * CloudEvidenceRepository:
 *   - listForReview delegate
 *   - updateStatus delegate
 *   - createEvidence: data-URL → blob → upload + insert succesvol
 *   - createEvidence: HTTP-URL → fetch → blob
 *   - createEvidence: Blob direct → geen fetch
 *   - createEvidence: upload-fout → null + console.error
 *   - createEvidence: insert-fout → null
 *
 * LocalEvidenceRepository:
 *   - listForReview: mapt rows naar EvidenceRecord (remote_id heeft prioriteit)
 *   - updateStatus: vindt rij op remote_id, schrijft pending + enqueue
 *   - updateStatus: niet gevonden → false + console.error
 *   - createEvidence: savePhoto + insertEvidence + enqueue create
 *   - createEvidence: error-pad → null
 */

import type { LocalEvidenceRow } from '../../database/offlineDb';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockCloudFetchEvidenceForReview = jest.fn();
const mockCloudUpdateEvidenceStatus = jest.fn();

jest.mock('../cloudEvidenceService', () => ({
  fetchEvidenceForReview: (...args: unknown[]) =>
    mockCloudFetchEvidenceForReview(...args),
  updateEvidenceStatus: (...args: unknown[]) =>
    mockCloudUpdateEvidenceStatus(...args),
}));

// Supabase mock — storage upload + getPublicUrl, plus DB insert chain
const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn();
const mockDbInsert = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, blob: Blob, opts: unknown) =>
          mockStorageUpload(path, blob, opts),
        getPublicUrl: (path: string) => mockStorageGetPublicUrl(path),
      }),
    },
    from: () => ({
      insert: (row: unknown) => ({
        select: () => ({
          single: () => mockDbInsert(row),
        }),
      }),
    }),
  },
}));

const mockSavePhoto = jest.fn();
jest.mock('../OfflinePhotoStorage', () => ({
  getOfflinePhotoStorage: jest.fn(() =>
    Promise.resolve({
      savePhoto: mockSavePhoto,
    }),
  ),
}));

const mockListEvidence = jest.fn();
const mockUpdateEvidence = jest.fn();
const mockInsertEvidence = jest.fn();
const mockEnqueueSyncOperation = jest.fn();

jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({
      listEvidence: mockListEvidence,
      updateEvidence: mockUpdateEvidence,
      insertEvidence: mockInsertEvidence,
      enqueueSyncOperation: mockEnqueueSyncOperation,
    }),
  ),
  generateEvidenceUuid: jest.fn(() => 'uuid-fixed-for-test'),
}));

// fetch mock — voor photoSourceToBlob bij HTTP-URLs
const mockFetch = jest.fn();
(globalThis as { fetch: typeof mockFetch }).fetch = mockFetch;

// atob mock — Node 18+ heeft 'm wel, maar voor zekerheid
if (!globalThis.atob) {
  (globalThis as { atob: (s: string) => string }).atob = (s) =>
    Buffer.from(s, 'base64').toString('binary');
}

import {
  cloudEvidenceRepository,
  localEvidenceRepository,
  type EvidenceCreateInput,
} from '../EvidenceRepository';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeCreateInput(overrides: Partial<EvidenceCreateInput> = {}): EvidenceCreateInput {
  return {
    projectId: 'proj-1',
    photoSource: 'data:image/jpeg;base64,/9j/4AAQ', // tiny stub
    timestamp: '2026-05-22T10:00:00Z',
    latitude: 52.0,
    longitude: 4.3,
    ...overrides,
  };
}

function makeLocalRow(overrides: Partial<LocalEvidenceRow> = {}): LocalEvidenceRow {
  return {
    id: 1,
    uuid: 'uuid-1',
    remote_id: null,
    project_id: 'proj-1',
    inspection_point_id: null,
    photo_uri: 'local://photo.jpg',
    media_uri: 'local://photo.jpg',
    timestamp: '2026-05-22T10:00:00Z',
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
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    last_sync_at: null,
    client_version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCloudFetchEvidenceForReview.mockReset();
  mockCloudUpdateEvidenceStatus.mockReset();
  mockStorageUpload.mockReset().mockResolvedValue({ error: null });
  mockStorageGetPublicUrl.mockReset().mockReturnValue({
    data: { publicUrl: 'https://cdn.example.com/foo.jpg' },
  });
  mockDbInsert.mockReset().mockResolvedValue({ data: { id: 42 }, error: null });
  mockSavePhoto.mockReset().mockResolvedValue('local://saved.jpg');
  mockListEvidence.mockReset().mockResolvedValue([]);
  mockUpdateEvidence.mockReset().mockResolvedValue(undefined);
  mockInsertEvidence
    .mockReset()
    .mockImplementation((row: Partial<LocalEvidenceRow>) =>
      Promise.resolve({ ...makeLocalRow(), ...row, id: 100 }),
    );
  mockEnqueueSyncOperation.mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── CloudEvidenceRepository ────────────────────────────────────────────────

describe('cloudEvidenceRepository', () => {
  describe('listForReview', () => {
    it('delegate naar cloudFetchEvidenceForReview', async () => {
      mockCloudFetchEvidenceForReview.mockResolvedValue([{ id: 1 }]);

      const result = await cloudEvidenceRepository.listForReview('proj-1');

      expect(mockCloudFetchEvidenceForReview).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual([{ id: 1 }]);
    });
  });

  describe('updateStatus', () => {
    it('delegate naar cloudUpdateEvidenceStatus', async () => {
      mockCloudUpdateEvidenceStatus.mockResolvedValue(true);

      const result = await cloudEvidenceRepository.updateStatus(1, 'APPROVED', 'OK');

      expect(mockCloudUpdateEvidenceStatus).toHaveBeenCalledWith(1, 'APPROVED', 'OK');
      expect(result).toBe(true);
    });
  });

  describe('createEvidence', () => {
    it('happy path: data-URL → upload + insert returnt id', async () => {
      const id = await cloudEvidenceRepository.createEvidence(makeCreateInput());

      expect(id).toBe(42);
      expect(mockStorageUpload).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          photo_uri: 'https://cdn.example.com/foo.jpg',
          client_uuid: 'uuid-fixed-for-test',
          client_version: 1,
        }),
      );
    });

    it('HTTP-URL → fetch + blob', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(
            new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' }),
          ),
      });

      const id = await cloudEvidenceRepository.createEvidence(
        makeCreateInput({ photoSource: 'https://example.com/img.jpg' }),
      );

      expect(id).toBe(42);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/img.jpg');
    });

    it('Blob direct → geen fetch nodig', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

      const id = await cloudEvidenceRepository.createEvidence(
        makeCreateInput({ photoSource: blob }),
      );

      expect(id).toBe(42);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it('upload-fout → null + log', async () => {
      mockStorageUpload.mockResolvedValue({
        error: { message: 'storage full' },
      });

      const id = await cloudEvidenceRepository.createEvidence(makeCreateInput());

      expect(id).toBeNull();
      expect(console.error).toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('insert-fout → null + log', async () => {
      mockDbInsert.mockResolvedValue({ data: null, error: { message: 'rls violation' } });

      const id = await cloudEvidenceRepository.createEvidence(makeCreateInput());

      expect(id).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('vangt exception in photoSourceToBlob', async () => {
      mockFetch.mockRejectedValue(new Error('network'));

      const id = await cloudEvidenceRepository.createEvidence(
        makeCreateInput({ photoSource: 'https://example.com/dead.jpg' }),
      );

      expect(id).toBeNull();
    });
  });
});

// ─── LocalEvidenceRepository ────────────────────────────────────────────────

describe('localEvidenceRepository', () => {
  describe('listForReview', () => {
    it('mapt lokale rows naar EvidenceRecord, remote_id heeft prioriteit', async () => {
      mockListEvidence.mockResolvedValue([
        makeLocalRow({ id: 100, remote_id: 999 }),
        makeLocalRow({ id: 101, remote_id: null }),
      ]);

      const result = await localEvidenceRepository.listForReview('proj-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(999); // remote_id heeft prioriteit
      expect(result[1].id).toBe(101); // fallback naar lokale id
      expect(mockListEvidence).toHaveBeenCalledWith({ projectId: 'proj-1' });
    });
  });

  describe('updateStatus', () => {
    it('vindt rij op remote_id, markeert pending + enqueue update-op', async () => {
      mockListEvidence.mockResolvedValue([
        makeLocalRow({ id: 1, remote_id: 999, uuid: 'uuid-target' }),
      ]);

      const ok = await localEvidenceRepository.updateStatus(999, 'APPROVED', 'OK');

      expect(ok).toBe(true);
      expect(mockUpdateEvidence).toHaveBeenCalledWith('uuid-target', {
        ai_status: 'APPROVED',
        ai_notes: 'OK',
        sync_status: 'pending',
      });
      expect(mockEnqueueSyncOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence_uuid: 'uuid-target',
          operation: 'update',
          payload: JSON.stringify({ status: 'APPROVED', note: 'OK' }),
        }),
      );
    });

    it('vindt rij op lokale id wanneer geen remote_id', async () => {
      mockListEvidence.mockResolvedValue([
        makeLocalRow({ id: 50, remote_id: null, uuid: 'uuid-local-only' }),
      ]);

      const ok = await localEvidenceRepository.updateStatus(50, 'REJECTED');

      expect(ok).toBe(true);
      expect(mockUpdateEvidence).toHaveBeenCalledWith(
        'uuid-local-only',
        expect.objectContaining({ ai_status: 'REJECTED' }),
      );
    });

    it('niet gevonden → false + log', async () => {
      mockListEvidence.mockResolvedValue([]);

      const ok = await localEvidenceRepository.updateStatus(123, 'APPROVED');

      expect(ok).toBe(false);
      expect(mockUpdateEvidence).not.toHaveBeenCalled();
      expect(mockEnqueueSyncOperation).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('createEvidence', () => {
    it('savePhoto + insertEvidence + enqueue create', async () => {
      const id = await localEvidenceRepository.createEvidence(makeCreateInput());

      expect(id).toBe(100); // mock insertEvidence returnt id:100
      expect(mockSavePhoto).toHaveBeenCalledWith(
        'uuid-fixed-for-test',
        expect.anything(),
      );
      expect(mockInsertEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          uuid: 'uuid-fixed-for-test',
          remote_id: null,
          project_id: 'proj-1',
          photo_uri: 'local://saved.jpg',
          sync_status: 'pending',
          client_version: 1,
        }),
      );
      expect(mockEnqueueSyncOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence_uuid: 'uuid-fixed-for-test',
          operation: 'create',
        }),
      );
    });

    it('savePhoto fail → null + geen enqueue', async () => {
      mockSavePhoto.mockRejectedValue(new Error('disk full'));

      const id = await localEvidenceRepository.createEvidence(makeCreateInput());

      expect(id).toBeNull();
      expect(mockInsertEvidence).not.toHaveBeenCalled();
      expect(mockEnqueueSyncOperation).not.toHaveBeenCalled();
    });
  });
});
