/**
 * Tests voor de dossier-routes (routes/dossierRoutes.ts): /genereer (Adobe-PDF),
 * /bevoegd-gezag (PDF-download), /consument/status en /consument (download).
 * Deze handlers gaten op requireReviewer, valideren projectId en vertalen het
 * generator-resultaat naar HTTP-statussen + download-headers. Een fout hier mapt
 * een config-staat als serverfout, of mist de PDF-download-headers.
 *
 * We borgen het feitelijke contract:
 *  - lege projectId → 400 (geen generator-call);
 *  - /genereer: ok → 200 met url/path/evidenceCount, skipped → 503, mislukt → 502;
 *  - /bevoegd-gezag: zet PDF-headers + verstuurt de buffer (200);
 *  - /consument/status: 200 met de status;
 *  - /consument: IncompleteConsumerDossierError → statusCode (default 409) met
 *    issues, overige fouten → 500.
 *
 * Geen supertest: laatste handler uit de router-stack (requireReviewer omzeild);
 * middleware + generators gemockt.
 */

import type { Request, Response } from 'express';

const mockBuildDossier = jest.fn();
const mockGenBevoegd = jest.fn();
const mockGenConsumer = jest.fn();
const mockConsumerStatus = jest.fn();
const mockGetContext = jest.fn();
const mockAssertAccess = jest.fn();

class MockIncompleteError extends Error {
  statusCode: number | undefined;
  issues: unknown;
  constructor(message: string, issues?: unknown, statusCode?: number) {
    super(message);
    this.issues = issues;
    this.statusCode = statusCode;
  }
}

jest.mock('../../middleware/requireReviewer', () => ({
  requireReviewer: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../services/authContextService', () => ({
  getAuthenticatedUserContext: mockGetContext,
  assertProjectReviewAccess: mockAssertAccess,
}));
jest.mock('../../services/dossierService', () => ({ buildDossier: mockBuildDossier }));
jest.mock('../../services/dossierGenerator', () => ({
  generateBevoegdGezagDossier: mockGenBevoegd,
}));
jest.mock('../../services/consumerDossierGenerator', () => ({
  generateConsumerDossier: mockGenConsumer,
  getConsumerDossierStatus: mockConsumerStatus,
  IncompleteConsumerDossierError: MockIncompleteError,
}));

const router = require('../dossierRoutes');

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
  res.send = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  return res as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
  };
};

const call = async (method: string, path: string, params: Record<string, unknown> = {}) => {
  const res = mockRes();
  await findHandler(method, path)({ params, headers: {} } as unknown as Request, res);
  return res;
};

// Project-scope slaagt standaard; individuele tests overschrijven met een reject.
beforeEach(() => {
  mockGetContext.mockResolvedValue({ userId: 'u1', role: 'AANNEMER', email: '', companyName: '' });
  mockAssertAccess.mockResolvedValue({ isOwner: true, isQualityAssurer: false });
});

describe('POST /genereer/:projectId', () => {
  const path = '/genereer/:projectId';

  it('weigert met 400 bij lege projectId', async () => {
    const res = await call('post', path, { projectId: '  ' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockBuildDossier).not.toHaveBeenCalled();
  });

  it('antwoordt 200 met url/path/evidenceCount bij succes', async () => {
    mockBuildDossier.mockResolvedValueOnce({
      ok: true,
      url: 'https://x/d.pdf',
      path: 'dossiers/d.pdf',
      evidenceCount: 5,
    });
    const res = await call('post', path, { projectId: 'P-1' });
    expect(mockBuildDossier).toHaveBeenCalledWith('P-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: 'https://x/d.pdf',
      path: 'dossiers/d.pdf',
      evidenceCount: 5,
    });
  });

  it('mapt skipped → 503 en overige mislukking → 502', async () => {
    mockBuildDossier.mockResolvedValueOnce({ ok: false, skipped: true, reason: 'geen Adobe-config' });
    expect((await call('post', path, { projectId: 'P' })).status).toHaveBeenCalledWith(503);

    mockBuildDossier.mockResolvedValueOnce({ ok: false, reason: 'Adobe-fout' });
    expect((await call('post', path, { projectId: 'P' })).status).toHaveBeenCalledWith(502);
  });

  it('mapt een onverwachte fout op 500', async () => {
    mockBuildDossier.mockRejectedValueOnce(new Error('boem'));
    const res = await call('post', path, { projectId: 'P' });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('GET /bevoegd-gezag/:projectId', () => {
  const path = '/bevoegd-gezag/:projectId';

  it('zet PDF-headers en verstuurt de buffer met 200', async () => {
    const buffer = Buffer.from('pdf-bytes');
    mockGenBevoegd.mockResolvedValueOnce(buffer);

    const res = await call('get', path, { projectId: 'P-7' });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Wkb_Dossier_Bevoegd_Gezag_P-7.pdf"'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('mapt een fout op 500', async () => {
    mockGenBevoegd.mockRejectedValueOnce(new Error('pdf stuk'));
    const res = await call('get', path, { projectId: 'P' });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('GET /consument/status/:projectId', () => {
  it('antwoordt 200 met de status', async () => {
    mockConsumerStatus.mockResolvedValueOnce({ complete: false, missing: 2 });
    const res = await call('get', '/consument/status/:projectId', { projectId: 'P-3' });
    expect(mockConsumerStatus).toHaveBeenCalledWith('P-3');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ complete: false, missing: 2 });
  });
});

describe('GET /consument/:projectId — download', () => {
  const path = '/consument/:projectId';

  it('verstuurt de PDF met download-headers', async () => {
    const buffer = Buffer.from('consument');
    mockGenConsumer.mockResolvedValueOnce(buffer);
    const res = await call('get', path, { projectId: 'P-9' });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Wkb_Consumentendossier_P-9.pdf"'
    );
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('mapt IncompleteConsumerDossierError op de statusCode met issues', async () => {
    const err = new MockIncompleteError('Dossier incompleet', ['foto ontbreekt'], 409);
    mockGenConsumer.mockRejectedValueOnce(err);
    const res = await call('get', path, { projectId: 'P' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Dossier incompleet',
      issues: ['foto ontbreekt'],
    });
  });

  it('mapt overige fouten op 500', async () => {
    mockGenConsumer.mockRejectedValueOnce(new Error('iets anders'));
    const res = await call('get', path, { projectId: 'P' });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('project-scope (assertProjectReviewAccess)', () => {
  const httpErr = (statusCode: number, message: string) => {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
  };

  it('weigert met 403 als de gebruiker geen recht op het project heeft', async () => {
    mockAssertAccess.mockRejectedValueOnce(httpErr(403, 'Gebruiker heeft geen rechten op dit project.'));
    const res = await call('get', '/bevoegd-gezag/:projectId', { projectId: 'P-1' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockGenBevoegd).not.toHaveBeenCalled();
  });

  it('weigert met 401 bij een ontbrekend token op /genereer', async () => {
    mockGetContext.mockRejectedValueOnce(httpErr(401, 'Authorization Bearer token ontbreekt.'));
    const res = await call('post', '/genereer/:projectId', { projectId: 'P-1' });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockBuildDossier).not.toHaveBeenCalled();
  });

  it('weigert met 403 op de consument-download', async () => {
    mockAssertAccess.mockRejectedValueOnce(httpErr(403, 'Geen rechten.'));
    const res = await call('get', '/consument/:projectId', { projectId: 'P-1' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockGenConsumer).not.toHaveBeenCalled();
  });
});
