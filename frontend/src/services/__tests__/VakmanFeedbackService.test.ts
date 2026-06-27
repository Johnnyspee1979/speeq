/**
 * Unit-tests voor VakmanFeedbackService — meldt de vakman zodra zijn foto wordt
 * afgekeurd, via Supabase Realtime (directe push) + een polling-fallback.
 *
 * We mocken de Supabase-client (channel + query-builder) en borgen:
 *   - subscribeToRejections zet een realtime-channel op en geeft een stop-functie
 *     die het channel verwijdert en de polling-timer cleart;
 *   - de realtime-handler vuurt alleen bij een échte status-overgang naar FAILED
 *     (AI_FAILED) of NEEDS_REVIEW, niet als de status ongewijzigd blijft;
 *   - de polling-fallback mapt FAILED → AI_FAILED en NEEDS_REVIEW → NEEDS_REVIEW.
 */

const mockChannelObj: any = {
  on: jest.fn((_ev: unknown, _cfg: unknown, handler: any) => {
    mockChannelObj._handler = handler;
    return mockChannelObj;
  }),
  subscribe: jest.fn(() => mockChannelObj),
  _handler: undefined as any,
};
const mockChannel = jest.fn((..._a: unknown[]) => mockChannelObj);
const mockRemoveChannel = jest.fn((..._a: unknown[]) => undefined);

let mockPollResult: { data: unknown[]; error: unknown } = { data: [], error: null };
const builder: any = {
  select: () => builder,
  eq: () => builder,
  or: () => builder,
  gt: () => builder,
  order: () => builder,
  limit: () => Promise.resolve(mockPollResult),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: (...a: unknown[]) => mockChannel(...a),
    removeChannel: (...a: unknown[]) => mockRemoveChannel(...a),
    from: () => builder,
  },
}));

import { subscribeToRejections } from '../VakmanFeedbackService';

const flush = () => new Promise((res) => setTimeout(res, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockChannelObj._handler = undefined;
  mockPollResult = { data: [], error: null };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('subscribeToRejections', () => {
  it('zet een realtime-channel op en geeft een werkende stop-functie', () => {
    const stop = subscribeToRejections('u1', jest.fn());
    expect(mockChannel).toHaveBeenCalledWith('vakman-feedback-u1');
    expect(mockChannelObj.subscribe).toHaveBeenCalled();

    stop();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelObj);
  });
});

describe('realtime-handler', () => {
  it('vuurt AI_FAILED bij overgang naar FAILED', () => {
    const onRej = jest.fn();
    const stop = subscribeToRejections('u1', onRej);
    mockChannelObj._handler({
      new: { id: 7, inspection_point_id: 'WAPENING-1', project_id: 'p-1', ai_status: 'FAILED', ai_notes: 'te weinig dekking' },
      old: { ai_status: 'PENDING' },
    });
    expect(onRej).toHaveBeenCalledTimes(1);
    expect(onRej.mock.calls[0]![0]).toMatchObject({
      evidenceId: 7,
      inspectionPointId: 'WAPENING-1',
      projectId: 'p-1',
      reason: 'AI_FAILED',
      notes: 'te weinig dekking',
    });
    stop();
  });

  it('vuurt NEEDS_REVIEW bij overgang naar NEEDS_REVIEW', () => {
    const onRej = jest.fn();
    const stop = subscribeToRejections('u1', onRej);
    mockChannelObj._handler({
      new: { id: 8, inspection_point_id: 'GEVEL-2', project_id: 'p-1', ai_status: 'NEEDS_REVIEW', ai_notes: null },
      old: { ai_status: 'PASSED' },
    });
    expect(onRej.mock.calls[0]![0].reason).toBe('NEEDS_REVIEW');
    stop();
  });

  it('vuurt niet als de status ongewijzigd blijft', () => {
    const onRej = jest.fn();
    const stop = subscribeToRejections('u1', onRej);
    mockChannelObj._handler({
      new: { id: 9, ai_status: 'FAILED' },
      old: { ai_status: 'FAILED' },
    });
    expect(onRej).not.toHaveBeenCalled();
    stop();
  });
});

describe('polling-fallback', () => {
  it('mapt FAILED → AI_FAILED en NEEDS_REVIEW → NEEDS_REVIEW', async () => {
    mockPollResult = {
      data: [
        { id: 1, inspection_point_id: 'A', project_id: 'p', ai_status: 'FAILED', ai_notes: null, updated_at: '2026-06-27T10:00:00Z' },
        { id: 2, inspection_point_id: 'B', project_id: 'p', ai_status: 'NEEDS_REVIEW', ai_notes: 'check', updated_at: '2026-06-27T10:01:00Z' },
      ],
      error: null,
    };
    const onRej = jest.fn();
    const stop = subscribeToRejections('u1', onRej);
    await flush();
    stop();

    const reasons = onRej.mock.calls.map((c) => (c[0] as any).reason);
    expect(reasons).toContain('AI_FAILED');
    expect(reasons).toContain('NEEDS_REVIEW');
    expect(onRej).toHaveBeenCalledTimes(2);
  });
});
