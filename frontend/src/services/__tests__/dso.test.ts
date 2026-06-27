/**
 * Unit-tests voor de DSO/STAM-client (services/dso.ts).
 *
 * Borgt de auth-hardening: deze meldingen gaan naar bevoegd gezag en de
 * backend-routes vereisen nu een token. We controleren dat de client:
 *   - de Supabase-JWT als Bearer-header meestuurt bij elke call;
 *   - weigert (duidelijke NL-fout) als er geen sessie is, ZONDER te fetchen.
 *
 * Mock-stijl volgt useVoicePlayback.test.ts: getSession + global fetch gemockt.
 */

jest.mock('../../config/app', () => ({
  BACKEND_URL: 'https://backend.example',
}));

const mockGetSession = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

const mockGetActiveTenantId = jest.fn();
jest.mock('../../config/tenant', () => ({
  getActiveTenantId: () => mockGetActiveTenantId(),
}));

const {
  submitStam,
  fetchStamStatus,
  submitBouwmelding,
  submitGereedmelding,
} = require('../dso');

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

const okJson = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'tok-123' } },
  });
  mockGetActiveTenantId.mockReset().mockReturnValue('bouwgroep-bv');
  mockFetch.mockReset().mockResolvedValue(okJson({ success: true, status: 'QUEUED' }));
});

describe('dso-client — auth-header', () => {
  it('submitStam stuurt Bearer-token + Content-Type mee', async () => {
    await submitStam({ foo: 'bar' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://backend.example/api/dso/stam/submit');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('fetchStamStatus stuurt Bearer-token mee', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, status: 'ACCEPTED' }));
    await fetchStamStatus('ref-1');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://backend.example/api/dso/stam/status/ref-1');
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
  });

  it('submitBouwmelding stuurt Bearer-token mee', async () => {
    await submitBouwmelding({ projectData: {} });
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });

  it('submitGereedmelding stuurt Bearer-token mee', async () => {
    await submitGereedmelding({ projectData: {} });
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });
});

describe('dso-client — x-company-id (betaalmuur)', () => {
  it('stuurt de tenant-slug mee als x-company-id', async () => {
    await submitStam({ foo: 'bar' });
    expect(mockFetch.mock.calls[0][1].headers['x-company-id']).toBe('bouwgroep-bv');
  });

  it('laat x-company-id weg als er geen actieve tenant is', async () => {
    mockGetActiveTenantId.mockReturnValue(null);
    await submitStam({ foo: 'bar' });
    expect(mockFetch.mock.calls[0][1].headers['x-company-id']).toBeUndefined();
  });
});

describe('dso-client — geen sessie', () => {
  it('weigert zonder te fetchen en geeft een NL-fout', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(submitStam({})).rejects.toThrow(/niet.*ingelogd/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
