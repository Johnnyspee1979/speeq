/**
 * Unit-tests voor OfflineStorageCleanup.
 *
 * We mocken getOfflineStorage + getOfflinePhotoStorage zodat we de
 * selectie-logica (age + hard-cap) puur kunnen testen zonder
 * SQLite/IndexedDB/file-system afhankelijkheden.
 *
 * Beleid onder test:
 *   - Bewaar: pending/syncing/error + synced van laatste 30 dagen
 *   - Verwijder: synced + last_sync_at > 30 dagen
 *   - Hard cap: bij > 1000 synced → oudste eerst weg
 */

import type { LocalEvidenceRow } from '../../database/offlineDb';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockListEvidence = jest.fn();
const mockUpdateEvidence = jest.fn();
const mockRemovePhoto = jest.fn();

jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({
      listEvidence: mockListEvidence,
      updateEvidence: mockUpdateEvidence,
    }),
  ),
}));

jest.mock('../OfflinePhotoStorage', () => ({
  getOfflinePhotoStorage: jest.fn(() =>
    Promise.resolve({
      removePhoto: mockRemovePhoto,
    }),
  ),
}));

import {
  runOfflineStorageCleanup,
  getApproximateLocalStorageBytes,
} from '../OfflineStorageCleanup';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function makeRow(overrides: Partial<LocalEvidenceRow> = {}): LocalEvidenceRow {
  return {
    id: 1,
    uuid: 'uuid-' + Math.random().toString(36).slice(2, 10),
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
    sync_status: 'synced',
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
    last_sync_at: daysAgo(60),
    client_version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  mockListEvidence.mockReset();
  mockUpdateEvidence.mockReset().mockResolvedValue(undefined);
  mockRemovePhoto.mockReset().mockResolvedValue(undefined);
});

// ─── Age-based removal ──────────────────────────────────────────────────────

describe('runOfflineStorageCleanup — age', () => {
  it('verwijdert synced rows ouder dan 30 dagen', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ uuid: 'old-1', last_sync_at: daysAgo(45) }),
      makeRow({ uuid: 'old-2', last_sync_at: daysAgo(31) }),
      makeRow({ uuid: 'fresh', last_sync_at: daysAgo(5) }),
    ]);

    const result = await runOfflineStorageCleanup();

    expect(result.removed).toBe(2);
    expect(result.retained).toBe(1);
    expect(mockRemovePhoto).toHaveBeenCalledWith('old-1');
    expect(mockRemovePhoto).toHaveBeenCalledWith('old-2');
    expect(mockRemovePhoto).not.toHaveBeenCalledWith('fresh');
  });

  it('verwijdert NOOIT pending rows, hoe oud ook', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ uuid: 'pending-old', sync_status: 'pending', last_sync_at: daysAgo(90) }),
      makeRow({ uuid: 'syncing-old', sync_status: 'syncing', last_sync_at: daysAgo(90) }),
      makeRow({ uuid: 'error-old', sync_status: 'error', last_sync_at: daysAgo(90) }),
    ]);

    const result = await runOfflineStorageCleanup();

    expect(result.removed).toBe(0);
    expect(result.retained).toBe(3);
    expect(mockRemovePhoto).not.toHaveBeenCalled();
  });

  it('verwijdert NOOIT rows zonder last_sync_at (onbekend = veilig houden)', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ uuid: 'no-sync-date', sync_status: 'synced', last_sync_at: null }),
    ]);

    const result = await runOfflineStorageCleanup();

    expect(result.removed).toBe(0);
    expect(result.retained).toBe(1);
  });

  it('idempotent — geen rows, geen errors', async () => {
    mockListEvidence.mockResolvedValue([]);

    const result = await runOfflineStorageCleanup();

    expect(result).toEqual({
      removed: 0,
      retained: 0,
      hardCapTriggered: false,
      errors: [],
    });
  });
});

// ─── Hard cap ───────────────────────────────────────────────────────────────

describe('runOfflineStorageCleanup — hard cap (1000)', () => {
  it('triggert bij > 1000 synced rows binnen retention-window', async () => {
    // 1001 verse synced rows — geen age-removal, maar hard-cap moet 1 wegrooien
    const rows: LocalEvidenceRow[] = [];
    for (let i = 0; i < 1001; i++) {
      rows.push(
        makeRow({
          uuid: `row-${i.toString().padStart(4, '0')}`,
          last_sync_at: daysAgo(i / 100), // jongste = i=0, oudste = i=1000
        }),
      );
    }
    mockListEvidence.mockResolvedValue(rows);

    const result = await runOfflineStorageCleanup();

    expect(result.hardCapTriggered).toBe(true);
    expect(result.removed).toBe(1);
    expect(result.retained).toBe(1000);

    // Oudste row (i=1000) moet zijn weggehaald
    expect(mockRemovePhoto).toHaveBeenCalledWith('row-1000');
  });

  it('triggert NIET bij exact 1000 synced rows', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      makeRow({ uuid: `row-${i}`, last_sync_at: daysAgo(i / 100) }),
    );
    mockListEvidence.mockResolvedValue(rows);

    const result = await runOfflineStorageCleanup();

    expect(result.hardCapTriggered).toBe(false);
    expect(result.removed).toBe(0);
  });
});

// ─── Failure isolation ─────────────────────────────────────────────────────

describe('runOfflineStorageCleanup — error handling', () => {
  it('verzamelt errors per row maar gaat door met de rest', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow({ uuid: 'fail-1', last_sync_at: daysAgo(40) }),
      makeRow({ uuid: 'ok-1', last_sync_at: daysAgo(40) }),
    ]);
    mockRemovePhoto.mockImplementation((uuid: string) =>
      uuid === 'fail-1'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(),
    );

    const result = await runOfflineStorageCleanup();

    expect(result.removed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/fail-1/);
    expect(result.errors[0]).toMatch(/boom/);
  });

  it('vangt fouten uit listEvidence in cleanup-loop error', async () => {
    mockListEvidence.mockRejectedValue(new Error('db dead'));

    const result = await runOfflineStorageCleanup();

    expect(result.removed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/cleanup-loop/);
    expect(result.errors[0]).toMatch(/db dead/);
  });
});

// ─── Approximate size ──────────────────────────────────────────────────────

describe('getApproximateLocalStorageBytes', () => {
  it('rekent 1.5MB per row', async () => {
    mockListEvidence.mockResolvedValue([
      makeRow(),
      makeRow(),
      makeRow(),
      makeRow(),
    ]);

    const bytes = await getApproximateLocalStorageBytes();
    expect(bytes).toBe(4 * 1_500_000);
  });

  it('returneert 0 bij lege lijst', async () => {
    mockListEvidence.mockResolvedValue([]);
    expect(await getApproximateLocalStorageBytes()).toBe(0);
  });
});
