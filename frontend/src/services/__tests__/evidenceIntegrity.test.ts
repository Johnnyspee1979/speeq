/**
 * Unit-tests voor evidenceIntegrity — de bewijs-integriteit van WKB-foto's.
 *
 * Deze hashes onderbouwen de bewijsketen (consument + bevoegd gezag), dus het
 * gedrag moet geborgd zijn:
 *   - createEvidenceId: UUID via expo-crypto, val terug op globalThis.crypto,
 *     en als laatste op een tijdstempel-id (mag nooit leeg zijn);
 *   - createEvidenceHashFromBase64: SHA-256 over de base64;
 *   - createEvidenceHash: blob/http via fetch+FileReader, natief via expo-file-
 *     system, en een fail-safe fallback-hash zodat opslaan nooit blokkeert.
 */

const mockRandomUUID = jest.fn();
const mockDigest = jest.fn();
jest.mock('expo-crypto', () => ({
  randomUUID: mockRandomUUID,
  digestStringAsync: (...a: unknown[]) => mockDigest(...a),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const mockFileBase64 = jest.fn();
const mockFileCtor = jest.fn().mockImplementation(function (this: any, uri: string) {
  this.uri = uri;
  this.base64 = mockFileBase64;
});
jest.mock('expo-file-system', () => ({ File: mockFileCtor }));

const {
  createEvidenceId,
  createEvidenceHashFromBase64,
  createEvidenceHash,
} = require('../evidenceIntegrity');

// Zelfde mock-object als de module ziet; randomUUID is een herschrijfbare prop.
const Crypto = require('expo-crypto');

class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  error: unknown = null;
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,QUFBQQ==';
    this.onload?.();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  Crypto.randomUUID = mockRandomUUID;
  mockRandomUUID.mockReturnValue('crypto-uuid-1');
  mockDigest.mockResolvedValue('sha256-hash');
  (globalThis as unknown as { crypto: unknown }).crypto = undefined;
  (globalThis as unknown as { FileReader: unknown }).FileReader = MockFileReader;
});

describe('createEvidenceId', () => {
  it('gebruikt expo-crypto randomUUID als die er is', () => {
    expect(createEvidenceId()).toBe('crypto-uuid-1');
  });

  it('valt terug op globalThis.crypto.randomUUID', () => {
    Crypto.randomUUID = undefined;
    (globalThis as unknown as { crypto: { randomUUID: () => string } }).crypto = {
      randomUUID: () => 'global-uuid',
    };
    expect(createEvidenceId()).toBe('global-uuid');
  });

  it('val als laatste terug op een tijdstempel-id (nooit leeg)', () => {
    Crypto.randomUUID = undefined;
    (globalThis as unknown as { crypto: unknown }).crypto = undefined;
    expect(createEvidenceId()).toMatch(/^wkb-\d+-[0-9a-f]+$/);
  });
});

describe('createEvidenceHashFromBase64', () => {
  it('hasht met SHA-256 over de base64', async () => {
    await expect(createEvidenceHashFromBase64('b64-data')).resolves.toBe('sha256-hash');
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', 'b64-data');
  });
});

describe('createEvidenceHash', () => {
  it('blob/http: haalt via fetch + FileReader en hasht de base64', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValue({ blob: async () => ({}) });

    await expect(createEvidenceHash('blob:abc')).resolves.toBe('sha256-hash');
    // 'QUFBQQ==' is de base64 ná de comma in de data-URL
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', 'QUFBQQ==');
  });

  it('blob/http: bij een fetch-fout een fail-safe fallback-hash (blokkeert niet)', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(new Error('netwerk weg'));

    await expect(createEvidenceHash('https://x/y.jpg')).resolves.toBe('sha256-hash');
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.stringMatching(/^fallback-\d+$/));
  });

  it('natief pad: leest base64 via expo-file-system en hasht', async () => {
    mockFileBase64.mockResolvedValue('native-b64');

    await expect(createEvidenceHash('/var/foto.jpg')).resolves.toBe('sha256-hash');
    expect(mockFileCtor).toHaveBeenCalledWith('/var/foto.jpg');
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', 'native-b64');
  });
});
