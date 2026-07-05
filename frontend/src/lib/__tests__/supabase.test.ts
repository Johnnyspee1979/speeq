/**
 * @jest-environment node
 *
 * Gedrag-tests voor de Supabase-client-initialisatie (lib/supabase.ts). Deze module
 * levert één gedeelde client: expliciet via initSupabase(url, key), of lui via een
 * Proxy die bij eerste property-toegang terugvalt op env-vars (en daarna op
 * ingebakken fallback-URL/anon-key). Een fout hier laat de app naar de verkeerde
 * Supabase-omgeving praten of bij elke call opnieuw een client opbouwen. We borgen:
 *  - isSupabaseConfigured() is false vóór gebruik en true ná init/proxy-toegang;
 *  - initSupabase geeft de juiste auth-opties door aan createClient;
 *  - de Proxy initialiseert lui: env-waarden hebben voorrang, anders de fallback;
 *  - de Proxy bouwt de client maar één keer (gecachet) en delegeert props door;
 *  - BACKEND_URL wordt doorgegeven.
 *
 * @supabase/supabase-js, de url-polyfill en config/app zijn gemockt → geen netwerk/
 * RN nodig → @jest-environment node. Het module-singleton wordt per test ververst
 * via jest.isolateModules (geen React → veilig).
 */

const mockCreateClient = jest.fn((url: string, key: string, opts: unknown) => ({
  __client: true,
  url,
  key,
  opts,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: [string, string, unknown]) => mockCreateClient(...args),
}));
jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });
jest.mock('../../config/app', () => ({ BACKEND_URL: 'http://test-backend' }));

type SupabaseModule = typeof import('../supabase');

const load = (): SupabaseModule => {
  let mod: SupabaseModule | undefined;
  jest.isolateModules(() => {
    mod = require('../supabase') as SupabaseModule;
  });
  return mod!;
};

const ENV_URL = 'EXPO_PUBLIC_SUPABASE_URL';
const ENV_KEY = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
let snapUrl: string | undefined;
let snapKey: string | undefined;

beforeAll(() => {
  snapUrl = process.env[ENV_URL];
  snapKey = process.env[ENV_KEY];
});

afterAll(() => {
  if (snapUrl === undefined) delete process.env[ENV_URL]; else process.env[ENV_URL] = snapUrl;
  if (snapKey === undefined) delete process.env[ENV_KEY]; else process.env[ENV_KEY] = snapKey;
});

beforeEach(() => {
  mockCreateClient.mockClear();
  delete process.env[ENV_URL];
  delete process.env[ENV_KEY];
});

describe('isSupabaseConfigured / initSupabase', () => {
  it('is false zolang er nog geen client is opgebouwd', () => {
    const m = load();
    expect(m.isSupabaseConfigured()).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('bouwt via initSupabase een client met de juiste auth-opties', () => {
    const m = load();
    const inst = m.initSupabase('https://expliciet', 'sleutel123');
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://expliciet',
      'sleutel123',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }),
      }),
    );
    expect(inst).toMatchObject({ __client: true, url: 'https://expliciet' });
    expect(m.isSupabaseConfigured()).toBe(true);
  });
});

describe('lui Proxy', () => {
  it('gebruikt env-waarden wanneer aanwezig', () => {
    process.env[ENV_URL] = 'https://env-url';
    process.env[ENV_KEY] = 'env-key';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const m = load();
    void (m.supabase as unknown as { auth: unknown }).auth;
    expect(mockCreateClient).toHaveBeenCalledWith('https://env-url', 'env-key', expect.anything());
    expect(m.isSupabaseConfigured()).toBe(true);
    warn.mockRestore();
  });

  it('valt terug op de ingebakken URL/anon-key zonder env, met waarschuwing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const m = load();
    void (m.supabase as unknown as { from: unknown }).from;
    const [url, key] = mockCreateClient.mock.calls[0];
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(20);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('bouwt de client maar één keer en delegeert props door', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const m = load();
    const proxy = m.supabase as unknown as { __client: boolean; auth: unknown; from: unknown };
    expect(proxy.__client).toBe(true);
    void proxy.auth;
    void proxy.from;
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('re-exports', () => {
  it('geeft BACKEND_URL door', () => {
    expect(load().BACKEND_URL).toBe('http://test-backend');
  });
});
