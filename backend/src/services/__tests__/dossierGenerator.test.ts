/**
 * Unit-tests voor dossierGenerator — de PDF-bouwers voor het Dossier Bevoegd
 * Gezag (Wkb GK1) en het Consumentendossier (art. 7:757a BW / NPR 8092).
 * Juridisch gevoelig: alleen goedgekeurd bewijs hoort in het bevoegd-gezag-
 * dossier, en bij ontbrekend bewijs moet dat expliciet vermeld worden.
 *
 * We mocken pdfmake (vangen de document-definitie), Supabase en de consumenten-
 * context, en borgen:
 *   - generateBevoegdGezagDossier: query op APPROVED/PASSED, één bewijsblok per
 *     rij, fallback-tekst zonder bewijs, projectId in de PDF-titel, Buffer-out,
 *     en doorvertaalde Supabase-fout;
 *   - generateConsumentendossier: bouwt op de server-side context en levert een
 *     Buffer met de juiste consumentendossier-titel.
 */

const mockCreatePdf = jest.fn((..._a: unknown[]) => ({
  getBuffer: () => Promise.resolve(Buffer.from('pdf-bytes')),
}));
jest.mock('pdfmake', () => ({
  addFonts: jest.fn(),
  createPdf: (...a: unknown[]) => mockCreatePdf(...a),
}));

jest.mock('dotenv', () => ({ config: () => undefined }));

let mockEvidenceResult: { data: unknown[]; error: { message: string } | null } = {
  data: [],
  error: null,
};
let mockProjectResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};

const builder: any = {
  select: () => builder,
  eq: () => builder,
  in: () => builder,
  order: () => Promise.resolve(mockEvidenceResult),
  maybeSingle: () => Promise.resolve(mockProjectResult),
};
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => builder }),
}));

const mockConfig = { supabaseUrl: 'https://db.x', supabaseServiceKey: 'svc' };
jest.mock('../../config', () => ({
  backendConfig: mockConfig,
  hasSupabaseConfig: () => true,
}));

const mockLoadContext = jest.fn();
jest.mock('../consumerDossierContext', () => ({
  loadConsumerDossierContext: (...a: unknown[]) => mockLoadContext(...a),
}));

const { generateBevoegdGezagDossier, generateConsumentendossier } = require('../dossierGenerator');

const lastDocDef = () => mockCreatePdf.mock.calls[mockCreatePdf.mock.calls.length - 1]![0] as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockEvidenceResult = { data: [], error: null };
  mockProjectResult = { data: null, error: null };
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('generateBevoegdGezagDossier', () => {
  it('bouwt één bewijsblok per goedgekeurde rij en zet projectId in de titel', async () => {
    mockEvidenceResult = {
      data: [
        { inspection_point_id: 'WAPENING-1', ai_status: 'APPROVED', timestamp: '2026-05-01T10:00:00Z' },
        { inspection_point_id: 'WAPENING-2', ai_status: 'PASSED', timestamp: '2026-05-02T10:00:00Z' },
      ],
      error: null,
    };
    const buf = await generateBevoegdGezagDossier('p-42');
    expect(Buffer.isBuffer(buf)).toBe(true);

    const doc = lastDocDef();
    const json = JSON.stringify(doc.content);
    expect(json).toContain('Bewijsstuk 1');
    expect(json).toContain('Bewijsstuk 2');
    expect(doc.info.title).toContain('p-42');
  });

  it('vermeldt expliciet als er geen goedgekeurd bewijs is', async () => {
    mockEvidenceResult = { data: [], error: null };
    await generateBevoegdGezagDossier('p-leeg');
    const json = JSON.stringify(lastDocDef().content);
    expect(json).toContain('Geen goedgekeurde bewijslast gevonden');
  });

  it('vertaalt een Supabase-fout door', async () => {
    mockEvidenceResult = { data: [], error: { message: 'connection lost' } };
    await expect(generateBevoegdGezagDossier('p-err')).rejects.toThrow(
      /Supabase Database fout bij ophalen bewijs/
    );
  });
});

describe('generateConsumentendossier', () => {
  it('bouwt het consumentendossier uit de server-side context', async () => {
    mockLoadContext.mockResolvedValue({
      project: { name: 'Woning Spee', address: 'Voorbeeldstraat 1' },
      readyConsumerEvidence: [
        { inspection_point_id: 'GEVEL-1', timestamp: '2026-05-01T10:00:00Z', ai_status: 'APPROVED' },
      ],
      rejectedConsumerEvidence: [],
      documentRows: [],
      status: {
        ready: true,
        issues: [],
        metrics: {
          consumerRelevantEvidenceCount: 1,
          rejectedConsumerEvidenceCount: 0,
          latestConsumerEvidenceAt: null,
        },
        checklists: {
          punchlist: { checkedCount: 1, requiredCount: 1, complete: true },
          gereedmelding: { checkedCount: 1, requiredCount: 1, complete: true },
          consumerDossier: { checkedCount: 1, requiredCount: 1, complete: true },
        },
        documents: { completedCount: 0, requiredCount: 0, complete: true },
      },
    });

    const buf = await generateConsumentendossier('p-77');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(mockLoadContext).toHaveBeenCalledWith('p-77');

    const doc = lastDocDef();
    expect(doc.info.title).toContain('Consumentendossier');
    expect(JSON.stringify(doc.content)).toContain('Controlepunt 1');
  });
});
