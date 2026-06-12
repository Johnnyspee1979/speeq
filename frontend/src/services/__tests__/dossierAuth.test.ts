/**
 * Unit-tests voor dossierAuth — de auth-helper voor dossier-downloads.
 *
 * Borgt:
 *   - authHeader() geeft Bearer mee met sessie, gooit NL-fout zonder sessie;
 *   - openPdfInNewTab() haalt de PDF mét token op, opent de blob, geeft de
 *     blob-URL terug;
 *   - openPdfInNewTab() gooit een nette (server-)fout bij !ok zonder te openen.
 */

const mockGetSession = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

const { authHeader, openPdfInNewTab } = require('../dossierAuth');

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

const mockOpen = jest.fn();
const mockCreateObjectURL = jest.fn(() => 'blob:fake-url');
(globalThis as unknown as { window: unknown }).window = {
  open: mockOpen,
  URL: { createObjectURL: mockCreateObjectURL },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'tok-123' } },
  });
  mockFetch.mockReset();
  mockOpen.mockReset();
  mockCreateObjectURL.mockReset().mockReturnValue('blob:fake-url');
});

describe('authHeader', () => {
  it('geeft Bearer-header met geldige sessie', async () => {
    await expect(authHeader()).resolves.toEqual({ Authorization: 'Bearer tok-123' });
  });

  it('gooit een NL-fout zonder sessie', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(authHeader()).rejects.toThrow(/niet.*ingelogd/i);
  });
});

describe('openPdfInNewTab', () => {
  it('haalt de PDF mét token op, opent de blob en geeft de blob-URL terug', async () => {
    const fakeBlob = { type: 'application/pdf' };
    mockFetch.mockResolvedValue({ ok: true, blob: async () => fakeBlob });

    const url = await openPdfInNewTab('https://backend.example/api/wkb-dossier/consument/p1');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(fakeBlob);
    expect(mockOpen).toHaveBeenCalledWith('blob:fake-url', '_blank');
    expect(url).toBe('blob:fake-url');
  });

  it('gooit de server-foutmelding bij !ok en opent niets', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Dossier nog niet compleet.' }),
    });

    await expect(
      openPdfInNewTab('https://backend.example/api/wkb-dossier/consument/p1')
    ).rejects.toThrow('Dossier nog niet compleet.');
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
