const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

jest.mock('../../config', () => ({
  backendConfig: {
    supabaseUrl: 'https://supabase.example.com',
    supabaseServiceKey: 'service-key',
  },
  hasSupabaseConfig: () => true,
}));
const { getConsumerDossierStatus } = require('../consumerDossierContext');

type TableResponse = {
  maybeSingle?: { data: unknown; error: null | { message: string } };
  order?: { data: unknown; error: null | { message: string } };
};

const tableResponses: Record<string, TableResponse> = {};

const buildSupabaseMock = () => ({
  from: jest.fn((table: string) => {
    const response = tableResponses[table] ?? {};

    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(
        response.maybeSingle ?? { data: null, error: null }
      ),
      order: jest.fn().mockResolvedValue(response.order ?? { data: [], error: null }),
    };
  }),
});

const createChecklistRows = () => [
  ...['p1', 'p2', 'p3', 'p4', 'p5'].map((itemId) => ({
    project_id: '104A',
    checklist_type: 'PUNCHLIST',
    item_id: itemId,
    title: itemId,
    checked: true,
    updated_at: '2026-03-15T09:00:00.000Z',
  })),
  ...['cd_1', 'cd_2', 'cd_3', 'cd_4', 'cd_5', 'cd_6', 'cd_7'].map((itemId) => ({
    project_id: '104A',
    checklist_type: 'CONSUMER_DOSSIER',
    item_id: itemId,
    title: itemId,
    checked: true,
    updated_at: '2026-03-15T09:00:00.000Z',
  })),
];

const createDocumentRows = () => [
  {
    document_id: 'cdd_1',
    requirement_id: 'cd_1',
    title: 'As-built tekeningen en installaties',
    category: 'AS_BUILT',
    reference_value: 'Revisieset woning type A',
    notes: 'Servermap revisie/2026-03-15',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_2',
    requirement_id: 'cd_2',
    title: 'Materialen, kleurcodes en installaties',
    category: 'MATERIALS',
    reference_value: 'Materialenstaat A',
    notes: 'RAL 9010 / kozijnen standaard',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_3',
    requirement_id: 'cd_3',
    title: 'Gebruiksfuncties en ruimtetoelichting',
    category: 'USAGE_FUNCTIONS',
    reference_value: 'Ruimteboek woning',
    notes: 'Plattegrond met gebruiksfuncties',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_4',
    requirement_id: 'cd_4',
    title: 'Handleidingen installaties',
    category: 'MANUALS',
    reference_value: 'https://example.com/manuals.pdf',
    notes: 'Warmtepomp en WTW',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_5',
    requirement_id: 'cd_5',
    title: 'Onderhoudsvoorschriften',
    category: 'MAINTENANCE',
    reference_value: 'Onderhoudsboek A',
    notes: 'Dak en gevel onderhoud',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_6',
    requirement_id: 'cd_6',
    title: 'Garantiebewijzen en termijnen',
    category: 'WARRANTIES',
    reference_value: 'Garantiedossier installaties',
    notes: 'Fabrieksgarantie toegevoegd',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
  {
    document_id: 'cdd_7',
    requirement_id: 'cd_7',
    title: 'Contractuele afwijkingen of standaardset',
    category: 'CONTRACT_DEVIATIONS',
    reference_value: '',
    notes: 'Geen afwijkingen overeengekomen; standaardset NPR 8092 van toepassing.',
    updated_at: '2026-03-15T09:00:00.000Z',
  },
];

describe('consumerDossierContext', () => {
  beforeEach(() => {
    Object.keys(tableResponses).forEach((key) => delete tableResponses[key]);
    createClientMock.mockReturnValue(buildSupabaseMock());
  });

  it('returns a ready status when checklist, documents and consumer evidence are complete', async () => {
    tableResponses.projects = {
      maybeSingle: {
        data: {
          id: '104A',
          name: 'Demo woning',
        },
        error: null,
      },
    };
    tableResponses.evidence = {
      order: {
        data: [
          {
            id: 7,
            project_id: '104A',
            inspection_point_id: 'beglazing-kitwerk-001',
            timestamp: '2026-03-15T08:00:00.000Z',
            exif_verified: true,
            location_verified: true,
            ai_status: 'PASSED',
            ai_notes: 'Akkoord',
            dossier_scope: 'BOTH',
            stop_moment_label: 'VOOR OPLEVERING',
            stop_moment_confirmed: true,
            requires_measurement_tool: false,
            measurement_tool_confirmed: null,
          },
        ],
        error: null,
      },
    };
    tableResponses.project_checklists = {
      order: {
        data: createChecklistRows(),
        error: null,
      },
    };
    tableResponses.consumer_dossier_documents = {
      order: {
        data: createDocumentRows(),
        error: null,
      },
    };

    const status = await getConsumerDossierStatus('104A');

    expect(status.ready).toBe(true);
    expect(status.metrics.consumerRelevantEvidenceCount).toBe(1);
    expect(status.documents.complete).toBe(true);
    expect(status.checklists.punchlist.complete).toBe(true);
    expect(status.checklists.consumerDossier.complete).toBe(true);
  });

  it('blocks readiness when document references are incomplete', async () => {
    tableResponses.projects = {
      maybeSingle: {
        data: {
          id: '104A',
        },
        error: null,
      },
    };
    tableResponses.evidence = {
      order: {
        data: [
          {
            id: 8,
            project_id: '104A',
            inspection_point_id: 'beglazing-kitwerk-001',
            timestamp: '2026-03-15T08:00:00.000Z',
            exif_verified: true,
            location_verified: true,
            ai_status: 'PASSED',
            dossier_scope: 'BOTH',
            stop_moment_label: 'VOOR OPLEVERING',
            stop_moment_confirmed: true,
            requires_measurement_tool: false,
          },
        ],
        error: null,
      },
    };
    tableResponses.project_checklists = {
      order: {
        data: createChecklistRows(),
        error: null,
      },
    };
    tableResponses.consumer_dossier_documents = {
      order: {
        data: createDocumentRows().slice(0, 2),
        error: null,
      },
    };

    const status = await getConsumerDossierStatus('104A');

    expect(status.ready).toBe(false);
    expect(
      status.issues.some(
        (issue: { id: string }) => issue.id === 'consumer-documentation-missing'
      )
    ).toBe(true);
  });
});
