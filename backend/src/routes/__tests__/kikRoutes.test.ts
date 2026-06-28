/**
 * Tests voor de KiK-routes (routes/kikRoutes.ts): GET /borgingsplan/:projectId,
 * POST /evidence (batch) en POST /sync-evidence (enkel, met veld-mapping). Deze
 * handlers valideren input, mappen rauwe bewijs-velden naar het KiK-contract en
 * vertalen het service-resultaat naar HTTP-statussen. Een fout hier pusht
 * onvolledig bewijs of verbergt een retry-baar falen achter een 200.
 *
 * We borgen het feitelijke contract:
 *  - /borgingsplan: lege projectId → 400, anders fetch + 200;
 *  - /evidence: ontbrekende projectId/evidence → 400; alles mislukt
 *    (failed>0 & submitted===0) → 503, anders 200;
 *  - /sync-evidence: mapt geneste camelCase/gps naar het snake_case-payload,
 *    400 als de payload incompleet is, en mapt success→200 / retryPending→503 /
 *    overig→422.
 *
 * Geen supertest: handler uit de router-stack; kikService gemockt.
 */

import type { Request, Response } from 'express';

const mockBuildPayload = jest.fn();
const mockFetchBorgingsplan = jest.fn();
const mockPushBatch = jest.fn();
const mockPushOne = jest.fn();
jest.mock('../../services/kikService', () => ({
  buildKiKEvidencePayload: mockBuildPayload,
  fetchKikBorgingsplan: mockFetchBorgingsplan,
  pushEvidenceBatchToKiK: mockPushBatch,
  pushEvidenceToKiK: mockPushOne,
}));

const router = require('../kikRoutes');

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

const call = async (method: string, path: string, req: Partial<Request>) => {
  const res = mockRes();
  await findHandler(method, path)(
    { params: {}, body: {}, ...req } as Request,
    res
  );
  return res;
};

describe('GET /borgingsplan/:projectId', () => {
  it('weigert met 400 bij lege projectId', async () => {
    const res = await call('get', '/borgingsplan/:projectId', { params: { projectId: '   ' } as any });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFetchBorgingsplan).not.toHaveBeenCalled();
  });

  it('haalt het borgingsplan op en antwoordt 200', async () => {
    mockFetchBorgingsplan.mockResolvedValueOnce({ plan: 'X' });
    const res = await call('get', '/borgingsplan/:projectId', { params: { projectId: ' P-1 ' } as any });
    expect(mockFetchBorgingsplan).toHaveBeenCalledWith('P-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ plan: 'X' });
  });
});

describe('POST /evidence (batch)', () => {
  it('weigert met 400 als projectId of evidence ontbreekt', async () => {
    const res = await call('post', '/evidence', { body: { projectId: 'P', evidence: [] } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPushBatch).not.toHaveBeenCalled();
  });

  it('antwoordt 200 als er minstens iets gesynchroniseerd is', async () => {
    mockPushBatch.mockResolvedValueOnce({ submitted: 2, failed: 1 });
    const res = await call('post', '/evidence', { body: { projectId: 'P', evidence: [{}, {}, {}] } });
    expect(mockPushBatch).toHaveBeenCalledWith('P', [{}, {}, {}]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('antwoordt 503 als alles mislukt (failed>0 & submitted===0)', async () => {
    mockPushBatch.mockResolvedValueOnce({ submitted: 0, failed: 3 });
    const res = await call('post', '/evidence', { body: { projectId: 'P', evidence: [{}] } });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe('POST /sync-evidence', () => {
  it('mapt geneste camelCase/gps-velden naar het snake_case-payload', async () => {
    mockBuildPayload.mockReturnValueOnce({ evidenceId: 'EV-1' });
    mockPushOne.mockResolvedValueOnce({ success: true });

    await call('post', '/sync-evidence', {
      body: {
        evidenceData: {
          evidenceId: 'EV-1',
          projectId: 'P-1',
          inspectionPointId: 'BP-1',
          mediaUrl: 'http://x/a.jpg',
          exifHash: 'h',
          timestamp: 'ts',
          gps: { latitude: 52, longitude: 4 },
          aiValidationStatus: 'PASSED',
          notes: 'note',
        },
      },
    });

    expect(mockBuildPayload).toHaveBeenCalledWith(
      'P-1',
      expect.objectContaining({
        id: 'EV-1',
        inspection_point_id: 'BP-1',
        photo_uri: 'http://x/a.jpg',
        exif_hash: 'h',
        latitude: 52,
        longitude: 4,
        ai_status: 'PASSED',
        field_note: 'note',
      })
    );
  });

  it('weigert met 400 als de payload incompleet is', async () => {
    mockBuildPayload.mockReturnValueOnce(null);
    const res = await call('post', '/sync-evidence', { body: { projectId: 'P' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPushOne).not.toHaveBeenCalled();
  });

  it('mapt het push-resultaat: success→200, retryPending→503, overig→422', async () => {
    mockBuildPayload.mockReturnValue({ evidenceId: 'x' });

    mockPushOne.mockResolvedValueOnce({ success: true });
    expect((await call('post', '/sync-evidence', { body: {} })).status).toHaveBeenCalledWith(200);

    mockPushOne.mockResolvedValueOnce({ success: false, retryPending: true });
    expect((await call('post', '/sync-evidence', { body: {} })).status).toHaveBeenCalledWith(503);

    mockPushOne.mockResolvedValueOnce({ success: false, retryPending: false });
    expect((await call('post', '/sync-evidence', { body: {} })).status).toHaveBeenCalledWith(422);
  });
});
