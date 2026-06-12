/**
 * Tests voor de requireAuth-middleware — de poortwachter van de backend.
 *
 * Kern-garantie (security): zonder geldige Supabase-config is auth FAIL-CLOSED.
 * Vroeger werd auth stil overgeslagen met een mock-gebruiker; dat is een gat.
 * Nu mag overslaan alléén als ALLOW_AUTH_BYPASS expliciet aanstaat (lokale dev).
 *
 * We borgen:
 *   - geen config + geen bypass-vlag → 503, geen req.user, next() niet aangeroepen
 *   - geen config + bypass-vlag aan  → next() met dev-gebruiker
 *   - met config, geen Bearer-header → 401
 *   - met config, ongeldig token     → 401
 *   - met config, geldig token       → next() met de echte user
 */

let mockConfig: any;
const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (...a: any[]) => mockGetUser(...a) } }),
}));
jest.mock('../../config', () => ({
  get backendConfig() {
    return mockConfig;
  },
}));

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('requireAuth', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetUser.mockReset();
    mockConfig = {
      supabaseUrl: 'https://x.supabase.co',
      supabaseServiceKey: 'service-key',
      allowAuthBypass: false,
    };
  });

  it('weigert met 503 als Supabase niet geconfigureerd is en bypass uit staat', async () => {
    mockConfig = { supabaseUrl: '', supabaseServiceKey: '', allowAuthBypass: false };
    const { requireAuth } = require('../auth');
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('laat door met dev-gebruiker als bypass expliciet aanstaat', async () => {
    mockConfig = { supabaseUrl: '', supabaseServiceKey: '', allowAuthBypass: true };
    const { requireAuth } = require('../auth');
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ role: 'KWALITEITSBORGER' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('weigert met 401 zonder Bearer-header (config aanwezig)', async () => {
    const { requireAuth } = require('../auth');
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('weigert met 401 bij een ongeldig token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const { requireAuth } = require('../auth');
    const req: any = { headers: { authorization: 'Bearer slecht' } };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('laat door met de echte user bij een geldig token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const { requireAuth } = require('../auth');
    const req: any = { headers: { authorization: 'Bearer goed' } };
    const res = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'u1' });
  });
});
