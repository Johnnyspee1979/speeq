/**
 * Unit-tests voor ElevenLabsService.
 *
 * Cache-hit / miss + API-flow + error-paden gemockt — geen echte
 * ElevenLabs of Supabase calls.
 */

const mockList = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

const mockSupabaseAdmin = {
  storage: {
    from: () => ({
      list: mockList,
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    }),
  },
};

jest.mock('../supabaseAdmin', () => ({
  getSupabaseAdminClient: () => mockSupabaseAdmin,
}));

jest.mock('../../config', () => ({
  backendConfig: {
    elevenLabsApiKey: 'test-key',
  },
}));

const mockAxios = jest.fn();
jest.mock('axios', () => (opts: unknown) => mockAxios(opts));

const { ElevenLabsService } = require('../elevenLabsService');

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockReset();
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReset().mockReturnValue({
    data: { publicUrl: 'https://supabase.example/cache/xx.mp3' },
  });
  mockAxios.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ElevenLabsService.getSpokenAudioUrl', () => {
  it('throws bij lege tekst', async () => {
    await expect(ElevenLabsService.getSpokenAudioUrl('   ')).rejects.toThrow(
      /mag niet leeg zijn/,
    );
  });

  it('cache-hit: skipt ElevenLabs, returnt URL', async () => {
    // Bestand bestaat al
    mockList.mockResolvedValue({
      data: [{ name: 'expected-hash.mp3' }],
      error: null,
    });
    // Hack: forceer dezelfde hash door specifieke text
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://supabase.example/cache/expected-hash.mp3' },
    });
    // Mock list voor de echte hash van 'test'
    mockList.mockImplementation(() =>
      Promise.resolve({
        data: [{ name: '098f6bcd4621d373cade4e832627b4f6.mp3' }], // md5('test')
        error: null,
      }),
    );

    const result = await ElevenLabsService.getSpokenAudioUrl('test');

    expect(result.cached).toBe(true);
    expect(result.url).toContain('supabase.example');
    expect(mockAxios).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('cache-miss: roept ElevenLabs + upload + returnt URL', async () => {
    mockList.mockResolvedValue({ data: [], error: null });
    mockAxios.mockResolvedValue({
      status: 200,
      data: Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00]), // ID3 header bytes
    });

    const result = await ElevenLabsService.getSpokenAudioUrl('nieuwe tekst');

    expect(result.cached).toBe(false);
    expect(mockAxios).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);

    const axiosCall = mockAxios.mock.calls[0][0] as {
      url: string;
      data: { text: string; model_id: string };
      headers: { 'xi-api-key': string };
    };
    expect(axiosCall.url).toContain('text-to-speech/');
    expect(axiosCall.data.text).toBe('nieuwe tekst');
    expect(axiosCall.data.model_id).toBe('eleven_turbo_v2_5');
    expect(axiosCall.headers['xi-api-key']).toBe('test-key');
  });

  it('cache-list-error: niet fataal, valt door naar API', async () => {
    mockList.mockResolvedValue({ data: null, error: { message: 'list down' } });
    mockAxios.mockResolvedValue({
      status: 200,
      data: Buffer.from([0x00]),
    });

    const result = await ElevenLabsService.getSpokenAudioUrl('hallo');

    expect(result.cached).toBe(false);
    expect(mockAxios).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('throws bij ontbrekende API-key', async () => {
    jest.resetModules();
    jest.doMock('../../config', () => ({
      backendConfig: { elevenLabsApiKey: '' },
    }));
    jest.doMock('../supabaseAdmin', () => ({
      getSupabaseAdminClient: () => mockSupabaseAdmin,
    }));
    jest.doMock('axios', () => (opts: unknown) => mockAxios(opts));
    mockList.mockResolvedValue({ data: [], error: null });

    const freshService = require('../elevenLabsService').ElevenLabsService;
    await expect(freshService.getSpokenAudioUrl('xx')).rejects.toThrow(
      /API key ontbreekt/,
    );

    jest.resetModules();
  });

  it('throws bij upload-fout', async () => {
    mockList.mockResolvedValue({ data: [], error: null });
    mockAxios.mockResolvedValue({ status: 200, data: Buffer.from([0]) });
    mockUpload.mockResolvedValue({ error: { message: 'storage vol' } });

    await expect(ElevenLabsService.getSpokenAudioUrl('xx')).rejects.toMatchObject({
      message: 'storage vol',
    });
  });

  it('respect env overrides voor voice + model', async () => {
    process.env.ELEVENLABS_VOICE_ID = 'custom-voice-id';
    process.env.ELEVENLABS_MODEL_ID = 'eleven_v3_pro';

    mockList.mockResolvedValue({ data: [], error: null });
    mockAxios.mockResolvedValue({ status: 200, data: Buffer.from([0]) });

    await ElevenLabsService.getSpokenAudioUrl('xx');

    const axiosCall = mockAxios.mock.calls[0][0] as {
      url: string;
      data: { model_id: string };
    };
    expect(axiosCall.url).toContain('custom-voice-id');
    expect(axiosCall.data.model_id).toBe('eleven_v3_pro');

    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_MODEL_ID;
  });
});

describe('ElevenLabsService.getCacheStats', () => {
  it('telt files + bytes', async () => {
    mockList.mockResolvedValue({
      data: [
        { name: 'a.mp3', metadata: { size: 1000 } },
        { name: 'b.mp3', metadata: { size: 2000 } },
        { name: 'c.mp3' }, // geen metadata
      ],
      error: null,
    });

    const stats = await ElevenLabsService.getCacheStats();
    expect(stats.count).toBe(3);
    expect(stats.bytes).toBe(3000);
  });

  it('throws bij list-error', async () => {
    mockList.mockResolvedValue({ data: null, error: { message: 'down' } });
    await expect(ElevenLabsService.getCacheStats()).rejects.toMatchObject({
      message: 'down',
    });
  });
});
