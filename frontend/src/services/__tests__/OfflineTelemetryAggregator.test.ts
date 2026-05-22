/**
 * Unit-tests voor OfflineTelemetryAggregator.
 *
 * Gedekt:
 *   - collectTelemetrySnapshot integreert alle bronnen
 *   - safe-wrappers vangen errors per bron
 *   - deriveHealthScore: alle penalties geverifieerd
 *   - formatTelemetryLine compact + leesbaar
 */

import type { OfflineTelemetrySnapshot } from '../OfflineTelemetryAggregator';

// Mock alle bron-modules
const mockListEvidence = jest.fn();
jest.mock('../../database/offlineDb', () => ({
  getOfflineStorage: jest.fn(() =>
    Promise.resolve({ listEvidence: mockListEvidence }),
  ),
}));

const mockGetRetrySummary = jest.fn();
jest.mock('../OfflineRetryInsights', () => ({
  getRetrySummary: () => mockGetRetrySummary(),
}));

const mockCountConflicts = jest.fn();
jest.mock('../OfflineConflictResolver', () => ({
  countConflicts: () => mockCountConflicts(),
}));

const mockGetGraceMs = jest.fn();
jest.mock('../OfflineAuthCache', () => ({
  getGraceRemainingMs: () => mockGetGraceMs(),
}));

const mockGetBrandingAge = jest.fn();
jest.mock('../OfflineBrandingCache', () => ({
  getCacheAgeMs: () => mockGetBrandingAge(),
}));

const mockGetBytes = jest.fn();
jest.mock('../OfflineStorageCleanup', () => ({
  getApproximateLocalStorageBytes: () => mockGetBytes(),
}));

import {
  collectTelemetrySnapshot,
  deriveHealthScore,
  formatTelemetryLine,
} from '../OfflineTelemetryAggregator';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function makeSnapshot(
  overrides: Partial<OfflineTelemetrySnapshot> = {},
): OfflineTelemetrySnapshot {
  return {
    capturedAt: '2026-05-22T12:00:00Z',
    storage: { photoCount: 0, approximateBytes: 0 },
    sync: {
      totalPending: 0,
      awaitingRetry: 0,
      exhausted: 0,
      succeededLastHour: 0,
      oldestPendingIso: null,
      conflicts: 0,
    },
    auth: { graceRemainingDays: 30 },
    branding: { ageHours: 0.1 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListEvidence.mockReset().mockResolvedValue([]);
  mockGetRetrySummary.mockReset().mockResolvedValue({
    totalPending: 0,
    awaitingRetry: 0,
    exhausted: 0,
    succeededLastHour: 0,
    oldestPendingIso: null,
  });
  mockCountConflicts.mockReset().mockResolvedValue(0);
  mockGetGraceMs.mockReset().mockResolvedValue(-1);
  mockGetBrandingAge.mockReset().mockResolvedValue(-1);
  mockGetBytes.mockReset().mockResolvedValue(0);
});

// ─── collectTelemetrySnapshot ───────────────────────────────────────────────

describe('collectTelemetrySnapshot', () => {
  it('integreert alle bronnen tot één snapshot', async () => {
    mockListEvidence.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockGetBytes.mockResolvedValue(4_500_000);
    mockGetRetrySummary.mockResolvedValue({
      totalPending: 5,
      awaitingRetry: 3,
      exhausted: 2,
      succeededLastHour: 12,
      oldestPendingIso: '2026-05-22T08:00:00Z',
    });
    mockCountConflicts.mockResolvedValue(2);
    mockGetGraceMs.mockResolvedValue(15 * DAY_MS);
    mockGetBrandingAge.mockResolvedValue(2 * HOUR_MS);

    const snap = await collectTelemetrySnapshot();

    expect(snap.storage.photoCount).toBe(3);
    expect(snap.storage.approximateBytes).toBe(4_500_000);
    expect(snap.sync.totalPending).toBe(5);
    expect(snap.sync.conflicts).toBe(2);
    expect(snap.auth.graceRemainingDays).toBe(15);
    expect(snap.branding.ageHours).toBe(2);
    expect(typeof snap.capturedAt).toBe('string');
  });

  it('safe-wrap: bron-fout in listEvidence → 0 foto-count', async () => {
    mockListEvidence.mockRejectedValue(new Error('db dead'));

    const snap = await collectTelemetrySnapshot();
    expect(snap.storage.photoCount).toBe(0);
  });

  it('safe-wrap: bron-fout in elk endpoint → leeg snapshot, geen throw', async () => {
    mockListEvidence.mockRejectedValue(new Error('x'));
    mockGetBytes.mockRejectedValue(new Error('x'));
    mockGetRetrySummary.mockRejectedValue(new Error('x'));
    mockCountConflicts.mockRejectedValue(new Error('x'));
    mockGetGraceMs.mockRejectedValue(new Error('x'));
    mockGetBrandingAge.mockRejectedValue(new Error('x'));

    const snap = await collectTelemetrySnapshot();

    expect(snap.storage.photoCount).toBe(0);
    expect(snap.sync.totalPending).toBe(0);
    expect(snap.auth.graceRemainingDays).toBe(-1);
    expect(snap.branding.ageHours).toBe(-1);
  });

  it('graceRemainingDays op 1 decimaal afgerond', async () => {
    mockGetGraceMs.mockResolvedValue(5.5 * DAY_MS + 1000); // 5.5 + iets

    const snap = await collectTelemetrySnapshot();
    expect(snap.auth.graceRemainingDays).toBe(5.5);
  });
});

// ─── deriveHealthScore ──────────────────────────────────────────────────────

describe('deriveHealthScore', () => {
  it('100 bij idle/lege snapshot', () => {
    expect(deriveHealthScore(makeSnapshot())).toBe(100);
  });

  it('-25 bij grace < 3 dagen', () => {
    const score = deriveHealthScore(
      makeSnapshot({ auth: { graceRemainingDays: 2 } }),
    );
    expect(score).toBe(75);
  });

  it('grace -1 (geen cache) → geen penalty', () => {
    const score = deriveHealthScore(
      makeSnapshot({ auth: { graceRemainingDays: -1 } }),
    );
    expect(score).toBe(100);
  });

  it('-15 per 10 conflicts (cap 30)', () => {
    expect(
      deriveHealthScore(
        makeSnapshot({
          sync: {
            ...makeSnapshot().sync,
            conflicts: 10,
          },
        }),
      ),
    ).toBe(85);

    expect(
      deriveHealthScore(
        makeSnapshot({
          sync: { ...makeSnapshot().sync, conflicts: 50 },
        }),
      ),
    ).toBe(70); // cap 30
  });

  it('-15 bij exhausted > 0', () => {
    expect(
      deriveHealthScore(
        makeSnapshot({
          sync: { ...makeSnapshot().sync, exhausted: 1 },
        }),
      ),
    ).toBe(85);
  });

  it('-10 bij pending > 50', () => {
    expect(
      deriveHealthScore(
        makeSnapshot({
          sync: { ...makeSnapshot().sync, totalPending: 100 },
        }),
      ),
    ).toBe(90);
  });

  it('-5 per 500MB lokale storage', () => {
    expect(
      deriveHealthScore(
        makeSnapshot({
          storage: { photoCount: 1000, approximateBytes: 1_000_000_000 },
        }),
      ),
    ).toBe(90); // 1GB = 2× 500MB = -10
  });

  it('alles slecht → minimum 0, niet negatief', () => {
    const snap = makeSnapshot({
      auth: { graceRemainingDays: 1 },
      sync: {
        ...makeSnapshot().sync,
        conflicts: 100,
        exhausted: 5,
        totalPending: 200,
      },
      storage: { photoCount: 5000, approximateBytes: 5_000_000_000 },
    });
    expect(deriveHealthScore(snap)).toBeGreaterThanOrEqual(0);
    expect(deriveHealthScore(snap)).toBeLessThanOrEqual(100);
  });
});

// ─── formatTelemetryLine ────────────────────────────────────────────────────

describe('formatTelemetryLine', () => {
  it('bevat alle key-cijfers in compact format', () => {
    const line = formatTelemetryLine(
      makeSnapshot({
        storage: { photoCount: 87, approximateBytes: 130_000_000 },
        sync: { ...makeSnapshot().sync, totalPending: 3, conflicts: 0 },
        auth: { graceRemainingDays: 22 },
      }),
    );

    expect(line).toContain('87 foto');
    expect(line).toContain('130MB');
    expect(line).toContain('3 pending');
    expect(line).toContain('0 conflicts');
    expect(line).toContain('grace 22d');
    expect(line).toContain('health');
  });

  it('"no auth" als grace == -1', () => {
    const line = formatTelemetryLine(
      makeSnapshot({ auth: { graceRemainingDays: -1 } }),
    );
    expect(line).toContain('no auth');
  });
});
