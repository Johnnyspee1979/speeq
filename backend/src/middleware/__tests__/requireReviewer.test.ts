/**
 * Tests voor de requireReviewer-middleware — de rol-gate boven requireAuth.
 *
 * Security-garantie: alleen reviewers (AANNEMER, KWALITEITSBORGER) mogen
 * dossiers exporteren of DSO/STAM-meldingen versturen. Niet-reviewers krijgen
 * 403 met een nette NL-melding.
 *
 * We borgen:
 *   - req.user.role al gezet als reviewer (dev-bypass) → next(), géén DB-lookup
 *   - req.user.role al gezet als niet-reviewer → 403
 *   - geen rol op req.user → rol uit profiel: reviewer → next(); anders 403
 *   - fout uit getAuthenticatedUserContext (bv. 401) → die status terug
 */

const mockGetContext = jest.fn();
jest.mock('../../services/authContextService', () => ({
  getAuthenticatedUserContext: (...a: any[]) => mockGetContext(...a),
  isReviewerRole: (role?: string | null) =>
    ['AANNEMER', 'KWALITEITSBORGER'].includes(String(role ?? '').trim().toUpperCase()),
}));

const { requireReviewer } = require('../requireReviewer');

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  mockGetContext.mockReset();
});

describe('requireReviewer', () => {
  it('laat een reeds-bekende reviewer door zonder DB-lookup (bypass)', async () => {
    const req: any = { headers: {}, user: { role: 'KWALITEITSBORGER' } };
    const res = makeRes();
    const next = jest.fn();

    await requireReviewer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockGetContext).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('weigert een reeds-bekende niet-reviewer met 403', async () => {
    const req: any = { headers: {}, user: { role: 'ONDERAANNEMER' } };
    const res = makeRes();
    const next = jest.fn();

    await requireReviewer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(mockGetContext).not.toHaveBeenCalled();
  });

  it('haalt de rol uit het profiel en laat een AANNEMER door', async () => {
    mockGetContext.mockResolvedValue({
      userId: 'u1',
      email: 'a@b.nl',
      role: 'AANNEMER',
      companyName: 'Bouw BV',
    });
    const req: any = { headers: { authorization: 'Bearer goed' } };
    const res = makeRes();
    const next = jest.fn();

    await requireReviewer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'u1', role: 'AANNEMER' });
  });

  it('weigert met 403 als de profielrol geen reviewer is', async () => {
    mockGetContext.mockResolvedValue({
      userId: 'u2',
      email: 'v@b.nl',
      role: 'VAKMAN',
      companyName: '',
    });
    const req: any = { headers: { authorization: 'Bearer goed' } };
    const res = makeRes();
    const next = jest.fn();

    await requireReviewer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('geeft de fout-status door uit getAuthenticatedUserContext (401)', async () => {
    mockGetContext.mockRejectedValue(
      Object.assign(new Error('Ongeldige of verlopen sessie.'), { statusCode: 401 })
    );
    const req: any = { headers: { authorization: 'Bearer slecht' } };
    const res = makeRes();
    const next = jest.fn();

    await requireReviewer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
