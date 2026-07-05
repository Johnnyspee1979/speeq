/**
 * Unit-tests voor storageUrl — zet opgeslagen storage-referenties om naar
 * tóónbare URLs. Kale paden worden on-demand getekend tot een kortlevende
 * signed URL; volledige/lokale URLs (http(s)/file/blob/data/local) komen
 * ongemoeid terug; lege waarden ook.
 *
 * We mocken `./supabase` zodat `supabase.storage.from(bucket)` een object met
 * createSignedUrl/createSignedUrls teruggeeft. We borgen:
 *   - resolveStorageUrl: passthrough-takken, null/undefined, een kaal pad → signed,
 *     en de fallback-op-ruwe-waarde bij een fout;
 *   - resolveStorageUrls: dedup + filter van passthrough/leeg, behoud van volgorde,
 *     no-op wanneer er niets te tekenen valt, en fallback bij een batch-fout.
 */

const mockCreateSignedUrl = jest.fn<Promise<any>, unknown[]>();
const mockCreateSignedUrls = jest.fn<Promise<any>, unknown[]>();
const mockFrom = jest.fn<any, unknown[]>(() => ({
  createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a),
  createSignedUrls: (...a: unknown[]) => mockCreateSignedUrls(...a),
}));

jest.mock('../supabase', () => ({
  supabase: { storage: { from: (...a: unknown[]) => mockFrom(...a) } },
}));

import { resolveStorageUrl, resolveStorageUrls } from '../storageUrl';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('resolveStorageUrl', () => {
  it('geeft lege waarden onveranderd terug (geen netwerk-call)', async () => {
    await expect(resolveStorageUrl('fotos', null)).resolves.toBeNull();
    await expect(resolveStorageUrl('fotos', undefined)).resolves.toBeUndefined();
    await expect(resolveStorageUrl('fotos', '')).resolves.toBe('');
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    'http://x/a.jpg',
    'https://x/a.jpg',
    'file:///var/a.jpg',
    'blob:abc',
    'data:image/png;base64,xx',
    'local://a.jpg',
  ])('laat passthrough-URL ongemoeid: %s', async (value) => {
    await expect(resolveStorageUrl('fotos', value)).resolves.toBe(value);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('tekent een kaal pad tot een signed URL', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/a' }, error: null });
    const res = await resolveStorageUrl('fotos', 'project/a.jpg', 120);
    expect(res).toBe('https://signed/a');
    expect(mockFrom).toHaveBeenCalledWith('fotos');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('project/a.jpg', 120);
  });

  it('valt terug op de ruwe waarde bij een fout', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'boem' } });
    await expect(resolveStorageUrl('fotos', 'project/a.jpg')).resolves.toBe('project/a.jpg');
  });

  it('valt terug wanneer er geen signedUrl in data zit', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: {}, error: null });
    await expect(resolveStorageUrl('fotos', 'project/a.jpg')).resolves.toBe('project/a.jpg');
  });
});

describe('resolveStorageUrls', () => {
  it('no-op wanneer er niets te tekenen valt', async () => {
    const values = ['http://x/a.jpg', null, ''];
    await expect(resolveStorageUrls('fotos', values)).resolves.toEqual(values);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('tekent kale paden (dedup) en behoudt de volgorde', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { path: 'a.jpg', signedUrl: 'https://signed/a' },
        { path: 'b.jpg', signedUrl: 'https://signed/b' },
      ],
      error: null,
    });
    const values = ['a.jpg', 'http://x/keep.jpg', 'b.jpg', 'a.jpg', null];
    const res = await resolveStorageUrls('fotos', values, 60);
    expect(res).toEqual([
      'https://signed/a',
      'http://x/keep.jpg',
      'https://signed/b',
      'https://signed/a',
      null,
    ]);
    // dedup: 'a.jpg' en 'b.jpg' uniek, in volgorde van eerste voorkomen
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 60);
  });

  it('valt terug op de ruwe waarden bij een batch-fout', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'boem' } });
    const values = ['a.jpg', 'b.jpg'];
    await expect(resolveStorageUrls('fotos', values)).resolves.toEqual(values);
  });
});
