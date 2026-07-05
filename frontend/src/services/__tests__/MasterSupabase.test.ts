/**
 * Unit-tests voor MasterSupabase — de vaste (gememoïseerde) client naar het
 * master-Supabase-project waar de `tenants`-registry leeft.
 *
 * We mocken `@supabase/supabase-js` (createClient) en laden de module vers per
 * test (`isolateModulesAsync`) zodat de module-level singleton niet lekt en we
 * env-overrides kunnen testen. We borgen:
 *   - masterSupabase() maakt de client één keer en hergebruikt 'm daarna;
 *   - de auth-opties kloppen (persistSession/autoRefresh/detectSessionInUrl +
 *     de eigen storageKey 'speeq_maker_auth') en de default-URL wordt gebruikt;
 *   - EXPO_PUBLIC_MASTER_SUPABASE_URL/ANON overschrijven de defaults.
 */

const mockCreateClient = jest.fn((..._a: unknown[]) => ({ __id: Math.random() }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...a: unknown[]) => mockCreateClient(...a),
}));

type Mod = typeof import('../MasterSupabase');
async function loadFresh(): Promise<Mod> {
  let m!: Mod;
  await jest.isolateModulesAsync(async () => {
    m = await import('../MasterSupabase');
  });
  return m;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_MASTER_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_MASTER_SUPABASE_ANON_KEY;
});

describe('masterSupabase', () => {
  it('maakt de client één keer en hergebruikt de singleton', async () => {
    const m = await loadFresh();
    const a = m.masterSupabase();
    const b = m.masterSupabase();
    expect(a).toBe(b);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('gebruikt de default-URL en de eigen auth-opties', async () => {
    const m = await loadFresh();
    m.masterSupabase();
    const [url, anon, opts] = mockCreateClient.mock.calls[0] as [string, string, any];
    expect(url).toBe('https://kgiuavfvhtdgwuygbyzo.supabase.co');
    expect(typeof anon).toBe('string');
    expect(anon.length).toBeGreaterThan(0);
    expect(opts.auth).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'speeq_maker_auth',
    });
  });

  it('respecteert env-overrides voor URL en anon-key', async () => {
    process.env.EXPO_PUBLIC_MASTER_SUPABASE_URL = 'https://custom.supabase.co';
    process.env.EXPO_PUBLIC_MASTER_SUPABASE_ANON_KEY = 'custom-anon';
    const m = await loadFresh();
    m.masterSupabase();
    const [url, anon] = mockCreateClient.mock.calls[0] as [string, string, any];
    expect(url).toBe('https://custom.supabase.co');
    expect(anon).toBe('custom-anon');
  });
});
