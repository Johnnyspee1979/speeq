/**
 * Tests voor de Adobe-dossiermotor (dossierService.buildDossier).
 *
 * Alle externe afhankelijkheden zijn gemockt: Supabase (DB + Storage), de Adobe
 * Document Generation SDK en de foto-download (fetch). We toetsen de garanties
 * uit de bouwopdracht:
 *   - zonder Adobe-config wordt netjes overgeslagen (skipped)
 *   - happy path: PDF geüpload met nieuwe timestamp + dossier_url teruggeschreven
 *   - Adobe-storing: geen upload (oud dossier blijft staan), nette fout
 *   - ontbrekend sjabloon: nette fout
 */

// ── Muteerbare mock-state (mag in jest.mock-factory via 'mock'-prefix) ───────
let mockAdobeAvailable = true;
let mockAdobeShouldFail = false;
let mockSupabaseClient: any;

jest.mock('../../config', () => ({
  backendConfig: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'service-key',
    dossierTemplateBucket: 'dossier-templates',
    dossierTemplatePath: 'dossier-sjabloon.docx',
    dossierBucket: 'dossiers',
    pdfServicesClientId: 'client-id',
    pdfServicesClientSecret: 'client-secret',
  },
  hasSupabaseConfig: () => true,
  hasAdobeConfig: () => mockAdobeAvailable,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@adobe/pdfservices-node-sdk', () => {
  const { Readable } = require('stream');
  return {
    ServicePrincipalCredentials: class {
      constructor(_opts: any) {}
    },
    PDFServices: class {
      constructor(_opts: any) {}
      async upload() {
        return { name: 'input-asset' };
      }
      async submit() {
        if (mockAdobeShouldFail) {
          throw new Error('Adobe 503 Service Unavailable');
        }
        return 'polling-url';
      }
      async getJobResult() {
        return { result: { asset: { name: 'output-asset' } } };
      }
      async getContent() {
        return { readStream: Readable.from(Buffer.from('%PDF-1.7 fake pdf')) };
      }
    },
    MimeType: { DOCX: 'docx' },
    DocumentMergeParams: class {
      constructor(_opts: any) {}
    },
    OutputFormat: { PDF: 'pdf' },
    DocumentMergeJob: class {
      constructor(_opts: any) {}
    },
    DocumentMergeResult: class {},
  };
}, { virtual: true });

// ── Supabase-mockbouwer ──────────────────────────────────────────────────────

type MockOptions = {
  project?: any;
  evidence?: any[];
  templateError?: { message: string } | null;
  uploadError?: { message: string } | null;
};

const buildSupabaseMock = (opts: MockOptions) => {
  const uploadFn = jest.fn(async () => ({ error: opts.uploadError ?? null }));
  const updateEqFn = jest.fn(async () => ({ error: null }));
  const updateFn = jest.fn(() => ({ eq: updateEqFn }));
  const getPublicUrlFn = jest.fn((path: string) => ({
    data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/dossiers/${path}` },
  }));
  const createSignedUrlFn = jest.fn(async (path: string) => ({
    data: { signedUrl: `https://example.supabase.co/storage/v1/object/sign/dossiers/${path}?token=abc` },
    error: null,
  }));
  const downloadFn = jest.fn(async () => {
    if (opts.templateError) return { data: null, error: opts.templateError };
    return {
      data: { arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer },
      error: null,
    };
  });

  const from = jest.fn((table: string) => {
    if (table === 'evidence') {
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              order: async () => ({ data: opts.evidence ?? [], error: null }),
            }),
          }),
        }),
      };
    }
    // 'projects' — zowel select (maybeSingle) als update.
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: opts.project ?? null, error: null }),
        }),
      }),
      update: updateFn,
    };
  });

  return {
    client: {
      from,
      storage: {
        from: jest.fn(() => ({
          download: downloadFn,
          upload: uploadFn,
          getPublicUrl: getPublicUrlFn,
          createSignedUrl: createSignedUrlFn,
        })),
      },
    },
    spies: { uploadFn, updateFn, updateEqFn, getPublicUrlFn, createSignedUrlFn, downloadFn, from },
  };
};

const sampleEvidence = [
  {
    id: 1,
    field_note: 'Wapening fundering',
    timestamp: '2026-05-28T09:14:00.000Z',
    latitude: 52.07,
    longitude: 4.3,
    gps_accuracy: 4,
    ai_status: 'APPROVED',
    media_uri: 'https://example.supabase.co/storage/v1/object/public/wkb-evidence/p1/e1.jpg',
  },
  {
    id: 2,
    field_note: 'Kozijn detail',
    timestamp: '2026-05-29T11:00:00.000Z',
    latitude: 52.08,
    longitude: 4.31,
    gps_accuracy: 6,
    ai_status: 'PASSED',
    photo_uri: 'https://example.supabase.co/storage/v1/object/public/wkb-evidence/p1/e2.jpg',
  },
];

describe('dossierService.buildDossier', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAdobeAvailable = true;
    mockAdobeShouldFail = false;
    // fetch voor foto-download: levert altijd een mini-afbeelding.
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
    }));
  });

  it('slaat over (skipped) als Adobe-credentials ontbreken', async () => {
    mockAdobeAvailable = false;
    const mock = buildSupabaseMock({ project: { id: 'p1' }, evidence: sampleEvidence });
    mockSupabaseClient = mock.client;

    const { buildDossier } = require('../dossierService');
    const result = await buildDossier('p1');

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(mock.spies.from).not.toHaveBeenCalled();
  });

  it('genereert een dossier en schrijft dossier_url terug (happy path)', async () => {
    const mock = buildSupabaseMock({
      project: { id: 'p1', name: 'Vinkenstraat 12', address: 'Den Haag', initiator_name: 'De Vries B.V.' },
      evidence: sampleEvidence,
    });
    mockSupabaseClient = mock.client;

    const { buildDossier } = require('../dossierService');
    const result = await buildDossier('p1');

    expect(result.ok).toBe(true);
    expect(result.evidenceCount).toBe(2);
    expect(result.path).toMatch(/^p1\/dossier-.*\.pdf$/);
    expect(result.url).toContain('/dossiers/p1/dossier-');

    // PDF geüpload als application/pdf, niet overschrijvend.
    expect(mock.spies.uploadFn).toHaveBeenCalledTimes(1);
    const uploadCall = mock.spies.uploadFn.mock.calls[0] as any[];
    expect(uploadCall[2]).toMatchObject({ contentType: 'application/pdf', upsert: false });

    // Het PAD (niet een publieke URL) wordt teruggeschreven naar het project.
    expect(mock.spies.updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ dossier_url: expect.stringMatching(/^p1\/dossier-.*\.pdf$/) })
    );
  });

  it('laat het oude dossier staan bij een Adobe-storing (geen upload)', async () => {
    mockAdobeShouldFail = true;
    const mock = buildSupabaseMock({ project: { id: 'p1' }, evidence: sampleEvidence });
    mockSupabaseClient = mock.client;

    const { buildDossier } = require('../dossierService');
    const result = await buildDossier('p1');

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Adobe/i);
    // Cruciaal: geen upload en geen URL-update → oud dossier intact.
    expect(mock.spies.uploadFn).not.toHaveBeenCalled();
    expect(mock.spies.updateFn).not.toHaveBeenCalled();
  });

  it('faalt netjes als het Word-sjabloon ontbreekt', async () => {
    const mock = buildSupabaseMock({
      project: { id: 'p1' },
      evidence: sampleEvidence,
      templateError: { message: 'Object not found' },
    });
    mockSupabaseClient = mock.client;

    const { buildDossier } = require('../dossierService');
    const result = await buildDossier('p1');

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sjabloon/i);
    expect(mock.spies.uploadFn).not.toHaveBeenCalled();
  });

  it('weigert een lege projectId', async () => {
    mockSupabaseClient = buildSupabaseMock({}).client;
    const { buildDossier } = require('../dossierService');
    const result = await buildDossier('   ');
    expect(result.ok).toBe(false);
  });
});
