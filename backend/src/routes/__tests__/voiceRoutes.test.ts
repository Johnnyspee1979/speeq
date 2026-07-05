/**
 * Tests voor de voice-routes (routes/voiceRoutes.ts): POST /tts en GET
 * /cache-stats. /tts valideert de tekst (string, 1..500 chars) en delegeert naar
 * ElevenLabsService; /cache-stats geeft cache-statistieken terug. Een fout hier
 * stuurt lege/te lange tekst naar de (betaalde) TTS-API of verbergt fouten.
 *
 * We borgen het feitelijke contract:
 *  - niet-string tekst → 400, GEEN TTS-call;
 *  - lege/whitespace tekst → 400;
 *  - tekst > 500 chars → 400 met lengte-melding;
 *  - geldige tekst → getrimd naar getSpokenAudioUrl, resultaat als JSON;
 *  - service-exception → 500 met de boodschap;
 *  - /cache-stats geeft de stats door en mapt fouten op 500.
 *
 * Geen supertest: laatste handler uit de router-stack (requireAuth omzeild);
 * requireAuth + ElevenLabsService gemockt.
 */

import type { Request, Response } from 'express';

jest.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockGetUrl = jest.fn();
const mockGetStats = jest.fn();
jest.mock('../../services/elevenLabsService', () => ({
  ElevenLabsService: {
    getSpokenAudioUrl: mockGetUrl,
    getCacheStats: mockGetStats,
  },
}));

const router = require('../voiceRoutes');

type Handler = (req: Request, res: Response) => Promise<unknown>;

const findHandler = (method: string, path: string): Handler => {
  const layer = router.stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods?.[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} niet gevonden`);
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
};

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as Response & { status: jest.Mock; json: jest.Mock };
};

const callTts = async (body: unknown) => {
  const res = mockRes();
  await findHandler('post', '/tts')({ body } as Request, res);
  return res;
};

describe('POST /tts — validatie', () => {
  it('weigert met 400 als text geen string is, zonder TTS-call', async () => {
    const res = await callTts({ text: 123 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGetUrl).not.toHaveBeenCalled();
  });

  it('weigert met 400 bij lege/whitespace tekst', async () => {
    const res = await callTts({ text: '   ' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('leeg');
    expect(mockGetUrl).not.toHaveBeenCalled();
  });

  it('weigert met 400 als de tekst langer dan 500 tekens is', async () => {
    const res = await callTts({ text: 'a'.repeat(501) });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('te lang');
    expect(mockGetUrl).not.toHaveBeenCalled();
  });
});

describe('POST /tts — verwerking', () => {
  it('trimt de tekst, roept de service aan en geeft het resultaat als JSON', async () => {
    const result = { url: 'https://x/a.mp3', cached: true, durationMs: 1200 };
    mockGetUrl.mockResolvedValueOnce(result);

    const res = await callTts({ text: '  Hallo wereld  ' });
    expect(mockGetUrl).toHaveBeenCalledWith('Hallo wereld');
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('geeft 500 met de foutboodschap als de service gooit', async () => {
    mockGetUrl.mockRejectedValueOnce(new Error('TTS down'));
    const res = await callTts({ text: 'tekst' });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('TTS down');
  });
});

describe('GET /cache-stats', () => {
  it('geeft de cache-statistieken door', async () => {
    const stats = { entries: 42, savedChars: 9000 };
    mockGetStats.mockResolvedValueOnce(stats);

    const res = mockRes();
    await findHandler('get', '/cache-stats')({} as Request, res);
    expect(res.json).toHaveBeenCalledWith(stats);
  });

  it('mapt een fout op 500', async () => {
    mockGetStats.mockRejectedValueOnce(new Error('cache stuk'));
    const res = mockRes();
    await findHandler('get', '/cache-stats')({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('cache stuk');
  });
});
