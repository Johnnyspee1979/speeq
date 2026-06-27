/**
 * Unit-tests voor TenantFeaturesService — feature-toggles per klant (tenant),
 * met drie-laagse overerving (SPEE → KEYUSER → PROJECTLEIDER) en RLS in de DB.
 *
 * We mocken de Supabase-client en getActiveTenantId, en borgen:
 *   - getTenantFeatures start met FEATURE_META-defaults en legt DB-rijen daar
 *     overheen; onbekende feature_keys worden genegeerd; bij fout/geen tenant
 *     vallen we terug op de defaults;
 *   - setTenantFeature weigert zonder actieve tenant, en bouwt anders een
 *     upsert-payload (tenant_id, project_id null, set_by uit de auth-user,
 *     set_by_role) met ok/error-uitkomst op basis van de fout;
 *   - isFeatureEnabled leest één key uit de samengestelde set.
 */

let mockSelectResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockUpsertError: unknown = null;
const calls: Record<string, any> = {};

const builder: any = {
  select: (...a: unknown[]) => { calls.select = a; return builder; },
  eq: (...a: unknown[]) => { (calls.eq ||= []).push(a); return builder; },
  is: (...a: unknown[]) => { (calls.is ||= []).push(a); return Promise.resolve(mockSelectResult); },
  upsert: (p: unknown, opts: unknown) => {
    calls.upsert = p; calls.upsertOpts = opts;
    return Promise.resolve({ error: mockUpsertError });
  },
};

const mockGetUser = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ data: { user: { id: 'user-7' } } })
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => builder,
    auth: { getUser: () => mockGetUser() },
  },
}));

const mockGetActiveTenantId = jest.fn<string | null, []>(() => 't-1');
jest.mock('../../config/tenant', () => ({
  getActiveTenantId: () => mockGetActiveTenantId(),
}));

import {
  FEATURE_KEYS,
  FEATURE_META,
  getTenantFeatures,
  setTenantFeature,
  isFeatureEnabled,
} from '../TenantFeaturesService';

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectResult = { data: [], error: null };
  mockUpsertError = null;
  mockGetActiveTenantId.mockReturnValue('t-1');
  for (const k of Object.keys(calls)) delete calls[k];
});

describe('getTenantFeatures', () => {
  it('valt terug op FEATURE_META-defaults zonder actieve tenant', async () => {
    mockGetActiveTenantId.mockReturnValue(null);
    const res = await getTenantFeatures();
    expect(res.ai_review).toBe(true);
    expect(res.multilang).toBe(false);
    expect(res.simple_mode).toBe(false);
    // alle keys aanwezig
    expect(Object.keys(res).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it('legt DB-rijen over de defaults en negeert onbekende keys', async () => {
    mockSelectResult = {
      data: [
        { feature_key: 'multilang', enabled: true },   // default false → true
        { feature_key: 'ai_review', enabled: false },  // default true → false
        { feature_key: 'onbekend', enabled: true },    // genegeerd
      ],
      error: null,
    };
    const res = await getTenantFeatures('t-9');
    expect(res.multilang).toBe(true);
    expect(res.ai_review).toBe(false);
    expect((res as any).onbekend).toBeUndefined();
    // filtert op tenant-id en bedrijfsbreed (project_id NULL)
    expect(calls.eq[0]).toEqual(['tenant_id', 't-9']);
    expect(calls.is[0]).toEqual(['project_id', null]);
  });

  it('geeft de defaults bij een query-fout', async () => {
    mockSelectResult = { data: null, error: { message: 'rls' } };
    const res = await getTenantFeatures('t-1');
    expect(res.ai_review).toBe(FEATURE_META.ai_review.defaultOn);
    expect(res.voice_assistant).toBe(false);
  });
});

describe('setTenantFeature', () => {
  it('weigert zonder actieve tenant', async () => {
    mockGetActiveTenantId.mockReturnValue(null);
    const res = await setTenantFeature('pdf_export', false);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('tenant');
    expect(calls.upsert).toBeUndefined();
  });

  it('bouwt de upsert-payload met set_by uit de auth-user en geeft ok', async () => {
    const res = await setTenantFeature('voice_assistant', true, 'SPEE', 't-3');
    expect(res.ok).toBe(true);
    expect(calls.upsert).toMatchObject({
      tenant_id: 't-3',
      project_id: null,
      feature_key: 'voice_assistant',
      enabled: true,
      set_by: 'user-7',
      set_by_role: 'SPEE',
    });
    expect(calls.upsertOpts).toEqual({ onConflict: 'tenant_id,project_id,feature_key' });
  });

  it('geeft ok:false met message bij een upsert-fout', async () => {
    mockUpsertError = { message: 'denied' };
    const res = await setTenantFeature('qr_stickers', false);
    expect(res).toEqual({ ok: false, error: 'denied' });
  });
});

describe('isFeatureEnabled', () => {
  it('leest één key uit de samengestelde set', async () => {
    mockSelectResult = { data: [{ feature_key: 'simple_mode', enabled: true }], error: null };
    await expect(isFeatureEnabled('simple_mode', 't-1')).resolves.toBe(true);
    await expect(isFeatureEnabled('multilang', 't-1')).resolves.toBe(false);
  });
});
