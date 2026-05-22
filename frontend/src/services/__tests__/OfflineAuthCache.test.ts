/**
 * Unit-tests voor OfflineAuthCache — 30-dagen offline-grace policy.
 *
 * Gedekt:
 *   - cacheSession → readCachedSession round-trip
 *   - readCachedSession: null bij geen cache
 *   - readCachedSession: null + auto-clear bij cache ouder dan 30 dagen
 *   - getGraceRemainingMs: -1 geen cache, ~30d bij verse, ~0 bij oude
 *   - clearCachedSession: maakt cache leeg
 *   - getGraceExpiryIso: ISO 30d na cachedAt
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

import {
  cacheSession,
  readCachedSession,
  getGraceRemainingMs,
  clearCachedSession,
  getGraceExpiryIso,
} from '../OfflineAuthCache';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'speeq_offline_auth_cache';

function makeSessionInput(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: 'jwt.access.token',
    refreshToken: 'jwt.refresh.token',
    expiresAt: Date.now() + 60 * 60 * 1000,
    userId: 'user-1',
    email: 'jan@example.com',
    ...overrides,
  };
}

beforeEach(() => {
  localforageStore.clear();
});

describe('OfflineAuthCache — round-trip', () => {
  it('cacheSession + readCachedSession geeft alle velden terug', async () => {
    await cacheSession(makeSessionInput());

    const read = await readCachedSession();
    expect(read).not.toBeNull();
    expect(read?.accessToken).toBe('jwt.access.token');
    expect(read?.refreshToken).toBe('jwt.refresh.token');
    expect(read?.userId).toBe('user-1');
    expect(read?.email).toBe('jan@example.com');
    expect(typeof read?.cachedAt).toBe('number');
  });

  it('readCachedSession is null bij lege store', async () => {
    expect(await readCachedSession()).toBeNull();
  });
});

describe('OfflineAuthCache — 30-dagen grace', () => {
  it('clear cache + null bij ouder dan 30 dagen', async () => {
    // Schrijf met oude cachedAt — direct in store i.p.v. via cacheSession
    localforageStore.set(STORAGE_KEY, {
      accessToken: 'old',
      refreshToken: 'old',
      expiresAt: Date.now() + 1000,
      cachedAt: Date.now() - 31 * DAY_MS,
      userId: 'user-1',
      email: null,
    });

    const read = await readCachedSession();
    expect(read).toBeNull();
    // Auto-clear: localforage entry moet weg zijn
    expect(localforageStore.has(STORAGE_KEY)).toBe(false);
  });

  it('houdt cache bij exact 29 dagen oud', async () => {
    localforageStore.set(STORAGE_KEY, {
      accessToken: 'ok',
      refreshToken: 'ok',
      expiresAt: Date.now(),
      cachedAt: Date.now() - 29 * DAY_MS,
      userId: 'user-1',
      email: null,
    });

    const read = await readCachedSession();
    expect(read).not.toBeNull();
  });
});

describe('getGraceRemainingMs', () => {
  it('-1 zonder cache', async () => {
    expect(await getGraceRemainingMs()).toBe(-1);
  });

  it('~30 dagen direct na cacheSession', async () => {
    await cacheSession(makeSessionInput());
    const remaining = await getGraceRemainingMs();
    // Speling: tussen 29.9 en 30 dagen
    expect(remaining).toBeGreaterThan(29 * DAY_MS);
    expect(remaining).toBeLessThanOrEqual(30 * DAY_MS);
  });

  it('0 bij overschreden grace (geen negatief)', async () => {
    localforageStore.set(STORAGE_KEY, {
      accessToken: 'old',
      refreshToken: 'old',
      expiresAt: 0,
      cachedAt: Date.now() - 60 * DAY_MS,
      userId: 'u',
      email: null,
    });
    expect(await getGraceRemainingMs()).toBe(0);
  });
});

describe('clearCachedSession', () => {
  it('verwijdert de cache', async () => {
    await cacheSession(makeSessionInput());
    expect(await readCachedSession()).not.toBeNull();
    await clearCachedSession();
    expect(await readCachedSession()).toBeNull();
  });
});

describe('getGraceExpiryIso', () => {
  it('ISO ~30 dagen na cachedAt', async () => {
    const before = Date.now();
    await cacheSession(makeSessionInput());
    const iso = await getGraceExpiryIso();
    expect(iso).not.toBeNull();

    const expiry = new Date(iso!).getTime();
    expect(expiry).toBeGreaterThan(before + 29 * DAY_MS);
    expect(expiry).toBeLessThanOrEqual(before + 30 * DAY_MS + 1000);
  });

  it('null zonder cache', async () => {
    expect(await getGraceExpiryIso()).toBeNull();
  });
});
