/**
 * @jest-environment jsdom
 *
 * Gedrag-tests voor de tenant-config-resolutie (config/tenant.ts). Deze module
 * bepaalt wélke Supabase-tenant de app gebruikt; een fout in de voorrangsorde
 * laat de app op de verkeerde (of geen) tenant filteren. We borgen de drie-traps-
 * resolutie en de synchrone lookups:
 *  - getTenantConfig: in-memory cache → opgeslagen (localforage) → env-fallback
 *    (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY) → null;
 *  - setTenantConfig vult cache + persistentie; clearTenantConfig wist beide;
 *  - hasTenantConfig spiegelt de cache-staat;
 *  - getActiveTenantId: companyId (≠ 'env') → localStorage 'wkb_active_tenant_id'
 *    → null.
 *
 * localforage is gemockt met een in-memory store; jsdom levert window.localStorage.
 */

import localforage from 'localforage';
import {
  setTenantConfig,
  getTenantConfig,
  clearTenantConfig,
  hasTenantConfig,
  getActiveTenantId,
  type TenantConfig,
} from '../tenant';

jest.mock('localforage', () => {
  const store = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (k: string, v: unknown) => {
        store.set(k, v);
        return v;
      }),
      getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
    },
  };
});

const TENANT_KEY = 'speeq_tenant_config';
const ACTIVE_ID_KEY = 'wkb_active_tenant_id';

const sample: TenantConfig = {
  companyId: 'acme-bv',
  supabaseUrl: 'https://acme.supabase.co',
  supabaseAnonKey: 'anon-123',
};

beforeEach(async () => {
  await clearTenantConfig();
  window.localStorage.clear();
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  jest.clearAllMocks();
});

describe('setTenantConfig / hasTenantConfig', () => {
  it('vult de cache en persisteert via localforage', async () => {
    expect(hasTenantConfig()).toBe(false);
    await setTenantConfig(sample);
    expect(hasTenantConfig()).toBe(true);
    expect(localforage.setItem).toHaveBeenCalledWith(TENANT_KEY, sample);
  });
});

describe('getTenantConfig (drie-traps-resolutie)', () => {
  it('1) geeft de in-memory cache terug zonder localforage te raadplegen', async () => {
    await setTenantConfig(sample);
    (localforage.getItem as jest.Mock).mockClear();
    const result = await getTenantConfig();
    expect(result).toEqual(sample);
    expect(localforage.getItem).not.toHaveBeenCalled();
  });

  it('2) valt terug op de opgeslagen config en cachet die', async () => {
    // Geen cache (na clear), maar wel een opgeslagen waarde.
    await localforage.setItem(TENANT_KEY, sample);
    const result = await getTenantConfig();
    expect(result).toEqual(sample);
    expect(hasTenantConfig()).toBe(true); // nu gecachet
  });

  it('3) valt terug op env-vars wanneer cache en opslag leeg zijn', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-key';
    const result = await getTenantConfig();
    expect(result).toEqual({
      companyId: 'env',
      supabaseUrl: 'https://env.supabase.co',
      supabaseAnonKey: 'env-key',
    });
    // env-fallback cachet niet → hasTenantConfig blijft false
    expect(hasTenantConfig()).toBe(false);
  });

  it('geeft null wanneer er niets is', async () => {
    expect(await getTenantConfig()).toBeNull();
  });
});

describe('clearTenantConfig', () => {
  it('wist cache en opslag', async () => {
    await setTenantConfig(sample);
    expect(hasTenantConfig()).toBe(true);
    await clearTenantConfig();
    expect(hasTenantConfig()).toBe(false);
    expect(localforage.removeItem).toHaveBeenCalledWith(TENANT_KEY);
    expect(await getTenantConfig()).toBeNull();
  });
});

describe('getActiveTenantId (voorrangsorde)', () => {
  it('geeft companyId uit de cache wanneer die niet "env" is', async () => {
    await setTenantConfig(sample);
    expect(getActiveTenantId()).toBe('acme-bv');
  });

  it('negeert companyId "env" en valt terug op localStorage', async () => {
    await setTenantConfig({ ...sample, companyId: 'env' });
    window.localStorage.setItem(ACTIVE_ID_KEY, 'slug-tenant');
    expect(getActiveTenantId()).toBe('slug-tenant');
  });

  it('leest localStorage wanneer er geen cache is', () => {
    window.localStorage.setItem(ACTIVE_ID_KEY, 'ls-tenant');
    expect(getActiveTenantId()).toBe('ls-tenant');
  });

  it('geeft null wanneer noch cache noch localStorage een id heeft', () => {
    expect(getActiveTenantId()).toBeNull();
  });
});
