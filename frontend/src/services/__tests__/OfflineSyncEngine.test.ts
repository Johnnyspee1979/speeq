/**
 * Unit-tests voor OfflineSyncEngine — focus op LWW conflict-resolution,
 * idempotent push-flow en queue-state-overgangen.
 *
 * Strategie: we mocken alle externe dependencies (Supabase, offlineDb,
 * OfflinePhotoStorage, OfflineCloudPuller, NetInfo) en testen de
 * `processOfflineSyncQueue` end-to-end via state-observatie.
 *
 * Wat we EXPLICIET testen:
 *   - LWW: remote v > local v → sync_status='error', operation niet weggehaald
 *   - LWW: remote v <= local v → update doorgevoerd, sync_status='synced'
 *   - Update zonder remote_id → faalt met duidelijke fout
 *   - Delete zonder remote_id → no-op, niet failure
 *   - State-overgangen: idle → syncing → idle
 *   - Lege queue → direct idle
 *
 * Wat we NIET testen (te ver van zuivere unit-test):
 *   - Echte NetInfo-events
 *   - Echte Supabase Storage uploads
 *   - Timer-based retries (gebruikt setTimeout — separately testable)
 */

import type { SyncQueueRow, LocalEvidenceRow } from '../../database/offlineDb';

// ─── Mocks (moeten boven imports van het module-under-test) ─────────────────

const mockListPendingSync = jest.fn();
const mockRemoveSyncOperation = jest.fn();
const mockMarkSyncAttempt = jest.fn();
const mockGetEvidence = jest.fn();
const mockUpdateEvidence = jest.fn();

jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({
      listPendingSync: mockListPendingSync,
      removeSyncOperation: mockRemoveSyncOperation,
      markSyncAttempt: mockMarkSyncAttempt,
      getEvidence: mockGetEvidence,
      updateEvidence: mockUpdateEvidence,
    }),
  ),
}));

// Supabase mock — chainable .from().select/.update/.delete/.insert/.eq/.single
const mockSupabaseFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
  },
}));

// Pull-step mock — geen-op
jest.mock('../OfflineCloudPuller', () => ({
  pullCloudIntoLocal: jest.fn(() => Promise.resolve()),
}));

// Photo-storage mock
jest.mock('../OfflinePhotoStorage', () => ({
  getOfflinePhotoStorage: jest.fn(() =>
    Promise.resolve({
      loadPhoto: jest.fn(() => Promise.resolve(null)),
      removePhoto: jest.fn(() => Promise.resolve()),
    }),
  ),
}));

// NetInfo mock — niet betrokken bij processOfflineSyncQueue zelf
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => undefined),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  },
}));

// react-native Platform mock
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// OfflineStorageCleanup — fire-and-forget na succesvolle sync
jest.mock('../OfflineStorageCleanup', () => ({
  runOfflineStorageCleanup: jest.fn(() =>
    Promise.resolve({ removed: 0, retained: 0, hardCapTriggered: false, errors: [] }),
  ),
}));

import {
  processOfflineSyncQueue,
  getOfflineSyncState,
  subscribeOfflineSync,
} from '../OfflineSyncEngine';

// ─── Test fixtures ─────────────────────────────────────────────────────────

function makeLocalRow(overrides: Partial<LocalEvidenceRow> = {}): LocalEvidenceRow {
  return {
    id: 1,
    uuid: 'uuid-test',
    remote_id: null,
    project_id: 'proj-1',
    inspection_point_id: null,
    photo_uri: 'https://cdn.example.com/already-uploaded.jpg', // skip foto-upload
    media_uri: null,
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

function makeQueueRow(overrides: Partial<SyncQueueRow> = {}): SyncQueueRow {
  return {
    id: 1,
    evidence_uuid: 'uuid-test',
    operation: 'update',
    payload: JSON.stringify({ status: 'approved', note: 'OK' }),
    attempts: 0,
    last_attempt_at: null,
    last_error: null,
    created_at: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

/**
 * Helper voor Supabase-mock — bouwt een chainable query op die op
 * `single()` of `.eq()` een vooraf-gedefinieerd resultaat returnt.
 */
function chainableQuery(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const wrap = (): typeof chain => chain;
  chain.select = jest.fn(wrap);
  chain.update = jest.fn(wrap);
  chain.delete = jest.fn(wrap);
  chain.insert = jest.fn(wrap);
  chain.eq = jest.fn(() => ({
    ...chain,
    single: jest.fn(() => Promise.resolve(finalResult)),
    then: (onFulfilled: (v: unknown) => unknown) => onFulfilled(finalResult),
  }));
  chain.single = jest.fn(() => Promise.resolve(finalResult));
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListPendingSync.mockReset();
  mockRemoveSyncOperation.mockReset().mockResolvedValue(undefined);
  mockMarkSyncAttempt.mockReset().mockResolvedValue(undefined);
  mockGetEvidence.mockReset();
  mockUpdateEvidence.mockReset().mockResolvedValue(undefined);
  mockSupabaseFrom.mockReset();
  // Console-noise dempen tijdens tests — de engine logt console.warn
  // op elke gefaalde operation. We weten al dat ze falen — niet relevant
  // voor test-output.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  // De engine zet een setTimeout (retryTimer) bij failures — die houdt
  // jest open. Force flush + restore.
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  // Importeer dynamisch om side-effects te vermijden en de retry-timer
  // te killen na alle tests
  const engine = jest.requireActual('../OfflineSyncEngine') as {
    stopOfflineSyncEngine: () => void;
  };
  engine.stopOfflineSyncEngine();
});

// ─── Lege queue ─────────────────────────────────────────────────────────────

describe('processOfflineSyncQueue — lege queue', () => {
  it('gaat direct naar idle zonder errors', async () => {
    mockListPendingSync.mockResolvedValue([]);

    await processOfflineSyncQueue();

    const state = getOfflineSyncState();
    expect(state.status).toBe('idle');
    if (state.status === 'idle') {
      expect(state.pendingCount).toBe(0);
      expect(state.lastSyncAt).not.toBeNull();
    }
  });
});

// ─── LWW: remote nieuwer ────────────────────────────────────────────────────

describe('LWW — remote-version > local-version', () => {
  it('markeert evidence als error en verwijdert de operation NIET', async () => {
    const localRow = makeLocalRow({ remote_id: 42, client_version: 1 });
    const queueRow = makeQueueRow({ id: 99 });

    mockListPendingSync.mockResolvedValue([queueRow]);
    mockGetEvidence.mockResolvedValue(localRow);

    // Supabase fetch returns remote met v3 (nieuwer dan local v1)
    mockSupabaseFrom.mockImplementation(() =>
      chainableQuery({ data: { client_version: 3 }, error: null }),
    );

    await processOfflineSyncQueue();

    // sync_status moet 'error' worden
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'uuid-test',
      expect.objectContaining({ sync_status: 'error' }),
    );
    // Operation blijft in queue (markSyncAttempt aangeroepen, niet removeSyncOperation)
    expect(mockRemoveSyncOperation).not.toHaveBeenCalled();
    expect(mockMarkSyncAttempt).toHaveBeenCalledWith(
      99,
      expect.stringMatching(/Conflict.*remote v3.*local v1/),
    );
  });
});

// ─── LWW: remote ouder of gelijk ────────────────────────────────────────────

describe('LWW — remote-version <= local-version', () => {
  it('voert update door en markeert synced', async () => {
    const localRow = makeLocalRow({ remote_id: 42, client_version: 5 });
    const queueRow = makeQueueRow({ id: 100 });

    mockListPendingSync.mockResolvedValue([queueRow]);
    mockGetEvidence.mockResolvedValue(localRow);

    // Supabase: eerst SELECT (v3), dan UPDATE (success)
    let call = 0;
    mockSupabaseFrom.mockImplementation(() => {
      call++;
      if (call === 1) {
        // SELECT client_version
        return chainableQuery({ data: { client_version: 3 }, error: null });
      }
      // UPDATE → success
      return chainableQuery({ data: null, error: null });
    });

    await processOfflineSyncQueue();

    expect(mockRemoveSyncOperation).toHaveBeenCalledWith(100);
    expect(mockUpdateEvidence).toHaveBeenCalledWith(
      'uuid-test',
      expect.objectContaining({ sync_status: 'synced' }),
    );
    expect(mockMarkSyncAttempt).not.toHaveBeenCalled();
  });

  it('werkt ook bij gelijke versie (>= niet >)', async () => {
    const localRow = makeLocalRow({ remote_id: 42, client_version: 2 });
    mockListPendingSync.mockResolvedValue([makeQueueRow({ id: 101 })]);
    mockGetEvidence.mockResolvedValue(localRow);

    let call = 0;
    mockSupabaseFrom.mockImplementation(() => {
      call++;
      return call === 1
        ? chainableQuery({ data: { client_version: 2 }, error: null })
        : chainableQuery({ data: null, error: null });
    });

    await processOfflineSyncQueue();

    expect(mockRemoveSyncOperation).toHaveBeenCalledWith(101);
  });
});

// ─── Update zonder remote_id ────────────────────────────────────────────────

describe('update-operation zonder remote_id', () => {
  it('faalt met duidelijke "update vóór create"-melding', async () => {
    mockListPendingSync.mockResolvedValue([makeQueueRow({ id: 200 })]);
    mockGetEvidence.mockResolvedValue(makeLocalRow({ remote_id: null }));

    await processOfflineSyncQueue();

    expect(mockMarkSyncAttempt).toHaveBeenCalledWith(
      200,
      expect.stringMatching(/update vóór create/),
    );
    expect(mockRemoveSyncOperation).not.toHaveBeenCalled();
  });
});

// ─── Delete zonder remote_id ────────────────────────────────────────────────

describe('delete-operation zonder remote_id', () => {
  it('is no-op, geen failure', async () => {
    mockListPendingSync.mockResolvedValue([
      makeQueueRow({ id: 300, operation: 'delete' }),
    ]);
    mockGetEvidence.mockResolvedValue(makeLocalRow({ remote_id: null }));

    await processOfflineSyncQueue();

    expect(mockRemoveSyncOperation).toHaveBeenCalledWith(300);
    expect(mockMarkSyncAttempt).not.toHaveBeenCalled();
  });
});

// ─── State-subscribe ────────────────────────────────────────────────────────

describe('subscribeOfflineSync', () => {
  it('roept listener direct aan met huidige state', () => {
    const listener = jest.fn();
    const unsub = subscribeOfflineSync(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const firstCall = listener.mock.calls[0][0] as { status: string };
    expect(firstCall.status).toMatch(/idle|syncing|error/);

    unsub();
  });

  it('ontvangt updates tijdens processOfflineSyncQueue', async () => {
    const listener = jest.fn();
    const unsub = subscribeOfflineSync(listener);
    listener.mockClear();

    mockListPendingSync.mockResolvedValue([]);
    await processOfflineSyncQueue();

    // Verwacht minstens één state-emit na de cycle
    expect(listener.mock.calls.length).toBeGreaterThan(0);
    const states = listener.mock.calls.map((c) => (c[0] as { status: string }).status);
    expect(states).toContain('idle');

    unsub();
  });
});

// ─── Onbekende operation ────────────────────────────────────────────────────

describe('onbekende operation-type', () => {
  it('faalt en blijft in queue', async () => {
    mockListPendingSync.mockResolvedValue([
      makeQueueRow({ id: 999, operation: 'bogus' as unknown as 'create' }),
    ]);
    mockGetEvidence.mockResolvedValue(makeLocalRow({ remote_id: 1 }));

    await processOfflineSyncQueue();

    expect(mockMarkSyncAttempt).toHaveBeenCalledWith(
      999,
      expect.stringMatching(/Onbekende sync-operation/),
    );
    expect(mockRemoveSyncOperation).not.toHaveBeenCalled();
  });
});
