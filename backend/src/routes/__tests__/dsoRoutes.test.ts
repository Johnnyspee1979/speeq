/**
 * Tests voor de DSO/STAM-routes (routes/dsoRoutes.ts): POST /bouwmelding/:projectId
 * en POST /gereedmelding/:projectId. Deze handlers bewaken de wettelijke Wkb-
 * termijnen (bouwmelding ≥4 weken vóór start, gereedmelding ≥2 weken vóór
 * ingebruikname), halen het project uit Supabase, normaliseren de verplichte
 * STAM-velden en delegeren naar dsoService. Een fout hier dient te laat in
 * (Wkb-overtreding), stuurt onvolledig bewijs naar Digikoppeling, of mapt een
 * weigering verkeerd.
 *
 * We borgen het feitelijke contract:
 *  - lege projectId / lege of ongeldige datum → 400 (geen submit);
 *  - termijn-overtreding (start <28d / ingebruikname <14d) → 400 (geen submit);
 *  - project niet gevonden → 404;
 *  - ontbrekende STAM-velden of document-URL's → 400 met missingFields;
 *  - succes → 202 met transactionId; adapter-weigering → 502; exceptie → 500.
 *
 * Datums: ver-toekomstig ('2099-01-01') voor geldige paden (altijd binnen de
 * termijn), verleden ('2020-01-01') voor de overtredings-tak (altijd te laat) —
 * zo blijven de tests tijd-onafhankelijk.
 *
 * Geen supertest: laatste handler uit de router-stack; supabase/config/dsoService
 * gemockt; date-fns blijft echt.
 */

import type { Request, Response } from 'express';

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

const mockHasSupabaseConfig = jest.fn(() => true);
jest.mock('../../config', () => ({
  backendConfig: { supabaseUrl: 'su', supabaseServiceKey: 'sk' },
  hasSupabaseConfig: mockHasSupabaseConfig,
}));

const mockSubmitBouw = jest.fn();
const mockSubmitGereed = jest.fn();
jest.mock('../../services/dsoService', () => ({
  submitBouwmeldingToDSO: mockSubmitBouw,
  submitGereedmeldingToDSO: mockSubmitGereed,
}));

// Per-test instelbaar Supabase-leesresultaat (geldt voor beide tabel-pogingen).
let nextSingle: { data: unknown; error: unknown } = { data: null, error: null };

const makeChain = () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => Promise.resolve(nextSingle));
  // Maakt de update-tak (.update().eq()) awaitbaar → { error: null }.
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: null });
  return chain;
};

mockCreateClient.mockReturnValue({ from: jest.fn(() => makeChain()) });

const router = require('../dsoRoutes');

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

const call = async (
  path: string,
  params: Record<string, unknown>,
  body: Record<string, unknown> = {}
) => {
  const res = mockRes();
  await findHandler('post', path)({ params, body } as unknown as Request, res);
  return res;
};

// Volledig STAM-compleet project (snake_case), incl. document-URL's voor beide takken.
const fullRow = {
  id: 'P-1',
  initiator_name: 'Bouwer BV',
  address: 'Straat 1',
  email: 'info@bouwer.nl',
  kadastrale_aanduiding: 'ABC-123',
  latitude: 52.1,
  longitude: 4.3,
  kwaliteitsborger_id: 'KB-1',
  instrument_id: 'INS-1',
  borgingsplan_url: 'http://x/plan.pdf',
  risicobeoordeling_url: 'http://x/risk.pdf',
  dossier_bevoegd_gezag_url: 'http://x/dossier.pdf',
  verklaring_kwaliteitsborger_url: 'http://x/verklaring.pdf',
};

const FUTURE = '2099-01-01'; // ruim binnen elke termijn
const PAST = '2020-01-01'; // altijd te laat (overtreding)

beforeEach(() => {
  nextSingle = { data: null, error: null };
});

describe('POST /bouwmelding/:projectId', () => {
  const path = '/bouwmelding/:projectId';

  it('weigert met 400 bij lege projectId', async () => {
    const res = await call(path, { projectId: '  ' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('weigert met 400 bij ontbrekende of ongeldige startdatum', async () => {
    const leeg = await call(path, { projectId: 'P-1' }, {});
    expect(leeg.status).toHaveBeenCalledWith(400);

    const ongeldig = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: 'kapot' });
    expect(ongeldig.status).toHaveBeenCalledWith(400);
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('weigert met 400 (Wkb-overtreding) als de start binnen 4 weken valt', async () => {
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: PAST });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('Wkb-overtreding');
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('antwoordt 404 als het project niet bestaat', async () => {
    nextSingle = { data: null, error: null };
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('weigert met 400 + missingFields als STAM-velden ontbreken', async () => {
    nextSingle = { data: { id: 'P-1', initiator_name: 'Bouwer BV' }, error: null };
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Array.isArray(res.json.mock.calls[0][0].missingFields)).toBe(true);
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('weigert met 400 als borgingsplan/risico-URL ontbreekt', async () => {
    const { borgingsplan_url, risicobeoordeling_url, ...zonderUrls } = fullRow;
    nextSingle = { data: zonderUrls, error: null };
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].missingFields).toEqual(
      expect.arrayContaining(['borgingsplanUrl', 'risicoUrl'])
    );
    expect(mockSubmitBouw).not.toHaveBeenCalled();
  });

  it('dient in en antwoordt 202 met transactionId bij succes', async () => {
    nextSingle = { data: fullRow, error: null };
    mockSubmitBouw.mockResolvedValueOnce({ success: true, transactionId: 'TX-1', status: 'ACCEPTED' });

    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });

    expect(mockSubmitBouw).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'P-1',
        initiatorDetails: { name: 'Bouwer BV', address: 'Straat 1', email: 'info@bouwer.nl' },
        location: { kadastraleAanduiding: 'ABC-123', coordinates: { lat: 52.1, lng: 4.3 } },
        kwaliteitsborgerId: 'KB-1',
        instrumentId: 'INS-1',
      }),
      'http://x/plan.pdf',
      'http://x/risk.pdf'
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json.mock.calls[0][0].transactionId).toBe('TX-1');
  });

  it('mapt een adapter-weigering op 502', async () => {
    nextSingle = { data: fullRow, error: null };
    mockSubmitBouw.mockResolvedValueOnce({ success: false, status: 'REJECTED' });
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('mapt een leesfout op 500', async () => {
    nextSingle = { data: null, error: { message: 'verbinding verbroken' } };
    const res = await call(path, { projectId: 'P-1' }, { verwachteStartDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('POST /gereedmelding/:projectId', () => {
  const path = '/gereedmelding/:projectId';

  it('weigert met 400 bij ontbrekende ingebruiknamedatum', async () => {
    const res = await call(path, { projectId: 'P-1' }, {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSubmitGereed).not.toHaveBeenCalled();
  });

  it('weigert met 400 (Wkb-overtreding) als ingebruikname binnen 2 weken valt', async () => {
    const res = await call(path, { projectId: 'P-1' }, { ingebruiknameDatum: PAST });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('Wkb-overtreding');
    expect(mockSubmitGereed).not.toHaveBeenCalled();
  });

  it('weigert met 400 als dossier/verklaring-URL ontbreekt', async () => {
    const { dossier_bevoegd_gezag_url, verklaring_kwaliteitsborger_url, ...zonderUrls } = fullRow;
    nextSingle = { data: zonderUrls, error: null };
    const res = await call(path, { projectId: 'P-1' }, { ingebruiknameDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].missingFields).toEqual(
      expect.arrayContaining(['dossierBevoegdGezagUrl', 'verklaringKwaliteitsborgerUrl'])
    );
  });

  it('dient in en antwoordt 202 met transactionId bij succes', async () => {
    nextSingle = { data: fullRow, error: null };
    mockSubmitGereed.mockResolvedValueOnce({ success: true, transactionId: 'TX-2', status: 'ACCEPTED' });

    const res = await call(path, { projectId: 'P-1' }, { ingebruiknameDatum: FUTURE });

    expect(mockSubmitGereed).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'P-1', ingebruiknameDatum: FUTURE }),
      'http://x/dossier.pdf',
      'http://x/verklaring.pdf'
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json.mock.calls[0][0].transactionId).toBe('TX-2');
  });

  it('mapt een adapter-weigering op 502', async () => {
    nextSingle = { data: fullRow, error: null };
    mockSubmitGereed.mockResolvedValueOnce({ success: false, status: 'REJECTED' });
    const res = await call(path, { projectId: 'P-1' }, { ingebruiknameDatum: FUTURE });
    expect(res.status).toHaveBeenCalledWith(502);
  });
});
