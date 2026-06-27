/**
 * Unit-tests voor aiService — de AI-validatie van Wkb-bewijsfoto's met
 * gelaagde fallback: Gemini (primair) → Gemini fallback-sleutel → OpenAI →
 * deterministische mock + alert-mail. Juridisch/operationeel gevoelig: de
 * status (PASSED/FAILED/NEEDS_REVIEW) bepaalt of bewijs het dossier in mag.
 *
 * We mocken axios (image-download + Gemini-POST), de OpenAI-client, de config
 * en de alert-mail, en borgen:
 *   - Gemini-pad: parse van de generateContent-JSON, met veilige defaults;
 *   - fallback naar OpenAI als Gemini niet is ingesteld;
 *   - volledige degradatie → mock-resultaat (PASSED voor wapening, NEEDS_REVIEW
 *     voor isolatie/brand, anders FAILED) én een fire-and-forget alert-mail;
 *   - normalisatie van het inspectiepunt (WAPENING-1 → wapening).
 */

const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  get: (...a: unknown[]) => mockAxiosGet(...a),
  post: (...a: unknown[]) => mockAxiosPost(...a),
}));

const mockOpenAiCreate = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...a: unknown[]) => mockOpenAiCreate(...a) } },
  })),
}));

const mockConfig: {
  openaiApiKey: string;
  aiValidatorUrl: string;
  aiValidatorTimeoutMs: number;
} = { openaiApiKey: '', aiValidatorUrl: 'https://ai.x/validate', aiValidatorTimeoutMs: 5000 };
jest.mock('../../config', () => ({ backendConfig: mockConfig }));

const mockSendAlert = jest.fn();
jest.mock('../emailService', () => ({
  sendAiFallbackAlertEmail: (...a: unknown[]) => mockSendAlert(...a),
}));

const { validateEvidenceImage } = require('../aiService');

const geminiJson = (obj: Record<string, unknown>) => ({
  data: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] },
});
const openAiJson = (obj: Record<string, unknown>) => ({
  choices: [{ message: { content: JSON.stringify(obj) } }],
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_FALLBACK_API_KEY;
  mockConfig.openaiApiKey = '';
  mockAxiosGet.mockResolvedValue({ data: Buffer.from('img'), headers: { 'content-type': 'image/jpeg' } });
  mockSendAlert.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Gemini-pad (primair)', () => {
  it('parset het Gemini-resultaat en levert de status door', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    mockAxiosPost.mockResolvedValue(
      geminiJson({
        status: 'PASSED',
        confidence: 0.9,
        detectedObjects: ['wapeningsstaal'],
        feedback: 'ok',
        checks: ['gemini'],
      })
    );

    const res = await validateEvidenceImage('https://x/a.jpg', 'WAPENING-1');
    expect(res.status).toBe('PASSED');
    expect(res.confidence).toBe(0.9);
    expect(res.detectedObjects).toContain('wapeningsstaal');
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    // Gemini-endpoint aangeroepen
    expect((mockAxiosPost.mock.calls[0]![0] as string)).toContain('gemini-flash-latest');
  });

  it('valt terug op veilige defaults bij een lege Gemini-JSON', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    mockAxiosPost.mockResolvedValue(geminiJson({}));

    const res = await validateEvidenceImage('https://x/a.jpg', 'gevel');
    expect(res.status).toBe('NEEDS_REVIEW');
    expect(res.confidence).toBe(0);
    expect(res.checks).toEqual(['gemini-vision-analyse']);
  });
});

describe('Fallback naar OpenAI', () => {
  it('gebruikt OpenAI als Gemini niet is ingesteld', async () => {
    // geen GEMINI_API_KEY → Gemini gooit meteen, geen fallback-key → OpenAI
    mockConfig.openaiApiKey = 'oa-key';
    mockOpenAiCreate.mockResolvedValue(
      openAiJson({
        status: 'FAILED',
        confidence: 0.4,
        detectedObjects: ['hand'],
        feedback: 'niets herkenbaar',
        checks: ['openai'],
      })
    );

    const res = await validateEvidenceImage('https://x/a.jpg', 'gevel');
    expect(res.status).toBe('FAILED');
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});

describe('Volledige degradatie → mock + alert', () => {
  it('levert het wapening-mockresultaat (PASSED) en stuurt een alert', async () => {
    // geen Gemini-key, geen OpenAI-key → beide gefaald → mock
    const res = await validateEvidenceImage('https://x/a.jpg', 'WAPENING-1');
    expect(res.status).toBe('PASSED');
    expect(res.confidence).toBe(0.92);
    expect(res.feedback).toMatch(/MOCK fallback/);
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect((mockSendAlert.mock.calls[0]![0] as any).inspectionPoint).toBe('wapening');
  });

  it('levert NEEDS_REVIEW voor isolatie/brand', async () => {
    const res = await validateEvidenceImage('https://x/a.jpg', 'brandwerende isolatie');
    expect(res.status).toBe('NEEDS_REVIEW');
  });

  it('levert FAILED voor een onbekend inspectiepunt', async () => {
    const res = await validateEvidenceImage('https://x/a.jpg', 'onbekend-iets');
    expect(res.status).toBe('FAILED');
  });

  it('breekt niet als de alert-mail zelf faalt', async () => {
    mockSendAlert.mockRejectedValue(new Error('resend down'));
    await expect(validateEvidenceImage('https://x/a.jpg', 'wapening')).resolves.toMatchObject({
      status: 'PASSED',
    });
  });
});
