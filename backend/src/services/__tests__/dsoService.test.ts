/**
 * Unit-tests voor dsoService — het indienen van STAM-meldingen bij het bevoegd
 * gezag via de Digikoppeling-adapter (DKA). Juridisch/operationeel gevoelig:
 * dit is de officiële bouw-/gereedmelding onder de Wkb.
 *
 * Borgt:
 *   - fail-closed: zonder DKA-config (url/key) wordt er niets verzonden;
 *   - de POST gaat naar de DKA-url met Bearer-auth + timeout uit config;
 *   - accepted = alleen HTTP 200/202; andere statussen → success:false;
 *   - transactionId-resolutie (transactionId → referenceId → referentie → null);
 *   - een netwerk-/adapterfout wordt vertaald naar een generieke STAM-fout;
 *   - bouw- vs. gereedmelding routeren naar het juiste STAM-meldingtype.
 *
 * De echte stamMapper wordt gebruikt (geen mock) zodat de routing zichtbaar is
 * via het MeldingType in de verzonden payload.
 */

const mockPost = jest.fn();
jest.mock('axios', () => ({ post: (...a: unknown[]) => mockPost(...a) }));

const mockConfig: {
  dkaInternalUrl: string;
  dkaInternalApiKey: string;
  dkaTimeoutMs: number;
} = {
  dkaInternalUrl: 'https://dka.intern/stam',
  dkaInternalApiKey: 'dka_key',
  dkaTimeoutMs: 8000,
};
jest.mock('../../config', () => ({ backendConfig: mockConfig }));

const {
  submitMeldingToDSO,
  submitBouwmeldingToDSO,
  submitGereedmeldingToDSO,
} = require('../dsoService');

const project = {
  projectId: 'p-42',
  initiatorDetails: { name: 'Bouwgroep BV', address: 'Voorbeeldstraat 1', email: 'info@bouwgroep.nl' },
  location: { kadastraleAanduiding: 'DHG00-A-1234', coordinates: { lat: 52.07, lng: 4.3 } },
  kwaliteitsborgerId: 'KVK-12345678',
  instrumentId: 'INSTR-GK1',
};
const gereed = { ...project, ingebruiknameDatum: '2026-09-01' };

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.dkaInternalUrl = 'https://dka.intern/stam';
  mockConfig.dkaInternalApiKey = 'dka_key';
  mockConfig.dkaTimeoutMs = 8000;
  mockPost.mockResolvedValue({ status: 200, data: { transactionId: 'tx-1' } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('submitMeldingToDSO', () => {
  it('verzendt niets zonder DKA-config (fail-closed)', async () => {
    mockConfig.dkaInternalApiKey = '';
    await expect(
      submitMeldingToDSO(project, 'https://x/a.pdf', 'https://x/b.pdf', 'bouwmelding')
    ).rejects.toThrow(/STAM integratie gefaald/);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('POST naar de DKA-url met Bearer-auth en timeout', async () => {
    await submitMeldingToDSO(project, 'https://x/a.pdf', 'https://x/b.pdf', 'bouwmelding');
    const [url, payload, opts] = mockPost.mock.calls[0];
    expect(url).toBe('https://dka.intern/stam');
    expect(payload.StamMelding).toBeDefined();
    expect(opts.headers.Authorization).toBe('Bearer dka_key');
    expect(opts.timeout).toBe(8000);
  });

  it('accepteert alleen HTTP 200/202', async () => {
    mockPost.mockResolvedValue({ status: 202, data: {} });
    await expect(
      submitMeldingToDSO(project, 'a', 'b', 'bouwmelding')
    ).resolves.toMatchObject({ success: true, status: 202 });

    mockPost.mockResolvedValue({ status: 500, data: {} });
    await expect(
      submitMeldingToDSO(project, 'a', 'b', 'bouwmelding')
    ).resolves.toMatchObject({ success: false, status: 500 });
  });

  it('valt voor het transactionId terug op referentie', async () => {
    mockPost.mockResolvedValue({ status: 200, data: { referentie: 'ref-9' } });
    const res = await submitMeldingToDSO(project, 'a', 'b', 'bouwmelding');
    expect(res.transactionId).toBe('ref-9');
  });

  it('vertaalt een adapterfout naar een generieke STAM-fout', async () => {
    mockPost.mockRejectedValue(new Error('connection refused'));
    await expect(
      submitMeldingToDSO(project, 'a', 'b', 'bouwmelding')
    ).rejects.toThrow(/STAM integratie gefaald/);
  });
});

describe('routing per meldingtype', () => {
  it('bouwmelding → Bouwmelding_Wkb_GK1', async () => {
    await submitBouwmeldingToDSO(project, 'https://x/borg.pdf', 'https://x/risk.pdf');
    expect(mockPost.mock.calls[0][1].StamMelding.MeldingType).toBe('Bouwmelding_Wkb_GK1');
  });

  it('gereedmelding → Gereedmelding_Wkb_GK1 met geplande ingebruikname', async () => {
    await submitGereedmeldingToDSO(gereed, 'https://x/dossier.pdf', 'https://x/verklaring.pdf');
    const payload = mockPost.mock.calls[0][1].StamMelding;
    expect(payload.MeldingType).toBe('Gereedmelding_Wkb_GK1');
    expect(payload.GeplandeIngebruikname).toBe('2026-09-01');
  });
});
