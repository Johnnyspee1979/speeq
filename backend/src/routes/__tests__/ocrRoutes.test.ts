/**
 * Tests voor de OCR-route (routes/ocrRoutes.ts): POST /scan-betonbon. Deze handler
 * eist een geüploade foto + evidenceId, normaliseert de project-spec (JSON-string
 * of object → getrimde strings + numerieke grenzen), scant de betonbon en
 * persisteert het resultaat zacht. Een fout hier stuurt een ongeldige spec naar
 * de OCR-validatie of laat een ontbrekende foto stilletjes door.
 *
 * We borgen het feitelijke contract:
 *  - ontbrekende foto of evidenceId → 400, GEEN OCR-call;
 *  - object-spec → genormaliseerd (strings getrimd, getallen geparsed, NaN→null);
 *  - JSON-string-spec → geparsed; ongeldige JSON of geen spec → {} (zacht falen);
 *  - succes → 200 met de geëxtraheerde data;
 *  - OCR-exceptie → 500.
 *
 * Geen supertest: laatste handler uit de router-stack (multer omzeild);
 * multer/supabase/config/ocrService gemockt.
 */

import type { Request, Response } from 'express';

jest.mock('multer', () => {
  const m: any = () => ({ single: () => (_req: unknown, _res: unknown, next: () => void) => next() });
  m.memoryStorage = () => ({});
  return m;
});

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

const mockHasSupabaseConfig = jest.fn(() => true);
jest.mock('../../config', () => ({
  backendConfig: { supabaseUrl: 'su', supabaseServiceKey: 'sk' },
  hasSupabaseConfig: mockHasSupabaseConfig,
}));

const mockScan = jest.fn();
jest.mock('../../services/ocrService', () => ({ scanBetonbonOCR: mockScan }));

// Supabase-client die een schone update doet (geen kolomfout).
mockCreateClient.mockReturnValue({
  from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
});

const router = require('../ocrRoutes');

type Handler = (req: Request, res: Response) => Promise<void>;

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

const ocrData = {
  ruweTekst: 'tekst',
  betonkwaliteit: 'C30/37',
  milieuklasse: 'XC4',
  volumeKuub: '6',
  leverdatum: '2026-06-28',
};

const call = async (req: Partial<Request> & { file?: unknown }) => {
  const res = mockRes();
  await findHandler('post', '/scan-betonbon')(
    { body: {}, ...req } as Request,
    res
  );
  return res;
};

describe('POST /scan-betonbon — validatie', () => {
  it('weigert met 400 als de foto ontbreekt', async () => {
    const res = await call({ body: { evidenceId: 'EV-1' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('weigert met 400 als evidenceId ontbreekt', async () => {
    const res = await call({ body: {}, file: { buffer: Buffer.from('x') } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockScan).not.toHaveBeenCalled();
  });
});

describe('POST /scan-betonbon — spec-normalisatie', () => {
  it('normaliseert een object-spec (trim strings, parse getallen, NaN→null)', async () => {
    mockScan.mockResolvedValueOnce(ocrData);
    const buffer = Buffer.from('foto');

    await call({
      body: {
        evidenceId: 'EV-2',
        spec: {
          expectedBetonkwaliteit: '  C30/37  ',
          minVolumeKuub: '5',
          maxVolumeKuub: 'geen-getal',
        },
      },
      file: { buffer },
    });

    const [bufArg, specArg] = mockScan.mock.calls[0] as [Buffer, any];
    expect(bufArg).toBe(buffer);
    expect(specArg).toMatchObject({
      expectedBetonkwaliteit: 'C30/37',
      minVolumeKuub: 5,
      maxVolumeKuub: null,
    });
  });

  it('parset een JSON-string-spec', async () => {
    mockScan.mockResolvedValueOnce(ocrData);
    await call({
      body: { evidenceId: 'EV-3', spec: '{"minVolumeKuub":"7"}' },
      file: { buffer: Buffer.from('f') },
    });
    expect((mockScan.mock.calls[0][1] as any).minVolumeKuub).toBe(7);
  });

  it('valt zacht terug op {} bij ongeldige JSON', async () => {
    mockScan.mockResolvedValueOnce(ocrData);
    await call({
      body: { evidenceId: 'EV-4', spec: '{kapot' },
      file: { buffer: Buffer.from('f') },
    });
    expect(mockScan.mock.calls[0][1]).toEqual({});
  });
});

describe('POST /scan-betonbon — resultaat', () => {
  it('antwoordt 200 met de geëxtraheerde data', async () => {
    mockScan.mockResolvedValueOnce(ocrData);
    const res = await call({
      body: { evidenceId: 'EV-5' },
      file: { buffer: Buffer.from('f') },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: ocrData });
  });

  it('mapt een OCR-fout op 500', async () => {
    mockScan.mockRejectedValueOnce(new Error('OCR stuk'));
    const res = await call({
      body: { evidenceId: 'EV-6' },
      file: { buffer: Buffer.from('f') },
    });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
