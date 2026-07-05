/**
 * Unit-tests voor cloudEvidenceService — het reviewers-vlak: bewijs ophalen uit
 * de cloud (`evidence`-tabel, privé-bucket `wkb-evidence`) en een reviewstatus
 * doorzetten naar de backend.
 *
 * We mocken de Supabase-client (chainbare thenable query-builder + auth.getSession),
 * storageUrl (paden → signed URLs) en global.fetch, en borgen:
 *   - fetchEvidenceForReview: sorteert op timestamp desc, filtert optioneel op
 *     project_id, tekent photo_uri/media_uri als signed URLs en geeft [] bij fout;
 *   - updateEvidenceStatus: false zonder sessie (geen fetch), POST met Bearer +
 *     JSON-body bij sessie, true bij ok, false bij !ok.
 */

let mockListResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockSession: { data: { session: unknown } } = {
  data: { session: { access_token: 'tok-1' } },
};
const calls: Record<string, any> = {};

const mockBuilder: any = {
  select: (...a: unknown[]) => {
    calls.select = a;
    return mockBuilder;
  },
  order: (...a: unknown[]) => {
    calls.order = a;
    return mockBuilder;
  },
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return mockBuilder;
  },
  then: (res: any, rej: any) => Promise.resolve(mockListResult).then(res, rej),
};

jest.mock('../../config/app', () => ({ BACKEND_URL: 'http://bk.test' }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      calls.from = a;
      return mockBuilder;
    },
    auth: {
      getSession: () => Promise.resolve(mockSession),
    },
  },
}));

jest.mock('../../lib/storageUrl', () => ({
  resolveStorageUrls: (_b: unknown, paths: Array<string | null | undefined>) =>
    Promise.resolve(paths.map((p) => (p ? `signed://${p}` : p))),
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import { fetchEvidenceForReview, updateEvidenceStatus } from '../cloudEvidenceService';

beforeEach(() => {
  jest.clearAllMocks();
  mockListResult = { data: [], error: null };
  mockSession = { data: { session: { access_token: 'tok-1' } } };
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('fetchEvidenceForReview', () => {
  it('sorteert desc, tekent signed URLs en filtert niet zonder projectId', async () => {
    mockListResult = {
      data: [
        { id: 1, project_id: 'p-1', photo_uri: 'p-1/a.jpg', media_uri: 'p-1/a.mp4' },
        { id: 2, project_id: 'p-1', photo_uri: 'p-1/b.jpg', media_uri: null },
      ],
      error: null,
    };
    const rows = await fetchEvidenceForReview();

    expect(calls.from).toEqual(['evidence']);
    expect(calls.order).toEqual(['timestamp', { ascending: false }]);
    expect(calls.eq).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].photo_uri).toBe('signed://p-1/a.jpg');
    expect(rows[0].media_uri).toBe('signed://p-1/a.mp4');
    // null media blijft null (passthrough in resolveStorageUrls-mock)
    expect(rows[1].media_uri).toBeNull();
  });

  it('filtert op project_id wanneer meegegeven', async () => {
    await fetchEvidenceForReview('p-9');
    expect(calls.eq[0]).toEqual(['project_id', 'p-9']);
  });

  it('geeft [] terug bij een fout', async () => {
    mockListResult = { data: null, error: { message: 'down' } };
    await expect(fetchEvidenceForReview()).resolves.toEqual([]);
  });
});

describe('updateEvidenceStatus', () => {
  it('POST naar de review-route met Bearer en JSON-body, true bij ok', async () => {
    const res = await updateEvidenceStatus(42, 'APPROVED', 'akkoord');
    expect(res).toBe(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('http://bk.test/api/review/evidence/42/status');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ status: 'APPROVED', notes: 'akkoord' });
  });

  it('zet notes op null wanneer niet meegegeven', async () => {
    await updateEvidenceStatus(7, 'NEEDS_REVIEW');
    const [, init] = mockFetch.mock.calls[0] as [string, any];
    expect(JSON.parse(init.body)).toEqual({ status: 'NEEDS_REVIEW', notes: null });
  });

  it('geeft false zonder actieve sessie en doet geen fetch', async () => {
    mockSession = { data: { session: null } };
    const res = await updateEvidenceStatus(1, 'REJECTED');
    expect(res).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('geeft false bij een !ok-response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'mag niet' }),
    });
    const res = await updateEvidenceStatus(1, 'APPROVED');
    expect(res).toBe(false);
  });
});
