/**
 * @jest-environment jsdom
 *
 * Unit-tests voor TenantBrandingService — klant-logo/-naam/-kleur per tenant,
 * met memory- + localStorage-cache en luisteraars.
 *
 * We mocken de Supabase-client (maybeSingle + upsert + auth.getUser) en de
 * OfflineBrandingCache (fire-and-forget), en borgen — met een verse module per
 * test (resetModules) zodat de module-cache niet lekt:
 *   - getBranding mapt de DB-rij naar camelCase en valt terug op leeg bij geen rij;
 *   - setBrandingFromMaster merget in de cache, notificeert luisteraars en
 *     schrijft naar localStorage;
 *   - getBrandingSync leest localStorage als de memory-cache leeg is;
 *   - setPrimaryColor valideert de hex (ongeldig → null) richting de upsert;
 *   - subscribeBranding levert een werkende unsubscribe.
 */

let mockBranding: { data: unknown; error: unknown } = { data: null, error: null };
let mockUpsertError: unknown = null;
const mockCalls: Record<string, any> = {};

const mockBuilder: any = {
  select: () => mockBuilder,
  eq: () => mockBuilder,
  maybeSingle: () => Promise.resolve(mockBranding),
  upsert: (p: unknown, o: unknown) => {
    mockCalls.upsert = p;
    mockCalls.upsertOpts = o;
    return Promise.resolve({ error: mockUpsertError });
  },
};

const mockGetUser = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ data: { user: { id: 'u1' } } }),
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => mockBuilder,
    auth: { getUser: () => mockGetUser() },
  },
}));

jest.mock('../OfflineBrandingCache', () => ({
  cacheBranding: (..._a: unknown[]) => Promise.resolve(),
}));

type Svc = typeof import('../TenantBrandingService');
async function loadFresh(): Promise<Svc> {
  let svc!: Svc;
  await jest.isolateModulesAsync(async () => {
    svc = await import('../TenantBrandingService');
  });
  return svc;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBranding = { data: null, error: null };
  mockUpsertError = null;
  for (const k of Object.keys(mockCalls)) delete mockCalls[k];
  window.localStorage.clear();
});

describe('getBranding', () => {
  it('mapt de DB-rij naar camelCase', async () => {
    mockBranding = {
      data: {
        company_name: 'Bouw BV',
        logo_url: 'https://x/logo.png',
        primary_color: '#112233',
        updated_at: '2026-01-15T09:30:00Z',
      },
      error: null,
    };
    const svc = await loadFresh();
    const b = await svc.getBranding();
    expect(b).toEqual({
      companyName: 'Bouw BV',
      logoUrl: 'https://x/logo.png',
      primaryColor: '#112233',
      updatedAt: '2026-01-15T09:30:00Z',
    });
  });

  it('valt terug op leeg bij geen rij', async () => {
    mockBranding = { data: null, error: { message: 'no row' } };
    const svc = await loadFresh();
    const b = await svc.getBranding();
    expect(b.companyName).toBeNull();
    expect(b.logoUrl).toBeNull();
  });
});

describe('setBrandingFromMaster', () => {
  it('merget, notificeert luisteraars en schrijft naar localStorage', async () => {
    const svc = await loadFresh();
    const seen: any[] = [];
    svc.subscribeBranding((b) => seen.push(b));

    svc.setBrandingFromMaster({ companyName: 'Spee Solutions', primaryColor: '#abcdef' });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ companyName: 'Spee Solutions', primaryColor: '#abcdef' });
    expect(seen[0].updatedAt).toEqual(expect.any(String));
    // localStorage gevuld
    const raw = window.localStorage.getItem('wkb_tenant_branding_v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).companyName).toBe('Spee Solutions');
  });
});

describe('getBrandingSync', () => {
  it('leest localStorage als de memory-cache leeg is', async () => {
    window.localStorage.setItem(
      'wkb_tenant_branding_v1',
      JSON.stringify({ companyName: 'Uit Cache', logoUrl: null, primaryColor: null, updatedAt: null }),
    );
    const svc = await loadFresh();
    expect(svc.getBrandingSync().companyName).toBe('Uit Cache');
  });

  it('geeft leeg terug zonder cache', async () => {
    const svc = await loadFresh();
    expect(svc.getBrandingSync().companyName).toBeNull();
  });
});

describe('setPrimaryColor', () => {
  it('stuurt een geldige hex door naar de upsert', async () => {
    const svc = await loadFresh();
    await svc.setPrimaryColor('#A1B2C3');
    expect(mockCalls.upsert).toMatchObject({ id: 1, primary_color: '#A1B2C3' });
    expect(mockCalls.upsertOpts).toEqual({ onConflict: 'id' });
  });

  it('zet een ongeldige hex op null', async () => {
    const svc = await loadFresh();
    await svc.setPrimaryColor('rood');
    expect(mockCalls.upsert).toMatchObject({ primary_color: null });
  });
});

describe('subscribeBranding', () => {
  it('stopt notificaties na unsubscribe', async () => {
    const svc = await loadFresh();
    const seen: any[] = [];
    const off = svc.subscribeBranding((b) => seen.push(b));
    svc.setBrandingFromMaster({ companyName: 'Een' });
    off();
    svc.setBrandingFromMaster({ companyName: 'Twee' });
    expect(seen).toHaveLength(1);
    expect(seen[0].companyName).toBe('Een');
  });
});
