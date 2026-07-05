/**
 * Tests voor de AFAS ERP-routes (routes/afasRoutes.ts): GET /projects en
 * POST /book-hours. Beide resolven AFAS-credentials uit header > query > body en
 * delegeren naar afasService. Een fout hier pakt de verkeerde credential-bron,
 * boekt een onvolledige urenregistratie, of mapt een AFAS-weigering verkeerd.
 *
 * We borgen het feitelijke contract:
 *  - credential-precedentie: header wint van query/body;
 *  - GET /projects → fetchAfasProjects met de creds, 200 met count/projects,
 *    environmentId null als die ontbreekt; fout → 500;
 *  - POST /book-hours valideert (projectId/employeeId/date verplicht, hours > 0
 *    en eindig) → 400 anders zonder service-call; true → 200, false → 502 met
 *    RETRY_PENDING.
 *
 * Geen supertest: handler uit de router-stack; afasService gemockt.
 */

import type { Request, Response } from 'express';

const mockFetchProjects = jest.fn();
const mockBookHours = jest.fn();
jest.mock('../../services/afasService', () => ({
  fetchAfasProjects: mockFetchProjects,
  bookAfasHours: mockBookHours,
}));

const router = require('../afasRoutes');

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
    { headers: {}, query: {}, body: {}, ...req } as Request,
    res
  );
  return res;
};

describe('GET /projects', () => {
  it('haalt projecten op met de creds en antwoordt 200 met count/projects', async () => {
    mockFetchProjects.mockResolvedValueOnce([{ id: 'A' }, { id: 'B' }]);

    const res = await call('get', '/projects', {
      headers: { 'x-afas-environment-id': 'ENV-1', 'x-afas-token': 'TOK-1' },
    });

    expect(mockFetchProjects).toHaveBeenCalledWith('ENV-1', 'TOK-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      environmentId: 'ENV-1',
      count: 2,
      projects: [{ id: 'A' }, { id: 'B' }],
    });
  });

  it('laat de header winnen van query/body voor de credentials', async () => {
    mockFetchProjects.mockResolvedValueOnce([]);
    await call('get', '/projects', {
      headers: { 'x-afas-environment-id': 'ENV-HEADER', 'x-afas-token': 'TOK-HEADER' },
      query: { environmentId: 'ENV-QUERY', token: 'TOK-QUERY' } as any,
    });
    expect(mockFetchProjects).toHaveBeenCalledWith('ENV-HEADER', 'TOK-HEADER');
  });

  it('geeft environmentId null terug als die ontbreekt', async () => {
    mockFetchProjects.mockResolvedValueOnce([]);
    const res = await call('get', '/projects', {});
    expect(mockFetchProjects).toHaveBeenCalledWith(undefined, undefined);
    expect(res.json.mock.calls[0][0].environmentId).toBeNull();
  });

  it('mapt een service-fout op 500', async () => {
    mockFetchProjects.mockRejectedValueOnce(new Error('AFAS onbereikbaar'));
    const res = await call('get', '/projects', {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('AFAS onbereikbaar');
  });
});

describe('POST /book-hours', () => {
  const validBody = { projectId: 'P', employeeId: 'E', hours: '4', date: '2026-06-28' };

  it('boekt geldige uren en antwoordt 200', async () => {
    mockBookHours.mockResolvedValueOnce(true);
    const res = await call('post', '/book-hours', {
      headers: { 'x-afas-environment-id': 'ENV', 'x-afas-token': 'TOK' },
      body: validBody,
    });

    expect(mockBookHours).toHaveBeenCalledWith('ENV', 'TOK', 'P', 'E', 4, '2026-06-28');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('weigert met 400 bij ontbrekende velden, zonder service-call', async () => {
    const res = await call('post', '/book-hours', {
      body: { projectId: 'P', hours: '4', date: '2026-06-28' },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockBookHours).not.toHaveBeenCalled();
  });

  it('weigert met 400 bij niet-positieve/niet-numerieke uren', async () => {
    const res1 = await call('post', '/book-hours', { body: { ...validBody, hours: '0' } });
    expect(res1.status).toHaveBeenCalledWith(400);
    const res2 = await call('post', '/book-hours', { body: { ...validBody, hours: 'abc' } });
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(mockBookHours).not.toHaveBeenCalled();
  });

  it('geeft 502 met RETRY_PENDING als AFAS de boeking weigert', async () => {
    mockBookHours.mockResolvedValueOnce(false);
    const res = await call('post', '/book-hours', { body: validBody });
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json.mock.calls[0][0].retryStatus).toBe('RETRY_PENDING');
  });
});
