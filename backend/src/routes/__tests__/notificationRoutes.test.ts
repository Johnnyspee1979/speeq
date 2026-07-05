/**
 * Tests voor de notificatie-route (routes/notificationRoutes.ts):
 * POST /register. Deze handler normaliseert de body (trim + defaults), eist een
 * expoPushToken, haalt de gebruiker uit de Authorization-header en slaat het
 * push-abonnement op. Een fout hier registreert een leeg/ongeldig token, koppelt
 * het aan de verkeerde gebruiker, of geeft de verkeerde HTTP-status terug.
 *
 * We borgen het feitelijke contract:
 *  - ontbrekend expoPushToken → 400, GEEN auth-/opslag-call;
 *  - geldige body → token/platform getrimd, lege projectId/deviceLabel → null,
 *    opslag met userId uit de context, respons 200 met success/userId/projectId;
 *  - platform valt terug op 'unknown';
 *  - een fout met statusCode (bv. auth) → diezelfde status + boodschap.
 *
 * Geen supertest: handler uit de router-stack; authContext- en notificatie-
 * service gemockt.
 */

import type { Request, Response } from 'express';

const mockGetContext = jest.fn();
const mockUpsert = jest.fn();
jest.mock('../../services/authContextService', () => ({
  getAuthenticatedUserContext: mockGetContext,
}));
jest.mock('../../services/reviewNotificationService', () => ({
  upsertNotificationSubscription: mockUpsert,
}));

const router = require('../notificationRoutes');

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

const handler = () => findHandler('post', '/register');

const call = async (req: Partial<Request>) => {
  const res = mockRes();
  await handler()({ headers: {}, body: {}, ...req } as Request, res);
  return res;
};

describe('POST /register', () => {
  it('weigert met 400 als expoPushToken ontbreekt en belt geen service', async () => {
    const res = await call({ body: { platform: 'ios' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGetContext).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('trimt velden, koppelt aan de context-gebruiker en antwoordt 200', async () => {
    mockGetContext.mockResolvedValueOnce({ userId: 'u-1' });
    mockUpsert.mockResolvedValueOnce(undefined);

    const res = await call({
      headers: { authorization: 'Bearer t' },
      body: {
        expoPushToken: '  ExpoTok  ',
        platform: ' android ',
        projectId: ' P-1 ',
        deviceLabel: ' Pixel ',
      },
    });

    expect(mockGetContext).toHaveBeenCalledWith('Bearer t');
    expect(mockUpsert).toHaveBeenCalledWith({
      userId: 'u-1',
      projectId: 'P-1',
      expoPushToken: 'ExpoTok',
      platform: 'android',
      deviceLabel: 'Pixel',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      userId: 'u-1',
      projectId: 'P-1',
    });
  });

  it('gebruikt defaults: platform "unknown", lege projectId/deviceLabel → null', async () => {
    mockGetContext.mockResolvedValueOnce({ userId: 'u-2' });
    mockUpsert.mockResolvedValueOnce(undefined);

    const res = await call({ body: { expoPushToken: 'tok' } });

    expect(mockUpsert).toHaveBeenCalledWith({
      userId: 'u-2',
      projectId: null,
      expoPushToken: 'tok',
      platform: 'unknown',
      deviceLabel: null,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      userId: 'u-2',
      projectId: null,
    });
  });

  it('mapt een auth-fout met statusCode op diezelfde status', async () => {
    const err: any = new Error('Niet ingelogd');
    err.statusCode = 401;
    mockGetContext.mockRejectedValueOnce(err);

    const res = await call({ body: { expoPushToken: 'tok' } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('Niet ingelogd');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
