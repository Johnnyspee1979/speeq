const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');

type DossierEvidenceRow = {
  id?: number;
  project_id?: string | null;
  inspection_point_id?: string | null;
  timestamp?: string | null;
  exif_verified?: boolean | number | null;
  location_verified?: boolean | number | null;
  ai_status?: string | null;
  ai_notes?: string | null;
  field_note?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
  dossier_scope?: string | null;
  discipline_id?: string | null;
  stop_moment_label?: string | null;
  stop_moment_confirmed?: boolean | number | null;
  requires_measurement_tool?: boolean | number | null;
  measurement_tool_confirmed?: boolean | number | null;
};

type ProjectChecklistRow = {
  project_id?: string | null;
  checklist_type?: string | null;
  item_id?: string | null;
  title?: string | null;
  checked?: boolean | number | null;
  updated_at?: string | null;
};

type ConsumerDossierDocumentRow = {
  project_id?: string | null;
  document_id?: string | null;
  requirement_id?: string | null;
  title?: string | null;
  category?: string | null;
  reference_value?: string | null;
  notes?: string | null;
  updated_at?: string | null;
};

type ProjectRow = {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  initiator_name?: string | null;
  instrument_id?: string | null;
  kwaliteitsborger_id?: string | null;
  borgingsplan_url?: string | null;
  risicobeoordeling_url?: string | null;
  dossier_bevoegd_gezag_url?: string | null;
  verklaring_kwaliteitsborger_url?: string | null;
  dso_bouwmelding_status?: string | null;
  dso_gereedmelding_status?: string | null;
};

type ConsumerDossierIssue = {
  id: string;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
};

type ChecklistStatus = {
  checkedCount: number;
  requiredCount: number;
  complete: boolean;
};

export type ConsumerDossierStatus = {
  projectId: string;
  ready: boolean;
  issues: ConsumerDossierIssue[];
  metrics: {
    consumerRelevantEvidenceCount: number;
    rejectedConsumerEvidenceCount: number;
    latestConsumerEvidenceAt: string | null;
  };
  checklists: {
    punchlist: ChecklistStatus;
    gereedmelding: ChecklistStatus;
    consumerDossier: ChecklistStatus;
  };
  documents: {
    completedCount: number;
    requiredCount: number;
    complete: boolean;
  };
};

export type LoadedConsumerDossierContext = {
  project: ProjectRow | null;
  evidence: DossierEvidenceRow[];
  consumerEvidence: DossierEvidenceRow[];
  readyConsumerEvidence: DossierEvidenceRow[];
  rejectedConsumerEvidence: DossierEvidenceRow[];
  checklistRows: ProjectChecklistRow[];
  documentRows: ConsumerDossierDocumentRow[];
  status: ConsumerDossierStatus;
};

type ConsumerDocumentDefinition = {
  id: string;
  title: string;
  referenceRequired: boolean;
  notesRequired: boolean;
};

const PUNCHLIST_REQUIRED_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'];
const GEREEDMELDING_REQUIRED_IDS = [
  'req_1',
  'req_2',
  'req_3',
  'req_4',
  'req_5',
  'req_6',
];
const CONSUMER_DOSSIER_REQUIRED_IDS = [
  'cd_1',
  'cd_2',
  'cd_3',
  'cd_4',
  'cd_5',
  'cd_6',
  'cd_7',
];
const CONSUMER_DOCUMENT_DEFINITIONS: ConsumerDocumentDefinition[] = [
  { id: 'cdd_1', title: 'As-built tekeningen en installaties', referenceRequired: true, notesRequired: false },
  { id: 'cdd_2', title: 'Materialen, kleurcodes en installaties', referenceRequired: true, notesRequired: false },
  { id: 'cdd_3', title: 'Gebruiksfuncties en ruimtetoelichting', referenceRequired: true, notesRequired: false },
  { id: 'cdd_4', title: 'Handleidingen installaties', referenceRequired: true, notesRequired: false },
  { id: 'cdd_5', title: 'Onderhoudsvoorschriften', referenceRequired: true, notesRequired: false },
  { id: 'cdd_6', title: 'Garantiebewijzen en termijnen', referenceRequired: true, notesRequired: false },
  { id: 'cdd_7', title: 'Contractuele afwijkingen of standaardset', referenceRequired: false, notesRequired: true },
];
const LEGACY_CONSUMER_SCOPE_KEYWORDS = [
  'beglazing',
  'veiligheidsglas',
  'glas',
  'stuc',
  'houtrot',
  'oplevering',
];

let supabaseClient: any | null = null;

class IncompleteConsumerDossierError extends Error {
  statusCode: number;
  issues: ConsumerDossierIssue[];

  constructor(issues: ConsumerDossierIssue[]) {
    super('Consumentendossier is nog niet compleet genoeg voor export.');
    this.name = 'IncompleteConsumerDossierError';
    this.statusCode = 409;
    this.issues = issues;
  }
}

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt in .env');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }

  return supabaseClient;
};

const isTrueFlag = (value: boolean | number | null | undefined) =>
  value === true || value === 1;

const hasValue = (value?: string | null) => Boolean(value && value.trim().length > 0);

const isApprovedEvidence = (status?: string | null) =>
  ['APPROVED', 'OK', 'PASSED'].includes(String(status ?? '').trim().toUpperCase());

const isRejectedEvidence = (status?: string | null) =>
  ['REJECTED', 'FAILED', 'WARNING', 'NEEDS_REVIEW'].includes(
    String(status ?? '').trim().toUpperCase()
  );

const normalizeDossierScope = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (
    normalized === 'BEVOEGD_GEZAG' ||
    normalized === 'CONSUMENT' ||
    normalized === 'BOTH'
  ) {
    return normalized;
  }

  return null;
};

const isLegacyConsumerRelevantInspectionPoint = (inspectionPointId?: string | null) => {
  const normalized = String(inspectionPointId ?? '').trim().toLowerCase();
  return LEGACY_CONSUMER_SCOPE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isConsumerRelevantEvidence = (item: DossierEvidenceRow) => {
  const dossierScope = normalizeDossierScope(item.dossier_scope);

  if (dossierScope === 'CONSUMENT' || dossierScope === 'BOTH') {
    return true;
  }

  return dossierScope == null && isLegacyConsumerRelevantInspectionPoint(item.inspection_point_id);
};

const isReadyConsumerEvidence = (item: DossierEvidenceRow) => {
  const stopMomentSatisfied =
    !hasValue(item.stop_moment_label) || isTrueFlag(item.stop_moment_confirmed);
  const measurementSatisfied =
    !isTrueFlag(item.requires_measurement_tool) || isTrueFlag(item.measurement_tool_confirmed);

  return (
    isConsumerRelevantEvidence(item) &&
    isApprovedEvidence(item.ai_status) &&
    isTrueFlag(item.exif_verified) &&
    isTrueFlag(item.location_verified) &&
    stopMomentSatisfied &&
    measurementSatisfied
  );
};

const buildChecklistStatus = (
  rows: ProjectChecklistRow[],
  checklistType: 'PUNCHLIST' | 'GEREEDMELDING' | 'CONSUMER_DOSSIER',
  requiredIds: string[]
): ChecklistStatus => {
  const relevantRows = rows.filter(
    (row) => String(row.checklist_type ?? '').trim().toUpperCase() === checklistType
  );
  const rowById = new Map(
    relevantRows.map((row) => [String(row.item_id ?? '').trim(), row])
  );
  const checkedCount = requiredIds.filter((id) =>
    isTrueFlag(rowById.get(id)?.checked)
  ).length;

  return {
    checkedCount,
    requiredCount: requiredIds.length,
    complete: checkedCount === requiredIds.length && requiredIds.length > 0,
  };
};

const isDocumentComplete = (
  row: ConsumerDossierDocumentRow | undefined,
  definition: ConsumerDocumentDefinition
) => {
  if (!row) {
    return false;
  }

  const referenceComplete =
    !definition.referenceRequired || hasValue(row.reference_value);
  const notesComplete = !definition.notesRequired || hasValue(row.notes);

  return referenceComplete && notesComplete;
};

const buildIssues = ({
  punchlist,
  consumerDossier,
  documentsCompletedCount,
  consumerRelevantEvidenceCount,
  rejectedConsumerEvidenceCount,
}: {
  punchlist: ChecklistStatus;
  consumerDossier: ChecklistStatus;
  documentsCompletedCount: number;
  consumerRelevantEvidenceCount: number;
  rejectedConsumerEvidenceCount: number;
}) => {
  const issues: ConsumerDossierIssue[] = [];

  if (!punchlist.complete) {
    issues.push({
      id: 'punchlist-open',
      severity: 'warning',
      title: 'Opleverings-restpunten staan nog open',
      detail: `${punchlist.checkedCount}/${punchlist.requiredCount} punchlist-punten zijn afgevinkt.`,
    });
  }

  if (!consumerDossier.complete) {
    issues.push({
      id: 'consumer-dossier-incomplete',
      severity: 'warning',
      title: 'Consumentendossier mist nog overdrachtsinformatie',
      detail: `${consumerDossier.checkedCount}/${consumerDossier.requiredCount} NPR 8092-checklistonderdelen zijn bevestigd.`,
    });
  }

  if (documentsCompletedCount !== CONSUMER_DOCUMENT_DEFINITIONS.length) {
    issues.push({
      id: 'consumer-documentation-missing',
      severity: 'warning',
      title: 'Consumentendossier mist nog documentreferenties',
      detail: `${documentsCompletedCount}/${CONSUMER_DOCUMENT_DEFINITIONS.length} documentonderdelen zijn server-side compleet ingevuld.`,
    });
  }

  if (consumerRelevantEvidenceCount === 0) {
    issues.push({
      id: 'consumer-evidence-missing',
      severity: 'warning',
      title: 'Nog geen consumentgericht bewijs dossierklaar',
      detail:
        'Er is nog geen consumentrelevant, EXIF-geverifieerd en locatie-gevalideerd bewijs beschikbaar voor export.',
    });
  }

  if (rejectedConsumerEvidenceCount > 0) {
    issues.push({
      id: 'consumer-evidence-attention',
      severity: 'warning',
      title: 'Er staan consumentrelevante bewijsstukken met aandacht open',
      detail: `${rejectedConsumerEvidenceCount} consumentrelevant bewijsstuk(ken) zijn afgekeurd of wachten op review.`,
    });
  }

  return issues;
};

const fetchProjectMetadata = async (
  supabase: any,
  projectId: string
): Promise<ProjectRow | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    console.warn(
      `Projectmetadata voor consumentendossier kon niet worden opgehaald: ${error.message}`
    );
    return null;
  }

  return (data ?? null) as ProjectRow | null;
};

const loadConsumerDossierContext = async (
  projectId: string
): Promise<LoadedConsumerDossierContext> => {
  const supabase = getSupabaseAdminClient();

  const [project, evidenceResponse, checklistResponse, documentsResponse] =
    await Promise.all([
      fetchProjectMetadata(supabase, projectId),
      supabase
        .from('evidence')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: true }),
      supabase
        .from('project_checklists')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: true }),
      supabase
        .from('consumer_dossier_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: true }),
    ]);

  if (evidenceResponse.error) {
    throw new Error(
      `Supabase Database fout bij ophalen consumentendossier-bewijs: ${evidenceResponse.error.message}`
    );
  }

  if (checklistResponse.error) {
    throw new Error(
      `Supabase Database fout bij ophalen checklistdata: ${checklistResponse.error.message}`
    );
  }

  if (documentsResponse.error) {
    throw new Error(
      `Supabase Database fout bij ophalen documentreferenties: ${documentsResponse.error.message}`
    );
  }

  const evidence = (evidenceResponse.data ?? []) as DossierEvidenceRow[];
  const checklistRows = (checklistResponse.data ?? []) as ProjectChecklistRow[];
  const documentRows = (documentsResponse.data ?? []) as ConsumerDossierDocumentRow[];
  const consumerEvidence = evidence.filter(isConsumerRelevantEvidence);
  const readyConsumerEvidence = consumerEvidence.filter(isReadyConsumerEvidence);
  const rejectedConsumerEvidence = consumerEvidence.filter((item) =>
    isRejectedEvidence(item.ai_status)
  );

  const punchlist = buildChecklistStatus(
    checklistRows,
    'PUNCHLIST',
    PUNCHLIST_REQUIRED_IDS
  );
  const gereedmelding = buildChecklistStatus(
    checklistRows,
    'GEREEDMELDING',
    GEREEDMELDING_REQUIRED_IDS
  );
  const consumerDossier = buildChecklistStatus(
    checklistRows,
    'CONSUMER_DOSSIER',
    CONSUMER_DOSSIER_REQUIRED_IDS
  );
  const documentRowById = new Map(
    documentRows.map((row) => [String(row.document_id ?? '').trim(), row])
  );
  const documentsCompletedCount = CONSUMER_DOCUMENT_DEFINITIONS.filter((definition) =>
    isDocumentComplete(documentRowById.get(definition.id), definition)
  ).length;
  const latestConsumerEvidenceAt =
    readyConsumerEvidence
      .map((item) => String(item.timestamp ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .at(0) ?? null;

  const issues = buildIssues({
    punchlist,
    consumerDossier,
    documentsCompletedCount,
    consumerRelevantEvidenceCount: readyConsumerEvidence.length,
    rejectedConsumerEvidenceCount: rejectedConsumerEvidence.length,
  });

  const status: ConsumerDossierStatus = {
    projectId,
    ready:
      punchlist.complete &&
      consumerDossier.complete &&
      documentsCompletedCount === CONSUMER_DOCUMENT_DEFINITIONS.length &&
      readyConsumerEvidence.length > 0,
    issues,
    metrics: {
      consumerRelevantEvidenceCount: readyConsumerEvidence.length,
      rejectedConsumerEvidenceCount: rejectedConsumerEvidence.length,
      latestConsumerEvidenceAt,
    },
    checklists: {
      punchlist,
      gereedmelding,
      consumerDossier,
    },
    documents: {
      completedCount: documentsCompletedCount,
      requiredCount: CONSUMER_DOCUMENT_DEFINITIONS.length,
      complete: documentsCompletedCount === CONSUMER_DOCUMENT_DEFINITIONS.length,
    },
  };

  return {
    project,
    evidence,
    consumerEvidence,
    readyConsumerEvidence,
    rejectedConsumerEvidence,
    checklistRows,
    documentRows,
    status,
  };
};

const getConsumerDossierStatus = async (
  projectId: string
): Promise<ConsumerDossierStatus> => {
  const context = await loadConsumerDossierContext(projectId);
  return context.status;
};

module.exports = {
  loadConsumerDossierContext,
  getConsumerDossierStatus,
  IncompleteConsumerDossierError,
};
