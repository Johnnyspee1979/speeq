/**
 * Unit-tests voor OfflineBrandingCache — logo data-URL + 1u refresh policy.
 *
 * Gedekt:
 *   - cacheBranding zonder logo-URL → null logoDataUrl
 *   - cacheBranding met fetch-ok → dataURL opgeslagen
 *   - cacheBranding met logo > 500KB → null logoDataUrl + console.warn
 *   - cacheBranding met fetch-fail → null logoDataUrl
 *   - readCachedBranding round-trip
 *   - shouldRefresh: true bij geen cache, true bij > 1u, false bij vers
 *   - getCacheAgeMs: -1 zonder cache, ~0 direct na cache
 *   - clearCachedBranding
 */

const localforageStore = new Map<string, unknown>();
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    createInstance: () => ({
      getItem: (key: string) => Promise.resolve(localforageStore.get(key) ?? null),
      setItem: (key: string, val: unknown) => {
        localforageStore.set(key, val);
        return Promise.resolve(val);
      },
      removeItem: (key: string) => {
        localforageStore.delete(key);
        return Promise.resolve();
      },
    }),
  },
}));

// FileReader mock — leest blob → simulated dataURL
class MockFileReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: { size: number; type?: string }) {
    // Simuleer asynchrone read
    setTimeout(() => {
      this.result = `data:image/png;base64,MOCK_${blob.size}`;
      this.onloadend?.();
    }, 0);
  }
}
(globalThis as { FileReader: typeof MockFileReader }).FileReader = MockFileReader;

// fetch mock per test
const mockFetch = jest.fn();
(globalThis as { fetch: typeof mockFetch }).fetch = mockFetch;

import {
  cacheBranding,
  readCachedBranding,
  shouldRefresh,
  getCacheAgeMs,
  clearCachedBranding,
} from '../OfflineBrandingCache';

const STORAGE_KEY = 'speeq_offline_branding_cache';
const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  localforageStore.clear();
  mockFetch.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('cacheBranding — zonder logo', () => {
  it('schrijft companyName + primaryColor, logoDataUrl=null', async () => {
    await cacheBranding({
      companyName: 'Bouwbedrijf Jansen',
      logoUrl: null,
      primaryColor: '#1F4D3A',
    });

    const cached = await readCachedBranding();
    expect(cached).not.toBeNull();
    expect(cached?.companyName).toBe('Bouwbedrijf Jansen');
    expect(cached?.logoDataUrl).toBeNull();
    expect(cached?.primaryColor).toBe('#1F4D3A');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('cacheBranding — met logo-URL', () => {
  it('haalt logo binnen en slaat als dataURL op', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve({ size: 50_000 }),
    });

    await cacheBranding({
      companyName: 'X',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: null,
    });

    const cached = await readCachedBranding();
    expect(cached?.logoDataUrl).toMatch(/^data:image\/png;base64,MOCK_50000$/);
    expect(mockFetch).toHaveBeenCalledWith('https://cdn.example.com/logo.png');
  });

  it('weigert logo > 500KB en logt waarschuwing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve({ size: 600_000 }),
    });

    await cacheBranding({
      companyName: 'X',
      logoUrl: 'https://cdn.example.com/big.png',
      primaryColor: null,
    });

    const cached = await readCachedBranding();
    expect(cached?.logoDataUrl).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('valt veilig naar null bij fetch-fail', async () => {
    mockFetch.mockResolvedValue({ ok: false, blob: () => Promise.resolve({ size: 0 }) });

    await cacheBranding({
      companyName: 'X',
      logoUrl: 'https://cdn.example.com/404.png',
      primaryColor: null,
    });

    const cached = await readCachedBranding();
    expect(cached?.logoDataUrl).toBeNull();
  });

  it('valt veilig naar null bij fetch-throw', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    await cacheBranding({
      companyName: 'X',
      logoUrl: 'https://cdn.example.com/timeout.png',
      primaryColor: null,
    });

    const cached = await readCachedBranding();
    expect(cached?.logoDataUrl).toBeNull();
  });
});

describe('readCachedBranding', () => {
  it('null bij lege store', async () => {
    expect(await readCachedBranding()).toBeNull();
  });
});

describe('shouldRefresh — 1u policy', () => {
  it('true zonder cache', async () => {
    expect(await shouldRefresh()).toBe(true);
  });

  it('false direct na cache', async () => {
    await cacheBranding({ companyName: 'X', logoUrl: null, primaryColor: null });
    expect(await shouldRefresh()).toBe(false);
  });

  it('true bij cache > 1u', async () => {
    localforageStore.set(STORAGE_KEY, {
      companyName: 'X',
      logoDataUrl: null,
      primaryColor: null,
      syncedAt: Date.now() - 2 * HOUR_MS,
    });
    expect(await shouldRefresh()).toBe(true);
  });
});

describe('getCacheAgeMs', () => {
  it('-1 zonder cache', async () => {
    expect(await getCacheAgeMs()).toBe(-1);
  });

  it('~0 direct na cache', async () => {
    await cacheBranding({ companyName: 'X', logoUrl: null, primaryColor: null });
    const age = await getCacheAgeMs();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1000);
  });
});

describe('clearCachedBranding', () => {
  it('verwijdert de cache', async () => {
    await cacheBranding({ companyName: 'X', logoUrl: null, primaryColor: null });
    expect(await readCachedBranding()).not.toBeNull();
    await clearCachedBranding();
    expect(await readCachedBranding()).toBeNull();
  });
});
