/**
 * Tests voor de review-route (routes/reviewRoutes.ts):
 * POST /evidence/:evidenceId/status. Deze dunne handler zet de evidenceId om naar
 * een getal, geeft de Authorization-header + body door aan reviewService en mapt
 * fouten op hun statusCode. Een fout hier stuurt de verkeerde reviewer-context
 * mee of geeft een 200 terug waar de service eigenlijk 403/500 bedoelde.
 *
 * We borgen het feitelijke contract:
 *  - geldige call → service krijgt {authorizationHeader, evidenceId(getal), status,
 *    notes}, respons 200 met het service-resultaat;
 *  - een fout met statusCode → diezelfde status + foutboodschap;
 *  - een fout zonder statusCode → 500 met fallback-melding.
 *
 * Geen supertest: handler uit de router-stack, reviewService gemockt.
 */

import type { Request, Response } from 'express';

const mockUpdateStatus = jest.fn();
jest.mock('../../services/reviewService', () => ({
  updateEvidenceReviewStatus: mockUpdateStatus,
}));

const router = require('../reviewRoutes');

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

const handler = () => findHandler('post', '/evidence/:evidenceId/status');

const call = async (req: Partial<Request>) => {
  const res = mockRes();
  await handler()(
    { params: {}, headers: {}, body: {}, ...req } as Request,
    res
  );
  return res;
};

describe('POST /evidence/:evidenceId/status', () => {
  it('geeft de reviewer-context door en antwoordt 200 met het resultaat', async () => {
    const result = { ok: true, status: 'PASSED' };
    mockUpdateStatus.mockResolvedValueOnce(result);

    const res = await call({
      params: { evidenceId: '42' } as any,
      headers: { authorization: 'Bearer token-1' },
      body: { status: 'PASSED', notes: 'akkoord' },
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      authorizationHeader: 'Bearer token-1',
      evidenceId: 42,
      status: 'PASSED',
      notes: 'akkoord',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('mapt een fout met statusCode op diezelfde status', async () => {
    const err: any = new Error('Geen reviewer-rol');
    err.statusCode = 403;
    mockUpdateStatus.mockRejectedValueOnce(err);

    const res = await call({ params: { evidenceId: '7' } as any });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('Geen reviewer-rol');
  });

  it('valt terug op 500 met fallback-melding bij een fout zonder statusCode/message', async () => {
    mockUpdateStatus.mockRejectedValueOnce({});
    const res = await call({ params: { evidenceId: '9' } as any });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('Reviewstatus kon niet worden bijgewerkt.');
  });
});
