/**
 * @jest-environment jsdom
 *
 * Unit-tests voor OneDriveSyncService — borgingsbewijzen naar Microsoft OneDrive
 * via MSAL + Graph API. We draaien in jsdom (de module leest
 * `window.location.origin` op import-tijd voor de redirect-URI) en mocken
 * `@azure/msal-browser` (PublicClientApplication + auth-errors) en global.fetch.
 *
 * CLIENT_ID wordt op import-tijd uit env gelezen, dus laden we de module vers per
 * test (`isolateModulesAsync`) met env vooraf gezet. We borgen:
 *   - isOneDriveConfigured: lengte-drempel op de Client ID;
 *   - getOneDriveAccountName: null zonder config/accounts, anders de naam;
 *   - syncToOneDrive: notConfigured zonder Client ID, authFailed zonder token,
 *     de happy path (foto-download → Graph-upload telt als synced, met progress),
 *     skip bij een niet-ok foto-download, en de notitie-tak (.txt naar Graph).
 */

const mockInitialize = jest.fn(() => Promise.resolve());
const mockGetAllAccounts = jest.fn<unknown[], []>(() => []);
const mockAcquireTokenSilent = jest.fn<Promise<any>, unknown[]>();
const mockAcquireTokenPopup = jest.fn<Promise<any>, unknown[]>();
const mockLogoutPopup = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());

jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: class {
    constructor(_c: unknown) {}
    initialize() {
      return mockInitialize();
    }
    getAllAccounts() {
      return mockGetAllAccounts();
    }
    acquireTokenSilent(...a: unknown[]) {
      return mockAcquireTokenSilent(...a);
    }
    acquireTokenPopup(...a: unknown[]) {
      return mockAcquireTokenPopup(...a);
    }
    logoutPopup(...a: unknown[]) {
      return mockLogoutPopup(...a);
    }
  },
  InteractionRequiredAuthError: class extends Error {},
  BrowserAuthError: class extends Error {
    errorCode: string;
    constructor(code: string) {
      super(code);
      this.errorCode = code;
    }
  },
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

type Mod = typeof import('../OneDriveSyncService');
async function loadFresh(): Promise<Mod> {
  let m!: Mod;
  await jest.isolateModulesAsync(async () => {
    m = await import('../OneDriveSyncService');
  });
  return m;
}

const okResp = () => ({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
  json: () => Promise.resolve({}),
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'abcdef1234',
  inspection_point_id: 'kik-wapening-001',
  media_uri: null,
  photo_uri: 'https://cdn/x.jpg',
  timestamp: '2026-05-02T14:32:00.000Z',
  ai_status: null,
  ai_notes: null,
  field_note: null,
  latitude: null,
  longitude: null,
  ...over,
}) as Mod extends never ? never : any;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_AZURE_CLIENT_ID = 'azure-client-1234567890';
  mockInitialize.mockResolvedValue(undefined);
  mockGetAllAccounts.mockReturnValue([]);
  mockFetch.mockResolvedValue(okResp());
});

afterEach(() => jest.restoreAllMocks());

describe('isOneDriveConfigured', () => {
  it('true met een geldige Client ID', async () => {
    const m = await loadFresh();
    expect(m.isOneDriveConfigured()).toBe(true);
  });

  it('false zonder Client ID', async () => {
    delete process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
    const m = await loadFresh();
    expect(m.isOneDriveConfigured()).toBe(false);
  });
});

describe('getOneDriveAccountName', () => {
  it('null zonder config', async () => {
    delete process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
    const m = await loadFresh();
    await expect(m.getOneDriveAccountName()).resolves.toBeNull();
  });

  it('null zonder accounts', async () => {
    mockGetAllAccounts.mockReturnValue([]);
    const m = await loadFresh();
    await expect(m.getOneDriveAccountName()).resolves.toBeNull();
  });

  it('geeft de accountnaam terug', async () => {
    mockGetAllAccounts.mockReturnValue([{ name: 'Jan Bouwer', username: 'jan@x.nl' }]);
    const m = await loadFresh();
    await expect(m.getOneDriveAccountName()).resolves.toBe('Jan Bouwer');
  });
});

describe('syncToOneDrive', () => {
  it('notConfigured zonder Client ID (geen fetch)', async () => {
    delete process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
    const m = await loadFresh();
    const res = await m.syncToOneDrive('Project X', [row()]);
    expect(res).toEqual({ ok: false, synced: 0, skipped: 0, errors: [], notConfigured: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('authFailed wanneer geen token kan worden opgehaald', async () => {
    // accounts aanwezig → silent faalt; popup gooit → getAccessToken throwt → token null
    mockGetAllAccounts.mockReturnValue([{ name: 'Jan' }]);
    mockAcquireTokenSilent.mockRejectedValue(new Error('interactie nodig'));
    mockAcquireTokenPopup.mockRejectedValue(new Error('popup dicht'));
    const m = await loadFresh();
    const res = await m.syncToOneDrive('Project X', [row()]);
    expect(res).toMatchObject({ ok: false, authFailed: true, synced: 0 });
  });

  it('happy path: foto geupload telt als synced + progress', async () => {
    mockGetAllAccounts.mockReturnValue([{ name: 'Jan' }]);
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: 'tok-graph' });
    const onProgress = jest.fn();
    const m = await loadFresh();
    const res = await m.syncToOneDrive('Project X', [row()], onProgress);

    expect(res.ok).toBe(true);
    expect(res.synced).toBe(1);
    expect(res.skipped).toBe(0);
    expect(onProgress).toHaveBeenCalledWith(1, 1);

    // er is een Graph-upload naar een _foto_-pad gedaan, met Bearer-token
    const uploadCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('_foto_'),
    ) as [string, any] | undefined;
    expect(uploadCall).toBeDefined();
    expect(uploadCall![0]).toContain('graph.microsoft.com');
    expect(uploadCall![1].headers.Authorization).toBe('Bearer tok-graph');
  });

  it('skip wanneer de foto-download niet ok is', async () => {
    mockGetAllAccounts.mockReturnValue([{ name: 'Jan' }]);
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: false }); // foto-download faalt
    const m = await loadFresh();
    const res = await m.syncToOneDrive('Project X', [row()]);
    expect(res.synced).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it('schrijft een notitie-bestand wanneer er een veldnotitie is', async () => {
    mockGetAllAccounts.mockReturnValue([{ name: 'Jan' }]);
    mockAcquireTokenSilent.mockResolvedValue({ accessToken: 'tok' });
    const m = await loadFresh();
    await m.syncToOneDrive('Project X', [
      row({ photo_uri: null, media_uri: null, field_note: 'Wapening gecontroleerd' }),
    ]);
    const noteCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('_notitie_'),
    );
    expect(noteCall).toBeDefined();
  });
});
