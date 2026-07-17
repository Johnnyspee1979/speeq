/**
 * Tests voor de evidence-upload-route (routes/evidenceRoutes.ts): POST /upload.
 * Deze handler valideert de foto + evidenceData, normaliseert een mix van
 * camelCase/snake_case-velden (strings → getallen/booleans), valideert met AI,
 * uploadt naar Supabase Storage, tekent een signed URL en schrijft het bewijs
 * weg met een rich→legacy insert-fallback. Een fout hier laat onvolledig bewijs
 * door, mist de AI-validatie, of verliest de DB-fallback.
 *
 * We borgen het feitelijke contract:
 *  - ontbrekende foto of evidenceData → 400 (geen AI-call);
 *  - ontbrekend inspectionPointId of lat/long → 400;
 *  - succes → AI-validatie + storage-upload + insert, 200 met signed mediaUrl en
 *    genormaliseerd payload (camel→snake, '52.1'→52.1, 'true'/1→true);
 *  - rich-insert faalt → legacy-payload wordt geprobeerd (200);
 *  - beide inserts falen of storage-fout → 500.
 *
 * Geen supertest: laatste handler uit de router-stack (uploadPhoto/multer
 * omzeild); multer/dotenv/supabase/config/aiValidationService gemockt.
 */

import type { Request, Response } from 'express';

jest.mock('multer', () => {
  const m: any = () => ({ single: () => (_req: unknown, _res: unknown, next: () => void) => next() });
  m.memoryStorage = () => ({});
  return m;
});

jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

jest.mock('../../config', () => ({
  backendConfig: { supabaseUrl: 'su', supabaseServiceKey: 'sk' },
  hasSupabaseConfig: jest.fn(() => true),
}));

const mockValidate = jest.fn();
jest.mock('../../services/aiValidationService', () => ({ validateEvidenceWithAI: mockValidate }));

// Supabase-mock: storage upload + signed URL + insert().select('id').single().
const mockUpload = jest.fn<Promise<{ error: { message: string } | null }>, unknown[]>(() =>
  Promise.resolve({ error: null })
);
const mockCreateSignedUrl = jest.fn(() =>
  Promise.resolve({ data: { signedUrl: 'https://signed/x' } })
);
const mockInsertSingle = jest.fn<
  Promise<{ data: { id: number } | null; error: { message: string } | null }>,
  unknown[]
>(() => Promise.resolve({ data: { id: 1 }, error: null }));
const mockInsert = jest.fn<{ select: () => { single: typeof mockInsertSingle } }, unknown[]>(
  () => ({ select: () => ({ single: mockInsertSingle }) })
);

mockCreateClient.mockReturnValue({
  storage: { from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl }) },
  from: () => ({ insert: mockInsert }),
});

const router = require('../evidenceRoutes');

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

const file = () => ({ buffer: Buffer.from('img'), mimetype: 'image/png' });

const call = async (req: { body?: unknown; file?: unknown }) => {
  const res = mockRes();
  await findHandler('post', '/upload')({ body: {}, ...req } as Request, res);
  return res;
};

const validData = {
  id: 'EV-1',
  projectId: 'P-1',
  inspectionPointId: 'BP-1',
  latitude: '52.1', // string-getal
  longitude: 4.3,
  gpsAccuracy: '5',
  exifHash: 'h',
  exifVerified: 'true', // string-boolean
  fieldNote: 'note',
  stopMomentConfirmed: 1, // numerieke boolean
  measurementToolConfirmed: 'false',
  locationVerified: true,
};

beforeEach(() => {
  mockValidate.mockResolvedValue({ status: 'PASSED', confidence: 0.9, findings: ['ok'] });
});

describe('POST /upload — validatie', () => {
  it('weigert met 400 als de foto ontbreekt, zonder AI-call', async () => {
    const res = await call({ body: { evidenceData: JSON.stringify(validData) } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('weigert met 400 als evidenceData ontbreekt', async () => {
    const res = await call({ body: {}, file: file() });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('weigert met 400 als projectId ontbreekt (geen onbekend-project-fallback meer)', async () => {
    const { projectId, ...zonder } = validData;
    const res = await call({ body: { evidenceData: zonder }, file: file() });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('weigert met 400 als inspectionPointId ontbreekt', async () => {
    const { inspectionPointId, ...zonder } = validData;
    const res = await call({ body: { evidenceData: zonder }, file: file() });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('weigert met 400 als latitude/longitude ontbreekt', async () => {
    const { latitude, longitude, ...zonder } = validData;
    const res = await call({ body: { evidenceData: zonder }, file: file() });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidate).not.toHaveBeenCalled();
  });
});

describe('POST /upload — verwerking', () => {
  it('valideert met AI, uploadt en antwoordt 200 met genormaliseerd payload', async () => {
    const res = await call({ body: { evidenceData: JSON.stringify(validData) }, file: file() });

    // AI-validatie krijgt de buffer + inspectiepunt.
    expect(mockValidate).toHaveBeenCalledWith(expect.any(Buffer), 'BP-1');

    // Storage-pad: veilige project/evidence-id + collision-vrije suffix + extensie.
    expect(mockUpload.mock.calls[0]?.[0]).toMatch(/^P-1\/EV-1-\d+\.png$/);
    // upsert:false zodat bestaand bewijs nooit stil wordt overschreven.
    expect((mockUpload.mock.calls[0]?.[2] as any).upsert).toBe(false);

    // Genormaliseerd insert-payload (camel→snake, string→getal/boolean).
    const payload: any = (mockInsert.mock.calls[0]?.[0] as any[])[0];
    expect(payload).toMatchObject({
      evidence_id: 'EV-1',
      project_id: 'P-1',
      inspection_point_id: 'BP-1',
      latitude: 52.1,
      longitude: 4.3,
      gps_accuracy: 5,
      exif_verified: true,
      field_note: 'note',
      stop_moment_confirmed: true,
      measurement_tool_confirmed: false,
      location_verified: true,
      ai_status: 'PASSED',
      ai_confidence: 0.9,
      ai_notes: 'ok',
    });

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.evidenceId).toBe('EV-1');
    expect(body.cloudRecordId).toBe(1);
    expect(body.mediaUrl).toBe('https://signed/x');
  });

  it('valt alleen bij een ontbrekende-kolom-fout terug op het legacy-payload (200)', async () => {
    mockInsertSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'column "exif_hash" does not exist' } })
      .mockResolvedValueOnce({ data: { id: 7 }, error: null });

    const res = await call({ body: { evidenceData: validData }, file: file() });

    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].cloudRecordId).toBe(7);
  });

  it('valt NIET terug op legacy bij een andere fout → 500, geen tweede insert', async () => {
    // Een niet-kolom-fout mag niet stil de Wkb-verificatievelden weglaten.
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'permission denied (RLS)' } });
    const res = await call({ body: { evidenceData: validData }, file: file() });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('mapt twee mislukte inserts (beide kolomfout) op 500', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'column "exif_hash" does not exist' },
    });
    const res = await call({ body: { evidenceData: validData }, file: file() });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('mapt een storage-fout op 500', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'storage stuk' } });
    const res = await call({ body: { evidenceData: validData }, file: file() });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
