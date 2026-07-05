/**
 * @jest-environment jsdom
 *
 * Unit-tests voor OfflinePhotoStore — foto's in IndexedDB (Blob-formaat sinds
 * Sprint 8, met backward-compat voor legacy data-URL strings).
 *
 * We draaien in jsdom en zetten een kleine in-memory fake-IndexedDB neer (Map-
 * backed object-store met request-callbacks). De module heeft een module-level
 * `_db`-singleton, dus laden we 'm vers per test (`isolateModulesAsync`). Platform
 * is mutabel zodat we de web/native-guards kunnen testen. Echte jsdom-Blob +
 * FileReader doen het data-URL-werk. We borgen:
 *   - native (Platform.OS !== 'web') short-circuit → null/0;
 *   - persistOfflinePhoto: data-URL bewaart Blob en geeft de originele data-URL
 *     terug; blob:// fetcht en geeft een verse data-URL;
 *   - getOfflinePhoto: legacy string passthrough, Blob → data-URL;
 *   - getOfflinePhotoBlob: geeft de opgeslagen Blob terug;
 *   - delete + count.
 */

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

let storeData: Map<string, unknown>;

function makeRequest<T>(resultFn: () => T): any {
  const req: any = { onsuccess: null, onerror: null, result: undefined, error: null };
  setTimeout(() => {
    try {
      req.result = resultFn();
      req.onsuccess && req.onsuccess();
    } catch (e) {
      req.error = e;
      req.onerror && req.onerror();
    }
  }, 0);
  return req;
}

function installFakeIndexedDB() {
  const fakeStore = {
    get: (k: string) => makeRequest(() => storeData.get(k)),
    put: (v: unknown, k: string) => makeRequest(() => void storeData.set(k, v)),
    delete: (k: string) => makeRequest(() => void storeData.delete(k)),
    getAllKeys: () => makeRequest(() => [...storeData.keys()]),
  };
  const fakeDb: any = {
    createObjectStore: jest.fn(),
    transaction: () => ({ objectStore: () => fakeStore }),
  };
  (globalThis as any).indexedDB = {
    open: () => {
      const req: any = { onupgradeneeded: null, onsuccess: null, onerror: null, result: fakeDb };
      setTimeout(() => {
        req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    },
  };
}

const mockFetch = jest.fn();

type Mod = typeof import('../OfflinePhotoStore');
async function loadFresh(): Promise<Mod> {
  let m!: Mod;
  await jest.isolateModulesAsync(async () => {
    m = await import('../OfflinePhotoStore');
  });
  return m;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  storeData = new Map();
  installFakeIndexedDB();
  mockFetch.mockResolvedValue({ blob: () => Promise.resolve(new Blob(['photo'], { type: 'image/png' })) });
  (global as any).fetch = (...a: unknown[]) => mockFetch(...a);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('native short-circuits (Platform.OS !== web)', () => {
  it('persist/get/blob geven null, count geeft 0', async () => {
    mockPlatform.OS = 'ios';
    const m = await loadFresh();
    await expect(m.persistOfflinePhoto('data:image/png;base64,aGk=', 'e1')).resolves.toBeNull();
    await expect(m.getOfflinePhoto('e1')).resolves.toBeNull();
    await expect(m.getOfflinePhotoBlob('e1')).resolves.toBeNull();
    await expect(m.getOfflinePhotoCount()).resolves.toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('persistOfflinePhoto', () => {
  it('data-URL: bewaart een Blob en geeft de originele data-URL terug', async () => {
    const m = await loadFresh();
    const dataUrl = 'data:image/png;base64,aGk=';
    const res = await m.persistOfflinePhoto(dataUrl, 'e1');
    expect(res).toBe(dataUrl);
    await expect(m.getOfflinePhotoCount()).resolves.toBe(1);
    const blob = await m.getOfflinePhotoBlob('e1');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('blob:// : fetcht en geeft een verse data-URL terug', async () => {
    const m = await loadFresh();
    const res = await m.persistOfflinePhoto('blob://abc', 'e2');
    expect(typeof res).toBe('string');
    expect(res!.startsWith('data:')).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('blob://abc');
  });

  it('geeft null als fetch faalt', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const m = await loadFresh();
    await expect(m.persistOfflinePhoto('blob://x', 'e3')).resolves.toBeNull();
  });
});

describe('getOfflinePhoto', () => {
  it('legacy data-URL string wordt direct teruggegeven', async () => {
    storeData.set('legacy', 'data:image/png;base64,bGVnYWN5');
    const m = await loadFresh();
    await expect(m.getOfflinePhoto('legacy')).resolves.toBe('data:image/png;base64,bGVnYWN5');
  });

  it('Blob-entry wordt naar een data-URL geconverteerd', async () => {
    storeData.set('e4', new Blob(['hoi'], { type: 'image/png' }));
    const m = await loadFresh();
    const res = await m.getOfflinePhoto('e4');
    expect(res!.startsWith('data:image/png')).toBe(true);
  });

  it('geeft null voor een onbekende key', async () => {
    const m = await loadFresh();
    await expect(m.getOfflinePhoto('weg')).resolves.toBeNull();
  });
});

describe('getOfflinePhotoBlob', () => {
  it('geeft de opgeslagen Blob-instantie terug', async () => {
    const stored = new Blob(['raw'], { type: 'image/png' });
    storeData.set('e5', stored);
    const m = await loadFresh();
    await expect(m.getOfflinePhotoBlob('e5')).resolves.toBe(stored);
  });

  it('legacy string-entry wordt via fetch naar Blob omgezet', async () => {
    storeData.set('e6', 'data:image/png;base64,aGk=');
    const m = await loadFresh();
    const blob = await m.getOfflinePhotoBlob('e6');
    expect(blob).toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledWith('data:image/png;base64,aGk=');
  });
});

describe('delete + count', () => {
  it('verwijdert een entry en telt de rest', async () => {
    storeData.set('a', new Blob(['1']));
    storeData.set('b', new Blob(['2']));
    const m = await loadFresh();
    await expect(m.getOfflinePhotoCount()).resolves.toBe(2);
    await m.deleteOfflinePhoto('a');
    await expect(m.getOfflinePhotoCount()).resolves.toBe(1);
  });
});
