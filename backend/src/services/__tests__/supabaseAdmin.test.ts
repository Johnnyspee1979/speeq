/**
 * Unit-tests voor supabaseAdmin — de service-role-client achter alle admin-
 * queries (auth-context, tenant-resolutie, review). Twee dingen moeten geborgd:
 *   - fail-closed: zonder Supabase-config gooit getSupabaseAdminClient i.p.v.
 *     een half-geconfigureerde client terug te geven;
 *   - memoisatie: de client wordt eenmalig opgebouwd en hergebruikt (één
 *     connectie-pool, geen nieuwe client per call).
 *
 * jest.resetModules per test zodat de module-level singleton telkens vers is.
 */

const mockCreateClient = jest.fn((..._a: unknown[]) => ({ id: 'supabase-client' }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...a: unknown[]) => mockCreateClient(...a),
}));

const mockHasConfig = jest.fn();
const mockConfig = { supabaseUrl: 'https://db.supabase.co', supabaseServiceKey: 'svc_key' };
jest.mock('../../config', () => ({
  backendConfig: mockConfig,
  hasSupabaseConfig: () => mockHasConfig(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockHasConfig.mockReturnValue(true);
  mockConfig.supabaseUrl = 'https://db.supabase.co';
  mockConfig.supabaseServiceKey = 'svc_key';
});

describe('getSupabaseAdminClient', () => {
  it('gooit (fail-closed) zonder Supabase-config en bouwt geen client', () => {
    mockHasConfig.mockReturnValue(false);
    const { getSupabaseAdminClient } = require('../supabaseAdmin');
    expect(() => getSupabaseAdminClient()).toThrow(/Supabase configuratie ontbreekt/);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('bouwt de client met url + service-key', () => {
    const { getSupabaseAdminClient } = require('../supabaseAdmin');
    const client = getSupabaseAdminClient();
    expect(client).toEqual({ id: 'supabase-client' });
    expect(mockCreateClient).toHaveBeenCalledWith('https://db.supabase.co', 'svc_key');
  });

  it('memoiseert: één client over meerdere calls', () => {
    const { getSupabaseAdminClient } = require('../supabaseAdmin');
    const a = getSupabaseAdminClient();
    const b = getSupabaseAdminClient();
    expect(a).toBe(b);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});
