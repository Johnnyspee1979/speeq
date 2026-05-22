/**
 * Unit-tests voor OfflineTelemetryBootstrap.
 *
 * Gedekt:
 *   - start triggert directe snapshot
 *   - start is idempotent
 *   - stop killt de interval
 *   - captureTelemetryNow returnt + roept consumer
 *   - default consumer = console.info met formatTelemetryLine
 *   - consumer-fout breekt loop niet
 */

const mockSnapshot = {
  capturedAt: '2026-05-22T12:00:00Z',
  storage: { photoCount: 5, approximateBytes: 1_000_000 },
  sync: {
    totalPending: 0,
    awaitingRetry: 0,
    exhausted: 0,
    succeededLastHour: 0,
    oldestPendingIso: null,
    conflicts: 0,
  },
  auth: { graceRemainingDays: 22 },
  branding: { ageHours: 0.5 },
};

const mockCollectSnapshot = jest.fn();
const mockFormatLine = jest.fn();

jest.mock('../OfflineTelemetryAggregator', () => ({
  collectTelemetrySnapshot: () => mockCollectSnapshot(),
  formatTelemetryLine: (s: unknown) => mockFormatLine(s),
}));

import {
  startOfflineTelemetry,
  stopOfflineTelemetry,
  captureTelemetryNow,
  __resetOfflineTelemetryForTests,
} from '../OfflineTelemetryBootstrap';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockCollectSnapshot.mockReset().mockResolvedValue(mockSnapshot);
  mockFormatLine.mockReset().mockReturnValue('[telemetry] 5 foto · idle');
  __resetOfflineTelemetryForTests();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  __resetOfflineTelemetryForTests();
});

// ─── start / stop ───────────────────────────────────────────────────────────

describe('startOfflineTelemetry', () => {
  it('triggert direct een snapshot bij start', async () => {
    startOfflineTelemetry();
    // microtask flush
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — twee aanroepen blijven 1 timer', async () => {
    startOfflineTelemetry();
    startOfflineTelemetry();
    await Promise.resolve();
    await Promise.resolve();
    // Slechts één snapshot na start
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(1);
  });

  it('runt op gegeven interval', async () => {
    startOfflineTelemetry(undefined, 10_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(3);
  });

  it('default consumer logt naar console.info via formatTelemetryLine', async () => {
    startOfflineTelemetry();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockFormatLine).toHaveBeenCalledWith(mockSnapshot);
    expect(console.info).toHaveBeenCalledWith('[telemetry] 5 foto · idle');
  });
});

describe('stopOfflineTelemetry', () => {
  it('killt de interval', async () => {
    startOfflineTelemetry(undefined, 10_000);
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(1);

    stopOfflineTelemetry();
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(1);
  });

  it('na stop kun je opnieuw starten', async () => {
    startOfflineTelemetry();
    stopOfflineTelemetry();
    startOfflineTelemetry();
    await Promise.resolve();
    await Promise.resolve();
    // 1× bij eerste start, 1× bij tweede
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(2);
  });
});

// ─── captureTelemetryNow ────────────────────────────────────────────────────

describe('captureTelemetryNow', () => {
  it('returnt snapshot', async () => {
    const snap = await captureTelemetryNow();
    expect(snap).toBe(mockSnapshot);
  });

  it('roept default consumer', async () => {
    await captureTelemetryNow();
    expect(console.info).toHaveBeenCalled();
  });

  it('custom consumer wordt aangeroepen', async () => {
    const customConsumer = jest.fn();
    startOfflineTelemetry(customConsumer);
    await Promise.resolve();
    await Promise.resolve();

    expect(customConsumer).toHaveBeenCalledWith(mockSnapshot);
  });

  it('consumer-throw breekt geen loop', async () => {
    const badConsumer = jest.fn(() => {
      throw new Error('consumer-bug');
    });
    startOfflineTelemetry(badConsumer, 5_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(console.warn).toHaveBeenCalled();
    // Volgende interval-tick werkt ook nog
    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(2);
  });

  it('snapshot-fout breekt geen loop', async () => {
    mockCollectSnapshot.mockRejectedValueOnce(new Error('boom'));
    startOfflineTelemetry(undefined, 5_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(console.warn).toHaveBeenCalled();
    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    expect(mockCollectSnapshot).toHaveBeenCalledTimes(2);
  });
});
