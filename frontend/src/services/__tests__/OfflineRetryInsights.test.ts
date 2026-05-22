/**
 * Unit-tests voor OfflineRetryInsights.
 */

import type { SyncQueueRow } from '../../database/offlineDb';

const mockListPendingSync = jest.fn();
jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({ listPendingSync: mockListPendingSync }),
  ),
}));

import {
  getRetrySummary,
  listFailedOperations,
  listExhaustedOperations,
  groupErrorsByMessage,
} from '../OfflineRetryInsights';

function makeOp(overrides: Partial<SyncQueueRow> = {}): SyncQueueRow {
  return {
    id: 1,
    evidence_uuid: 'uuid-1',
    operation: 'update',
    payload: '{}',
    attempts: 0,
    last_attempt_at: null,
    last_error: null,
    created_at: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockListPendingSync.mockReset().mockResolvedValue([]);
});

// ─── getRetrySummary ────────────────────────────────────────────────────────

describe('getRetrySummary', () => {
  it('lege queue → alles 0, null oudste', async () => {
    const s = await getRetrySummary();
    expect(s).toEqual({
      totalPending: 0,
      awaitingRetry: 0,
      exhausted: 0,
      succeededLastHour: 0,
      oldestPendingIso: null,
    });
  });

  it('telt awaitingRetry en exhausted apart', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 2 }),
      makeOp({ id: 2, attempts: 5 }), // exhausted (MAX=5)
      makeOp({ id: 3, attempts: 0 }),
      makeOp({ id: 4, attempts: 6 }), // exhausted
    ]);

    const s = await getRetrySummary();
    expect(s.totalPending).toBe(4);
    expect(s.exhausted).toBe(2);
    expect(s.awaitingRetry).toBe(2);
  });

  it('vindt oudste pending', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, created_at: '2026-05-22T12:00:00Z' }),
      makeOp({ id: 2, created_at: '2026-05-22T08:00:00Z' }),
      makeOp({ id: 3, created_at: '2026-05-22T15:00:00Z' }),
    ]);

    const s = await getRetrySummary();
    expect(s.oldestPendingIso).toBe('2026-05-22T08:00:00Z');
  });
});

// ─── listFailedOperations ───────────────────────────────────────────────────

describe('listFailedOperations', () => {
  it('filtert attempts > 0', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 0 }),
      makeOp({ id: 2, attempts: 1 }),
      makeOp({ id: 3, attempts: 3 }),
    ]);

    const list = await listFailedOperations();
    expect(list).toHaveLength(2);
    expect(list.map((o) => o.id).sort()).toEqual([2, 3]);
  });

  it('sorteert op meest-recent-gefaald eerst', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 1, last_attempt_at: '2026-05-22T10:00:00Z' }),
      makeOp({ id: 2, attempts: 1, last_attempt_at: '2026-05-22T14:00:00Z' }),
      makeOp({ id: 3, attempts: 1, last_attempt_at: '2026-05-22T12:00:00Z' }),
    ]);

    const list = await listFailedOperations();
    expect(list.map((o) => o.id)).toEqual([2, 3, 1]);
  });

  it('exhausted-flag bij attempts >= 5', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 4 }),
      makeOp({ id: 2, attempts: 5 }),
      makeOp({ id: 3, attempts: 7 }),
    ]);

    const list = await listFailedOperations();
    expect(list.find((o) => o.id === 1)?.exhausted).toBe(false);
    expect(list.find((o) => o.id === 2)?.exhausted).toBe(true);
    expect(list.find((o) => o.id === 3)?.exhausted).toBe(true);
  });
});

// ─── listExhaustedOperations ────────────────────────────────────────────────

describe('listExhaustedOperations', () => {
  it('alleen attempts >= 5', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 3 }),
      makeOp({ id: 2, attempts: 5 }),
      makeOp({ id: 3, attempts: 10 }),
    ]);

    const list = await listExhaustedOperations();
    expect(list).toHaveLength(2);
    expect(list.every((o) => o.exhausted)).toBe(true);
  });
});

// ─── groupErrorsByMessage ───────────────────────────────────────────────────

describe('groupErrorsByMessage', () => {
  it('groepeert identieke errors', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 1, last_error: 'Network timeout' }),
      makeOp({ id: 2, attempts: 1, last_error: 'Network timeout' }),
      makeOp({ id: 3, attempts: 1, last_error: '401 Unauthorized' }),
    ]);

    const groups = await groupErrorsByMessage();
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      message: 'Network timeout',
      count: 2,
      sampleUuid: expect.any(String),
    });
  });

  it('normaliseert UUIDs in error-msg voor groupering', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({
        id: 1,
        attempts: 1,
        last_error: 'Conflict uuid=abc123de-4567-8901-2345-6789abcdef00 detected',
      }),
      makeOp({
        id: 2,
        attempts: 1,
        last_error: 'Conflict uuid=11223344-5566-7788-99aa-bbccddeeff00 detected',
      }),
    ]);

    const groups = await groupErrorsByMessage();
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].message).toContain('uuid=*');
  });

  it('normaliseert lange ID-getallen (4+ digits)', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 1, last_error: 'Row 12345 niet gevonden' }),
      makeOp({ id: 2, attempts: 1, last_error: 'Row 67890 niet gevonden' }),
    ]);

    const groups = await groupErrorsByMessage();
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].message).toContain('Row * niet gevonden');
  });

  it('null error → "(onbekende fout)" bucket', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 1, last_error: null }),
      makeOp({ id: 2, attempts: 1, last_error: null }),
    ]);

    const groups = await groupErrorsByMessage();
    expect(groups[0].message).toBe('(onbekende fout)');
    expect(groups[0].count).toBe(2);
  });

  it('sorteert op count desc', async () => {
    mockListPendingSync.mockResolvedValue([
      makeOp({ id: 1, attempts: 1, last_error: 'A' }),
      makeOp({ id: 2, attempts: 1, last_error: 'B' }),
      makeOp({ id: 3, attempts: 1, last_error: 'B' }),
      makeOp({ id: 4, attempts: 1, last_error: 'B' }),
    ]);

    const groups = await groupErrorsByMessage();
    expect(groups[0].message).toBe('B');
    expect(groups[0].count).toBe(3);
    expect(groups[1].message).toBe('A');
  });
});
