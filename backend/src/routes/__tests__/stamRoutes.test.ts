/**
 * Tests voor de STAM-routes (routes/stamRoutes.ts): POST /bouwmelding en
 * /gereedmelding. Deze dunne handlers valideren de body en delegeren naar
 * dsoService. Een fout hier laat een onvolledige melding door, of mapt het
 * resultaat naar de verkeerde HTTP-status (202 geaccepteerd vs 502 mislukt).
 *
 * We borgen het feitelijke contract:
 *  - ontbrekende/lege verplichte velden → 400 met NL-foutmelding, GEEN service-call;
 *  - geldige body → service-call met de juiste argumenten, 202 bij success,
 *    502 bij !success;
 *  - service-exception → 500 met de foutboodschap;
 *  - /gereedmelding valt voor de url's terug op de bouwmelding-velden.
 *
 * Geen supertest: we halen de handler uit de router-stack en roepen 'm aan met
 * een nep-req/res. dsoService is gemockt → geen echte DSO-call.
 */

import type { Request, Response } from 'express';

const mockSubmitBouw = jest.fn();
const mockSubmitGereed = jest.fn();
jest.mock('../../services/dsoService', () => ({
  submitBouwmeldingToDSO: mockSubmitBouw,
  submitGereedmeldingToDSO: mockSubmitGereed,
}));

const router = require('../stamRoutes');

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

const call = async (handler: Handler, body: unknown) => {
  const res = mockRes();
  await handler({ body } as Request, res);
  return res;
};

const validBouw = {
  projectData: { id: 'P-1' },
  borgingsplanUrl: 'https://x/borging.pdf',
  risicoUrl: 'https://x/risico.pdf',
};

describe('POST /bouwmelding', () => {
  const handler = () => findHandler('post', '/bouwmelding');

  it('weigert met 400 bij ontbrekende velden en belt de service niet', async () => {
    const res = await call(handler(), { projectData: { id: 'P' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('verplicht');
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('weigert met 400 als een url leeg/whitespace is', async () => {
    const res = await call(handler(), { ...validBouw, risicoUrl: '   ' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('delegeert naar de service en geeft 202 bij success', async () => {
    const result = { success: true, dsoReferentieId: 'DSO-1' };
    mockSubmitBouw.mockResolvedValueOnce(result);

    const res = await call(handler(), validBouw);
    expect(mockSubmitBouw).toHaveBeenCalledWith(
      validBouw.projectData,
      validBouw.borgingsplanUrl,
      validBouw.risicoUrl
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('geeft 502 als de service !success teruggeeft', async () => {
    mockSubmitBouw.mockResolvedValueOnce({ success: false });
    const res = await call(handler(), validBouw);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('geeft 500 met foutboodschap als de service gooit', async () => {
    mockSubmitBouw.mockRejectedValueOnce(new Error('boem'));
    const res = await call(handler(), validBouw);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('boem');
  });
});

describe('POST /gereedmelding', () => {
  const handler = () => findHandler('post', '/gereedmelding');

  it('valt voor de url\'s terug op de bouwmelding-velden en geeft 202', async () => {
    mockSubmitGereed.mockResolvedValueOnce({ success: true });
    const res = await call(handler(), {
      projectData: { id: 'P-2' },
      borgingsplanUrl: 'https://x/dossier.pdf',
      risicoUrl: 'https://x/verklaring.pdf',
    });

    expect(mockSubmitGereed).toHaveBeenCalledWith(
      { id: 'P-2' },
      'https://x/dossier.pdf',
      'https://x/verklaring.pdf'
    );
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('weigert met 400 bij ontbrekende velden', async () => {
    const res = await call(handler(), { projectData: { id: 'P' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSubmitGereed).not.toHaveBeenCalled();
  });
});
