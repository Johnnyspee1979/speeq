/**
 * Unit-tests voor OfflineConflictResolver.
 *
 * Gedekt:
 *   - listConflicts: filtert op sync_status='error'
 *   - countConflicts
 *   - resolveConflict keep-local: pending + version+1 + enqueue
 *   - resolveConflict accept-cloud: synced + version-1 + queue-cleanup
 *   - resolveConflict: rij niet meer aanwezig → ok:false
 *   - resolveConflict: status niet 'error' → ok:false
 *   - resolveConflict: DB-throw → ok:false met error-msg
 *   - resolveAll bulk
 */

import type {
  LocalEvidenceRow,
  SyncQueueRow,
} from '../../database/offlineDb';

const mockListEvidence = jest.fn();
const mockGetEvidence = jest.fn();
const mockUpdateEvidence = jest.fn();
const mockEnqueueSyncOperation = jest.fn();
const mockListPendingSync = jest.fn();
const mockRemoveSyncOperation = jest.fn();

jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({
      listEvidence: mockListEvidence,
      getEvidence: mockGetEvidence,
      updateEvidence: mockUpdateEvidence,
      enqueueSyncOperation: mockEnqueueSyncOperation,
      listPendingSync: mockListPendingSync,
      removeSyncOperation: mockRemoveSyncOperation,
    }),
  ),
}));

import {
  listConflicts,
  countConflicts,
  resolveConflict,
  resolveAll,
} from '../OfflineConflictResolver';

function makeRow(overrides: Partial<LocalEvidenceRow> = {}): LocalEvidenceRow {
  return {
    id: 1,
    uuid: 'uuid-1',
    remote_id: 42,
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
    field_note: 'lokaal',
    betonkwaliteit: null,
    milieuklasse: null,
    volume: null,
    leverdatum: null,
    ai_status: 'APPROVED',
    ai_confidence: null,
    ai_notes: 'akkoord',
    sync_status: 'error',
    created_at: '2026-05-22T10:00:00Z',
    updated_at: '2026-05-22T10:00:00Z',
    last_sync_at: null,
    client_version: 3,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListEvidence.mockReset().mockResolvedValue([]);
  mockGetEvidence.mockReset().mockResolvedValue(null);
  mockUpdateEvidence.mockReset().mockResolvedValue(undefined);
  mockEnqueueSyncOperation.mockReset().mockResolvedValue(undefined);
  mockListPendingSync.mockReset().mockResolvedValue([]);
  mockRemoveSyncOperation.mockReset().mockResolvedValue(undefined);
});

// ─── listConflicts ──────────────────────────────────────────────────────────

describe('listConflicts', () => {
  it('filtert op sync_status=error', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ uuid: 'a', sync_status: 'error' }),
      makeRow({ uuid: 'b', sync_status: 'synced' }),
      makeRow({ uuid: 'c', sync_status: 'pending' }),
      makeRow({ uuid: 'd', sync_status: 'error' }),
    ]);

    const list = await listConflicts();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.uuid).sort()).toEqual(['a', 'd']);
  });

  it('mapt naar ConflictRow shape', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({
        uuid: 'x',
        remote_id: 99,
        project_id: 'p-9',
        photo_uri: 'local://x.jpg',
        field_note: 'note',
        ai_status: 'REJECTED',
        client_version: 5,
        updated_at: '2026-05-22T13:00:00Z',
      }),
    ]);

    const list = await listConflicts();
    expect(list[0]).toEqual({
      uuid: 'x',
      remoteId: 99,
      projectId: 'p-9',
      photoUri: 'local://x.jpg',
      fieldNote: 'note',
      aiStatus: 'REJECTED',
      localVersion: 5,
      updatedAt: '2026-05-22T13:00:00Z',
    });
  });
});

describe('countConflicts', () => {
  it('telt error-rows', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ sync_status: 'error' }),
      makeRow({ sync_status: 'error' }),
      makeRow({ sync_status: 'synced' }),
    ]);
    expect(await countConflicts()).toBe(2);
  });

  it('0 bij geen conflicts', async () => {
    mockListEvidence.mockResolvedValue([makeRow({ sync_status: 'synced' })]);
    expect(await countConflicts()).toBe(0);
  });
});

// ─── resolveConflict — keep-local ───────────────────────────────────────────

describe("resolveConflict 'keep-local'", () => {
  it('pending + client_version+1 + enqueue update', async () => {
    mockGetEvidence.mockResolvedValue(makeRow({ uuid: 'u-1', client_version: 3 }));

    const result = await resolveConflict('u-1', 'keep-local');

    expect(result.ok).toBe(true);
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        sync_status: 'pending',
        client_version: 4,
      }),
    );
    expect(mockEnqueueSyncOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_uuid: 'u-1',
        operation: 'update',
      }),
    );
  });

  it('enqueue payload bevat huidige ai_status + ai_notes', async () => {
    mockGetEvidence.mockResolvedValue(
      makeRow({ uuid: 'u-2', ai_status: 'APPROVED', ai_notes: 'OK note' }),
    );

    await resolveConflict('u-2', 'keep-local');

    const payloadCall = mockEnqueueSyncOperation.mock.calls[0][0] as SyncQueueRow;
    expect(JSON.parse(payloadCall.payload)).toEqual({
      status: 'APPROVED',
      note: 'OK note',
    });
  });
});

// ─── resolveConflict — accept-cloud ─────────────────────────────────────────

describe("resolveConflict 'accept-cloud'", () => {
  it('synced + client_version-1 + verwijdert pending ops voor deze uuid', async () => {
    mockGetEvidence.mockResolvedValue(makeRow({ uuid: 'u-3', client_version: 5 }));
    mockListPendingSync.mockResolvedValue([
      { id: 10, evidence_uuid: 'u-3' } as SyncQueueRow,
      { id: 11, evidence_uuid: 'other' } as SyncQueueRow,
      { id: 12, evidence_uuid: 'u-3' } as SyncQueueRow,
    ]);

    const result = await resolveConflict('u-3', 'accept-cloud');

    expect(result.ok).toBe(true);
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'u-3',
      expect.objectContaining({
        sync_status: 'synced',
        client_version: 4,
      }),
    );
    expect(mockRemoveSyncOperation).toHaveBeenCalledWith(10);
    expect(mockRemoveSyncOperation).toHaveBeenCalledWith(12);
    // Other queue's op blijft
    expect(mockRemoveSyncOperation).not.toHaveBeenCalledWith(11);
  });

  it('client_version blijft minstens 1 (geen 0 of negatief)', async () => {
    mockGetEvidence.mockResolvedValue(makeRow({ client_version: 1 }));

    await resolveConflict('u-4', 'accept-cloud');

    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'u-4',
      expect.objectContaining({ client_version: 1 }),
    );
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('resolveConflict — edge cases', () => {
  it('rij niet aanwezig → ok:false', async () => {
    mockGetEvidence.mockResolvedValue(null);

    const result = await resolveConflict('unknown', 'keep-local');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/niet meer aanwezig/);
    expect(mockUpdateEvidence).not.toHaveBeenCalled();
  });

  it('status niet error → ok:false (dubbele resolutie voorkomen)', async () => {
    mockGetEvidence.mockResolvedValue(makeRow({ sync_status: 'synced' }));

    const result = await resolveConflict('u', 'keep-local');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Geen conflict/);
  });

  it('DB-throw → ok:false met error-msg', async () => {
    mockGetEvidence.mockResolvedValue(makeRow());
    mockUpdateEvidence.mockRejectedValue(new Error('db locked'));

    const result = await resolveConflict('u', 'keep-local');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/db locked/);
  });
});

// ─── resolveAll ─────────────────────────────────────────────────────────────

describe('resolveAll bulk', () => {
  it('roept resolveConflict per uuid aan, returnt array', async () => {
    mockGetEvidence.mockImplementation((uuid: string) =>
      Promise.resolve(makeRow({ uuid })),
    );

    const results = await resolveAll(['a', 'b', 'c'], 'keep-local');

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.uuid)).toEqual(['a', 'b', 'c']);
  });

  it('mix van success + fail', async () => {
    mockGetEvidence.mockImplementation((uuid: string) =>
      uuid === 'missing' ? Promise.resolve(null) : Promise.resolve(makeRow({ uuid })),
    );

    const results = await resolveAll(['ok', 'missing'], 'accept-cloud');

    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });
});
