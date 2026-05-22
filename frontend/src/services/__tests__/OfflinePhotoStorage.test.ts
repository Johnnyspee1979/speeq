/**
 * Unit-tests voor de WEB-variant van OfflinePhotoStorage.
 *
 * De native-variant gebruikt expo-file-system — niet testbaar via jest
 * zonder een hele native-shim. Web is de hoofd-target voor de huidige
 * launch (PWA), dus daar focussen we.
 *
 * Gedekt:
 *   - savePhoto met data-URI → blob in localforage + object-URL
 *   - savePhoto met http-URL → fetch → blob
 *   - savePhoto met http fail → throw
 *   - savePhoto met Blob direct → geen fetch
 *   - savePhoto met pure base64 zonder data-prefix → jpeg fallback
 *   - loadPhoto: cache-hit en cache-miss
 *   - removePhoto: revokeObjectURL + localforage.removeItem
 *   - getPhotoSize
 *   - clearAll
 */

// ─── localforage in-memory mock ─────────────────────────────────────────────

const lfStore = new Map<string, unknown>();
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    createInstance: () => ({
      getItem: (key: string) => Promise.resolve(lfStore.get(key) ?? null),
      setItem: (key: string, val: unknown) => {
        lfStore.set(key, val);
        return Promise.resolve(val);
      },
      removeItem: (key: string) => {
        lfStore.delete(key);
        return Promise.resolve();
      },
      clear: () => {
        lfStore.clear();
        return Promise.resolve();
      },
    }),
  },
}));

// ─── Platform = web ─────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// ─── URL.createObjectURL / revokeObjectURL stub ─────────────────────────────

const createdUrls: string[] = [];
const revokedUrls: string[] = [];
let urlCounter = 0;
const urlMock = {
  createObjectURL: jest.fn((blob: Blob) => {
    const url = `blob:mock://obj-${++urlCounter}-size-${blob.size}`;
    createdUrls.push(url);
    return url;
  }),
  revokeObjectURL: jest.fn((url: string) => {
    revokedUrls.push(url);
  }),
};
(globalThis as unknown as { URL: typeof urlMock }).URL = urlMock;

// ─── fetch mock ──────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

// atob fallback voor Node-test-env
if (!globalThis.atob) {
  (globalThis as unknown as { atob: (s: string) => string }).atob = (s) =>
    Buffer.from(s, 'base64').toString('binary');
}

import { getOfflinePhotoStorage } from '../OfflinePhotoStorage';

// ─── Fixtures ──────────────────────────────────────────────────────────────

// 4-byte data-URI (kleinste mogelijk)
const TINY_DATA_URI = 'data:image/jpeg;base64,/9j/4AAQ';

function blobFor(size: number, type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

beforeEach(() => {
  lfStore.clear();
  createdUrls.length = 0;
  revokedUrls.length = 0;
  urlCounter = 0;
  mockFetch.mockReset();
});

// ─── savePhoto — input variants ─────────────────────────────────────────────

describe('OfflinePhotoStorage.savePhoto', () => {
  it('data-URI → blob in localforage + object-URL terug', async () => {
    const store = await getOfflinePhotoStorage();
    const url = await store.savePhoto('uuid-1', TINY_DATA_URI);

    expect(url).toMatch(/^blob:mock:/);
    expect(lfStore.has('uuid-1')).toBe(true);
    expect((lfStore.get('uuid-1') as Blob).size).toBeGreaterThan(0);
  });

  it('http-URL → fetch + blob', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blobFor(1024)),
    });

    const store = await getOfflinePhotoStorage();
    const url = await store.savePhoto('uuid-2', 'https://example.com/img.jpg');

    expect(url).toMatch(/blob:mock/);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/img.jpg');
    expect((lfStore.get('uuid-2') as Blob).size).toBe(1024);
  });

  it('http-fail → throw', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const store = await getOfflinePhotoStorage();
    await expect(
      store.savePhoto('uuid-3', 'https://example.com/dead.jpg'),
    ).rejects.toThrow(/Photo fetch/);
  });

  it('Blob direct → geen fetch', async () => {
    const store = await getOfflinePhotoStorage();
    const blob = blobFor(512, 'image/png');

    await store.savePhoto('uuid-4', blob);

    expect(mockFetch).not.toHaveBeenCalled();
    expect((lfStore.get('uuid-4') as Blob).size).toBe(512);
  });

  it('pure base64 zonder prefix → jpeg fallback', async () => {
    const store = await getOfflinePhotoStorage();
    // 12 chars base64 = 9 bytes binary
    await store.savePhoto('uuid-5', 'AAAAAAAAAAAA');

    const stored = lfStore.get('uuid-5') as Blob;
    expect(stored.size).toBe(9);
    expect(stored.type).toBe('image/jpeg');
  });

  it('opslaan over bestaande UUID revokes oude object-URL', async () => {
    const store = await getOfflinePhotoStorage();
    await store.savePhoto('uuid-6', TINY_DATA_URI);
    const firstUrl = createdUrls[createdUrls.length - 1];

    await store.savePhoto('uuid-6', TINY_DATA_URI);

    expect(revokedUrls).toContain(firstUrl);
  });
});

// ─── loadPhoto ──────────────────────────────────────────────────────────────

describe('OfflinePhotoStorage.loadPhoto', () => {
  it('cache-hit hergebruikt object-URL', async () => {
    const store = await getOfflinePhotoStorage();
    const saved = await store.savePhoto('uuid-load-1', TINY_DATA_URI);
    const loaded = await store.loadPhoto('uuid-load-1');

    expect(loaded).toBe(saved);
    // createObjectURL alleen aangeroepen bij save, niet opnieuw bij load
    expect(urlMock.createObjectURL.mock.calls.length).toBe(1);
  });

  it('cache-miss → leest blob uit store + maakt URL', async () => {
    // Direct in store zonder save (simuleert na reload van app)
    lfStore.set('uuid-load-2', blobFor(256));

    const store = await getOfflinePhotoStorage();
    const loaded = await store.loadPhoto('uuid-load-2');

    expect(loaded).toMatch(/blob:mock/);
  });

  it('null bij niet-bestaande uuid', async () => {
    const store = await getOfflinePhotoStorage();
    expect(await store.loadPhoto('niet-bestaand')).toBeNull();
  });
});

// ─── removePhoto ────────────────────────────────────────────────────────────

describe('OfflinePhotoStorage.removePhoto', () => {
  it('verwijdert uit store + revokes URL', async () => {
    const store = await getOfflinePhotoStorage();
    const url = await store.savePhoto('uuid-rm', TINY_DATA_URI);

    await store.removePhoto('uuid-rm');

    expect(lfStore.has('uuid-rm')).toBe(false);
    expect(revokedUrls).toContain(url);
  });

  it('zonder cached URL → niet crashen', async () => {
    lfStore.set('uuid-no-cache', blobFor(128));

    const store = await getOfflinePhotoStorage();
    await expect(store.removePhoto('uuid-no-cache')).resolves.not.toThrow();
    expect(lfStore.has('uuid-no-cache')).toBe(false);
  });
});

// ─── getPhotoSize ───────────────────────────────────────────────────────────

describe('OfflinePhotoStorage.getPhotoSize', () => {
  it('returnt blob.size', async () => {
    lfStore.set('uuid-size', blobFor(2048));
    const store = await getOfflinePhotoStorage();
    expect(await store.getPhotoSize('uuid-size')).toBe(2048);
  });

  it('0 bij niet-bestaande uuid', async () => {
    const store = await getOfflinePhotoStorage();
    expect(await store.getPhotoSize('missing')).toBe(0);
  });
});

// ─── clearAll ───────────────────────────────────────────────────────────────

describe('OfflinePhotoStorage.clearAll', () => {
  it('leegt store en revokes alle URLs', async () => {
    const store = await getOfflinePhotoStorage();
    const url1 = await store.savePhoto('a', TINY_DATA_URI);
    const url2 = await store.savePhoto('b', TINY_DATA_URI);

    await store.clearAll();

    expect(lfStore.size).toBe(0);
    expect(revokedUrls).toContain(url1);
    expect(revokedUrls).toContain(url2);
  });
});
