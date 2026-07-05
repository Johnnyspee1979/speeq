/**
 * Tests voor de DSO/Digikoppeling-adapter (dso/adapter.ts).
 *
 * submitToDSO bouwt het STAM-bericht en POST't het naar de Digikoppeling-adapter;
 * fetchDsoStatus geeft de laatst bekende status terug uit een module-lokale Map.
 * Een fout hier dient een melding zonder verklaring in, mist de juiste referentie
 * of laat een status-opvraag de verkeerde toestand teruggeven.
 *
 * We borgen het feitelijke contract:
 *  - ontbrekende verklaring_akkoord → meteen REJECTED, GEEN netwerk-call;
 *  - ontbrekende config (geen url/key) → REJECTED met netwerkfout-melding;
 *  - succesvolle POST → success, referentie uit de fallback-keten
 *    (referentie > referenceId > id > DSO-<ts>), status genormaliseerd;
 *  - onbekende status uit de adapter → 'ACCEPTED';
 *  - na een geslaagde submit kent fetchDsoStatus diezelfde referentie;
 *  - onbekende referentie → UNKNOWN met uitleg.
 *
 * axios is gemockt → geen echt netwerk. CommonJS-module → require.
 */

jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const { submitToDSO, fetchDsoStatus } = require('../adapter');

const basePayload = {
  projectReferentie: 'P-1',
  kwaliteitsborgerId: 'KB-1',
  typeMelding: 'GEREEDMELDING' as const,
  bewijslast: [],
  verklaringAkkoord: true,
};

describe('submitToDSO — weigeringen zonder netwerk', () => {
  it('weigert direct zonder verklaring_akkoord en doet geen POST', async () => {
    const out = await submitToDSO({ ...basePayload, verklaringAkkoord: false });
    expect(out).toEqual({
      success: false,
      status: 'REJECTED',
      foutmelding: expect.stringContaining('Verklaring'),
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('weigert met netwerkfout-melding als de Digikoppeling-config ontbreekt', async () => {
    delete process.env.DIGIKOPPELING_API_URL;
    delete process.env.DSO_ADAPTER_URL;
    delete process.env.DIGIKOPPELING_API_KEY;
    delete process.env.DSO_ADAPTER_CLIENT_ID;

    const out = await submitToDSO(basePayload);
    expect(out.success).toBe(false);
    expect(out.status).toBe('REJECTED');
    expect(out.foutmelding).toBe('Netwerkfout bij bereiken van Digikoppeling.');
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('submitToDSO — geslaagde indiening', () => {
  beforeEach(() => {
    process.env.DIGIKOPPELING_API_URL = 'https://adapter.example/stam';
    process.env.DIGIKOPPELING_API_KEY = 'secret-key';
  });

  it('POST naar de adapter-url met Bearer-token en geeft referentie + status terug', async () => {
    axios.post.mockResolvedValueOnce({
      data: { referentie: 'DSO-REF-9', status: 'PROCESSING' },
    });

    const out = await submitToDSO(basePayload);
    expect(out).toEqual({
      success: true,
      dsoReferentieId: 'DSO-REF-9',
      status: 'PROCESSING',
    });

    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe('https://adapter.example/stam');
    expect(body.stamBericht).toBe(basePayload);
    expect(typeof body.timestamp).toBe('string');
    expect(options.headers.Authorization).toBe('Bearer secret-key');
    expect(options.headers['X-Wkb-Software-Id']).toBe('SnapSyncApp-v1');
  });

  it('normaliseert een onbekende status naar ACCEPTED', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'X-1', status: 'IETS-RAARS' } });
    const out = await submitToDSO(basePayload);
    expect(out.dsoReferentieId).toBe('X-1');
    expect(out.status).toBe('ACCEPTED');
  });

  it('valt voor de referentie terug op DSO-<timestamp> als de adapter er geen teruggeeft', async () => {
    axios.post.mockResolvedValueOnce({ data: { status: 'QUEUED' } });
    const out = await submitToDSO(basePayload);
    expect(out.dsoReferentieId).toMatch(/^DSO-\d+$/);
    expect(out.status).toBe('QUEUED');
  });

  it('geeft REJECTED met servermelding als de adapter een fout teruggeeft', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { message: 'Ongeldig bericht' } } });
    const out = await submitToDSO(basePayload);
    expect(out).toEqual({
      success: false,
      status: 'REJECTED',
      foutmelding: 'Ongeldig bericht',
    });
  });
});

describe('fetchDsoStatus', () => {
  beforeEach(() => {
    process.env.DIGIKOPPELING_API_URL = 'https://adapter.example/stam';
    process.env.DIGIKOPPELING_API_KEY = 'secret-key';
  });

  it('kent na een geslaagde submit dezelfde referentie en status terug', async () => {
    axios.post.mockResolvedValueOnce({
      data: { referentie: 'DSO-ROUNDTRIP', status: 'ACCEPTED' },
    });
    await submitToDSO(basePayload);

    const status = await fetchDsoStatus('DSO-ROUNDTRIP');
    expect(status).toEqual({
      success: true,
      dsoReferentieId: 'DSO-ROUNDTRIP',
      status: 'ACCEPTED',
    });
  });

  it('geeft UNKNOWN terug voor een onbekende referentie', async () => {
    const status = await fetchDsoStatus('NIET-BESTAAND');
    expect(status.success).toBe(false);
    expect(status.status).toBe('UNKNOWN');
    expect(status.dsoReferentieId).toBe('NIET-BESTAAND');
    expect(status.foutmelding).toContain('Geen lokale status');
  });
});
