/**
 * Tests voor de BIM/BCF-routes (routes/bimRoutes.ts): POST /sync-bcf (enkel) en
 * POST /sync-bcf-batch. Deze handlers lezen bewijs uit Supabase, mappen het naar
 * een BCF-topic-payload en pushen via bcfService naar het 3D-model. Een fout hier
 * pusht onvolledig bewijs, mist de 404 voor onbekend bewijs, of mapt een tijdelijk
 * BIM-falen verkeerd op een 200.
 *
 * We borgen het feitelijke contract:
 *  - /sync-bcf: ontbrekende evidenceId/ifcGuid → 400 (geen push); onbekend bewijs
 *    → 404; bewijs zonder project_id/inspectiepunt/media → 400; succes → 200 met
 *    topicId; push !success → 503; leesfout → 500;
 *  - /sync-bcf-batch: ontbrekende projectId → 400; lege lijst → 404; gemengde
 *    batch → 200 met successful-telling (onvolledige rijen overgeslagen); alles
 *    mislukt → 503.
 *
 * Geen supertest: laatste handler uit de router-stack; supabase/config/bcfService
 * gemockt.
 */

import type { Request, Response } from 'express';

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

const mockHasSupabaseConfig = jest.fn(() => true);
jest.mock('../../config', () => ({
  backendConfig: { supabaseUrl: 'su', supabaseServiceKey: 'sk' },
  hasSupabaseConfig: mockHasSupabaseConfig,
}));

const mockMapStatus = jest.fn(() => 'Open');
const mockPush = jest.fn();
jest.mock('../../services/bcfService', () => ({
  mapEvidenceStatusToBcfTopicStatus: mockMapStatus,
  pushEvidenceToBimModel: mockPush,
}));

// Per-test instelbare Supabase-resultaten.
let nextSingle: { data: unknown; error: unknown } = { data: null, error: null };
let nextBatch: { data: unknown; error: unknown } = { data: [], error: null };

const makeChain = () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.not = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => Promise.resolve(nextSingle));
  chain.order = jest.fn(() => Promise.resolve(nextBatch));
  // Maakt de chain awaitbaar voor de update-tak (.update().eq() → { error: null }).
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: null });
  return chain;
};

mockCreateClient.mockReturnValue({ from: jest.fn(() => makeChain()) });

const router = require('../bimRoutes');

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

const call = async (path: string, body: unknown) => {
  const res = mockRes();
  await findHandler('post', path)({ body } as Request, res);
  return res;
};

beforeEach(() => {
  nextSingle = { data: null, error: null };
  nextBatch = { data: [], error: null };
});

describe('POST /sync-bcf', () => {
  it('weigert met 400 als evidenceId of ifcGuid ontbreekt, zonder push', async () => {
    const res = await call('/sync-bcf', { evidenceId: 'EV-1' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('antwoordt 404 als het bewijs niet bestaat', async () => {
    nextSingle = { data: null, error: null };
    const res = await call('/sync-bcf', { evidenceId: 'EV-1', ifcGuid: 'IFC-1' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('weigert met 400 als het bewijs project_id/inspectiepunt/media mist', async () => {
    nextSingle = { data: { id: 'EV-1', project_id: 'P-1' }, error: null };
    const res = await call('/sync-bcf', { evidenceId: 'EV-1', ifcGuid: 'IFC-1' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('pusht het gemapte topic en antwoordt 200 met topicId', async () => {
    nextSingle = {
      data: {
        id: 'EV-1',
        project_id: 'P-1',
        inspection_point_id: 'BP-7',
        photo_uri: 'http://x/a.jpg',
        ai_status: 'PASSED',
        ai_notes: 'ok',
      },
      error: null,
    };
    mockPush.mockResolvedValueOnce({ success: true, topicId: 'TOP-9' });

    const res = await call('/sync-bcf', { evidenceId: 'EV-1', ifcGuid: 'IFC-1' });

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'P-1',
        evidenceId: 'EV-1',
        ifcGuid: 'IFC-1',
        title: 'Wkb Inspectie: BP-7',
        description: 'AI Status: PASSED. Bevindingen: ok',
        mediaUrl: 'http://x/a.jpg',
        status: 'Open',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].topicId).toBe('TOP-9');
  });

  it('antwoordt 503 als de BIM-push mislukt', async () => {
    nextSingle = {
      data: {
        id: 'EV-1',
        project_id: 'P-1',
        inspection_point_id: 'BP-7',
        photo_uri: 'http://x/a.jpg',
      },
      error: null,
    };
    mockPush.mockResolvedValueOnce({ success: false });
    const res = await call('/sync-bcf', { evidenceId: 'EV-1', ifcGuid: 'IFC-1' });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('mapt een leesfout op 500', async () => {
    nextSingle = { data: null, error: { message: 'db stuk' } };
    const res = await call('/sync-bcf', { evidenceId: 'EV-1', ifcGuid: 'IFC-1' });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('POST /sync-bcf-batch', () => {
  it('weigert met 400 als projectId ontbreekt', async () => {
    const res = await call('/sync-bcf-batch', { evidenceIds: ['EV-1'] });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('antwoordt 404 als er geen IFC-gekoppeld bewijs is', async () => {
    nextBatch = { data: [], error: null };
    const res = await call('/sync-bcf-batch', { projectId: 'P-1' });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('verwerkt een gemengde batch en telt successful (slaat onvolledige rijen over)', async () => {
    nextBatch = {
      data: [
        {
          id: 'EV-1',
          inspection_point_id: 'BP-1',
          photo_uri: 'http://x/1.jpg',
          ifc_guid: 'IFC-1',
        },
        { id: 'EV-2', inspection_point_id: 'BP-2' }, // mist media + ifc_guid → overgeslagen
      ],
      error: null,
    };
    mockPush.mockResolvedValueOnce({ success: true, topicId: 'TOP-1' });

    const res = await call('/sync-bcf-batch', { projectId: 'P-1' });

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.successful).toBe(1);
    expect(payload.failed).toBe(1);
    expect(payload.requested).toBe(2);
  });

  it('antwoordt 503 als alle pushes mislukken', async () => {
    nextBatch = {
      data: [
        {
          id: 'EV-1',
          inspection_point_id: 'BP-1',
          photo_uri: 'http://x/1.jpg',
          ifc_guid: 'IFC-1',
        },
      ],
      error: null,
    };
    mockPush.mockResolvedValueOnce({ success: false });
    const res = await call('/sync-bcf-batch', { projectId: 'P-1' });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
