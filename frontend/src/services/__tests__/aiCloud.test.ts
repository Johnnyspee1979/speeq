/**
 * Unit-tests voor aiCloud — `requestCloudAiValidation`: de achtergrond-call naar
 * de backend-AI met een "zachte" token-attach (Bearer alleen als er een sessie
 * is; ontbreekt die of faalt getSession, dan gaat de call zónder token door).
 *
 * We mocken config/app (BACKEND_URL), de Supabase-sessie en global.fetch, en
 * borgen: de juiste URL/methode/Content-Type + JSON-body; Authorization wel/niet;
 * fallback naar geen-token als getSession gooit; en een throw bij !ok.
 */

let mockSession: { data: { session: unknown } } = {
  data: { session: { access_token: 'tok-1' } },
};
let mockGetSessionThrows = false;

jest.mock('../../config/app', () => ({ BACKEND_URL: 'http://bk.test' }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        mockGetSessionThrows
          ? Promise.reject(new Error('geen sessie'))
          : Promise.resolve(mockSession),
    },
  },
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import { requestCloudAiValidation } from '../aiCloud';

const okBody = {
  status: 'PASSED',
  confidence: 0.92,
  detectedObjects: ['wapening'],
  feedback: 'ok',
  checks: ['dekking'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { data: { session: { access_token: 'tok-1' } } };
  mockGetSessionThrows = false;
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(okBody) });
});

describe('requestCloudAiValidation', () => {
  it('POST naar /api/ai/validate met Bearer, Content-Type en JSON-body', async () => {
    const res = await requestCloudAiValidation({ image: 'b64', template: { id: 't1' } });
    expect(res).toEqual(okBody);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('http://bk.test/api/ai/validate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(JSON.parse(init.body)).toMatchObject({ image: 'b64', template: { id: 't1' } });
  });

  it('laat Authorization weg zonder sessie-token', async () => {
    mockSession = { data: { session: null } };
    await requestCloudAiValidation({ image: 'b64' });
    const [, init] = mockFetch.mock.calls[0] as [string, any];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('valt terug op geen-token als getSession gooit', async () => {
    mockGetSessionThrows = true;
    await requestCloudAiValidation({ image: 'b64' });
    const [, init] = mockFetch.mock.calls[0] as [string, any];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('gooit bij een !ok-response', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(requestCloudAiValidation({ image: 'b64' })).rejects.toThrow(
      'Cloud AI request failed',
    );
  });
});
