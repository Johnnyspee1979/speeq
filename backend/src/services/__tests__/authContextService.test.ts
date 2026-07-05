/**
 * Unit-tests voor authContextService — de rol- en projecttoegang achter de
 * review-/export-acties (bevoegd gezag). Security-kritisch: hier wordt bepaald
 * wie een bewijsstatus mag beoordelen en bij welk project.
 *
 * Borgt:
 *   - parseBearerToken: alleen een echte "Bearer <token>" telt;
 *   - isReviewerRole: alleen AANNEMER/KWALITEITSBORGER (genormaliseerd);
 *   - createHttpError: zet statusCode + message;
 *   - getAuthenticatedUserContext: 401 zonder/ongeldig token, rol-normalisatie
 *     en de ONDERAANNEMER-default;
 *   - assertProjectReviewAccess: 400 zonder projectId, 403 voor niet-reviewers,
 *     KWALITEITSBORGER mag via borger- óf eigenaarschap, AANNEMER alleen als
 *     eigenaar, 403 zonder toegang.
 */

const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn((_table?: string) => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => mockMaybeSingle(),
  };
  return builder;
});

jest.mock('../supabaseAdmin', () => ({
  getSupabaseAdminClient: () => ({
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    from: (table: string) => mockFrom(table),
  }),
}));

const {
  parseBearerToken,
  isReviewerRole,
  createHttpError,
  getAuthenticatedUserContext,
  assertProjectReviewAccess,
} = require('../authContextService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseBearerToken', () => {
  it('geeft het token bij een geldige Bearer-header (scheme case-insensitief)', () => {
    expect(parseBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(parseBearerToken('bearer  xyz')).toBe('xyz');
  });

  it('geeft leeg bij ontbrekende of niet-Bearer-header', () => {
    expect(parseBearerToken(null)).toBe('');
    expect(parseBearerToken(undefined)).toBe('');
    expect(parseBearerToken('Basic abc')).toBe('');
  });
});

describe('isReviewerRole', () => {
  it('herkent reviewer-rollen genormaliseerd', () => {
    expect(isReviewerRole('aannemer')).toBe(true);
    expect(isReviewerRole(' KWALITEITSBORGER ')).toBe(true);
  });

  it('weigert niet-reviewer-rollen', () => {
    expect(isReviewerRole('ONDERAANNEMER')).toBe(false);
    expect(isReviewerRole(null)).toBe(false);
  });
});

describe('createHttpError', () => {
  it('zet statusCode en message', () => {
    const err = createHttpError(403, 'verboden');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('verboden');
  });
});

describe('getAuthenticatedUserContext', () => {
  it('gooit 401 zonder Bearer-token', async () => {
    await expect(getAuthenticatedUserContext(null)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('gooit 401 bij ongeldige sessie', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    await expect(getAuthenticatedUserContext('Bearer t')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('normaliseert de rol en vult het profiel aan', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'u@x.nl' } }, error: null });
    mockMaybeSingle.mockResolvedValue({
      data: { role: 'kwaliteitsborger', company_name: 'Borg BV', email: 'u@x.nl' },
      error: null,
    });
    const ctx = await getAuthenticatedUserContext('Bearer t');
    expect(ctx).toEqual({
      userId: 'u1',
      email: 'u@x.nl',
      role: 'KWALITEITSBORGER',
      companyName: 'Borg BV',
    });
  });

  it('valt terug op ONDERAANNEMER zonder profiel-rol', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2', email: 'a@b.nl' } }, error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const ctx = await getAuthenticatedUserContext('Bearer t');
    expect(ctx.role).toBe('ONDERAANNEMER');
  });
});

describe('assertProjectReviewAccess', () => {
  const reviewer = { userId: 'u1', email: '', role: 'KWALITEITSBORGER', companyName: '' };

  it('gooit 400 zonder projectId', async () => {
    await expect(assertProjectReviewAccess('  ', reviewer)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('gooit 403 voor een niet-reviewer-rol', async () => {
    const onder = { ...reviewer, role: 'ONDERAANNEMER' };
    await expect(assertProjectReviewAccess('p1', onder)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('KWALITEITSBORGER krijgt toegang via borger-koppeling', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { owner_id: 'andere', kwaliteitsborger_id: 'u1' }, error: null });
    await expect(assertProjectReviewAccess('p1', reviewer)).resolves.toEqual({
      isOwner: false,
      isQualityAssurer: true,
    });
  });

  it('AANNEMER krijgt alleen toegang als eigenaar', async () => {
    const aannemer = { ...reviewer, role: 'AANNEMER' };
    mockMaybeSingle.mockResolvedValue({ data: { owner_id: 'andere', kwaliteitsborger_id: 'u1' }, error: null });
    await expect(assertProjectReviewAccess('p1', aannemer)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('gooit 403 zonder enige koppeling', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { owner_id: 'x', kwaliteitsborger_id: 'y' }, error: null });
    await expect(assertProjectReviewAccess('p1', reviewer)).rejects.toMatchObject({ statusCode: 403 });
  });
});
