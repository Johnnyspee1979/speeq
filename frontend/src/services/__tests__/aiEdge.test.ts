/**
 * Unit-tests voor aiEdge — on-device edge-check vóór de cloud-AI. Beoordeelt
 * een foto puur op bestandsgrootte (proxy voor "te klein/onscherp") en hangt er
 * optioneel een per-validatiesleutel hint aan.
 *
 * Twee paden:
 *   - web/PWA (blob:/http-URI) → grootte via `fetch().blob().size`;
 *   - native (bestandspad) → grootte via `new File(uri).info()` (expo-file-system).
 *
 * We mocken expo-file-system's File-class en global.fetch. We borgen de
 * drempel (<150 kB → FAILED 0.2, anders PASSED 0.75/0.7), de hint-append bij een
 * aiValidationKey, en de PENDING-fallback wanneer de meting faalt.
 */

const mockInfo = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    info() {
      return mockInfo(this.uri);
    }
  },
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import { validateCaptureOnDevice } from '../aiEdge';

const blobOf = (size: number) => ({ blob: () => Promise.resolve({ size }) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('web/PWA-pad (blob:/http)', () => {
  it('grote foto → PASSED 0.75 met hint bij aiValidationKey', async () => {
    mockFetch.mockResolvedValue(blobOf(200_000));
    const res = await validateCaptureOnDevice('blob:abc', 'DETECT_COLLAR');
    expect(res.status).toBe('PASSED');
    expect(res.confidence).toBe(0.75);
    expect(res.notes).toContain('Edge check OK');
    expect(res.notes).toContain('brandmanchet'); // uit de hint-tekst
    expect(mockFetch).toHaveBeenCalledWith('blob:abc');
  });

  it('kleine foto (<150 kB) → FAILED 0.2', async () => {
    mockFetch.mockResolvedValue(blobOf(100_000));
    const res = await validateCaptureOnDevice('http://x/foto.jpg');
    expect(res.status).toBe('FAILED');
    expect(res.confidence).toBe(0.2);
    expect(res.notes).toMatch(/te onscherp of te klein/);
  });

  it('fetch faalt → PENDING met null confidence', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const res = await validateCaptureOnDevice('blob:zzz');
    expect(res).toEqual({
      status: 'PENDING',
      confidence: null,
      notes: 'Edge check kon niet worden uitgevoerd (web).',
    });
  });
});

describe('native-pad (bestandspad)', () => {
  it('groot bestand → PASSED 0.7', async () => {
    mockInfo.mockReturnValue({ exists: true, size: 300_000 });
    const res = await validateCaptureOnDevice('/var/foto.jpg');
    expect(res.status).toBe('PASSED');
    expect(res.confidence).toBe(0.7);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('klein bestand → FAILED 0.2 met hint', async () => {
    mockInfo.mockReturnValue({ exists: true, size: 50_000 });
    const res = await validateCaptureOnDevice('/var/foto.jpg', 'DETECT_WATERPAS');
    expect(res.status).toBe('FAILED');
    expect(res.confidence).toBe(0.2);
    expect(res.notes).toContain('waterpas');
  });

  it('niet-bestaand bestand telt als 0 → FAILED 0.2', async () => {
    mockInfo.mockReturnValue({ exists: false, size: undefined });
    const res = await validateCaptureOnDevice('/var/weg.jpg');
    expect(res.status).toBe('FAILED');
  });

  it('info() gooit → PENDING', async () => {
    mockInfo.mockImplementation(() => {
      throw new Error('geen toegang');
    });
    const res = await validateCaptureOnDevice('/var/foto.jpg');
    expect(res).toEqual({
      status: 'PENDING',
      confidence: null,
      notes: 'Edge check kon niet worden uitgevoerd.',
    });
  });
});
