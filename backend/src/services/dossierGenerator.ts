import type { TDocumentDefinitions } from 'pdfmake/interfaces';

const path = require('path');
const dotenv = require('dotenv');
const pdfmake = require('pdfmake');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');
const { loadConsumerDossierContext } = require('./consumerDossierContext');

dotenv.config();

type DossierEvidenceRow = {
  id?: number;
  evidence_id?: string | null;
  project_id?: string | null;
  inspection_point_id?: string | null;
  timestamp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  exif_hash?: string | null;
  exif_verified?: boolean | number | null;
  field_note?: string | null;
  stop_moment_confirmed?: boolean | null;
  measurement_tool_confirmed?: boolean | null;
  location_verified?: boolean | null;
  location_spoof_risk?: string | null;
  location_security_message?: string | null;
  ai_status?: string | null;
  ai_confidence?: number | null;
  ai_notes?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
  ifc_guid?: string | null;
  betonkwaliteit?: string | null;
  milieuklasse?: string | null;
  volume?: string | null;
  leverdatum?: string | null;
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

type ConsumerDossierDocumentRow = {
  document_id?: string | null;
  title?: string | null;
  category?: string | null;
  reference_value?: string | null;
  notes?: string | null;
  updated_at?: string | null;
};

type ConsumerDossierStatus = {
  ready: boolean;
  issues: Array<{
    id: string;
    severity: 'warning' | 'critical';
    title: string;
    detail: string;
  }>;
  metrics: {
    consumerRelevantEvidenceCount: number;
    rejectedConsumerEvidenceCount: number;
    latestConsumerEvidenceAt: string | null;
  };
  checklists: {
    punchlist: {
      checkedCount: number;
      requiredCount: number;
      complete: boolean;
    };
    gereedmelding: {
      checkedCount: number;
      requiredCount: number;
      complete: boolean;
    };
    consumerDossier: {
      checkedCount: number;
      requiredCount: number;
      complete: boolean;
    };
  };
  documents: {
    completedCount: number;
    requiredCount: number;
    complete: boolean;
  };
};

type ConsumerDossierMetrics = {
  totalEvidence: number;
  approvedEvidence: number;
  rejectedEvidence: number;
  verifiedEvidence: number;
  bimLinkedEvidence: number;
  latestEvidenceAt: string | null;
};

let supabaseClient: any | null = null;
let fontsRegistered = false;

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

const registerFonts = () => {
  if (fontsRegistered) {
    return;
  }

  const fontBasePath = path.resolve(__dirname, '../../node_modules/pdfmake/fonts/Roboto');
  pdfmake.addFonts({
    Roboto: {
      normal: path.join(fontBasePath, 'Roboto-Regular.ttf'),
      bold: path.join(fontBasePath, 'Roboto-Medium.ttf'),
      italics: path.join(fontBasePath, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontBasePath, 'Roboto-MediumItalic.ttf'),
    },
  });

  fontsRegistered = true;
};

const isVerifiedFlag = (value: DossierEvidenceRow['exif_verified']) =>
  value === true || value === 1;

const isApprovedEvidence = (status?: string | null) =>
  ['APPROVED', 'OK', 'PASSED'].includes(String(status ?? '').trim().toUpperCase());

const isRejectedEvidence = (status?: string | null) =>
  ['REJECTED', 'FAILED', 'WARNING'].includes(
    String(status ?? '').trim().toUpperCase()
  );

const formatGps = (item: DossierEvidenceRow) => {
  const base = `Lat: ${item.latitude ?? '—'}, Lng: ${item.longitude ?? '—'}`;
  if (item.gps_accuracy == null) {
    return base;
  }

  return `${base} (nauwkeurigheid: ${item.gps_accuracy.toFixed(1)} m)`;
};

const buildEvidenceBlock = (item: DossierEvidenceRow, index: number) => [
  {
    text: `Bewijsstuk ${index + 1}`,
    style: 'evidenceTitle',
    pageBreak: index === 0 ? undefined : 'before',
  },
  {
    style: 'evidenceBlock',
    layout: 'lightHorizontalLines',
    table: {
      headerRows: 0,
      widths: ['35%', '65%'],
      body: [
        [
          { text: 'Inspectiepunt', bold: true, fillColor: '#f2f2f2' },
          { text: item.inspection_point_id ?? 'Onbekend', fillColor: '#f2f2f2' },
        ],
        [
          { text: 'Tijdstempel (onveranderbaar)', bold: true },
          item.timestamp
            ? new Date(item.timestamp).toLocaleString('nl-NL')
            : 'Niet beschikbaar',
        ],
        [{ text: 'GPS (georeferencing)', bold: true }, formatGps(item)],
        [
          { text: 'Locatiecontrole', bold: true },
          item.location_verified === true
            ? `Akkoord (${item.location_spoof_risk ?? 'LOW'})`
            : item.location_security_message ?? 'Niet bevestigd',
        ],
        [
          { text: 'EXIF geverifieerd', bold: true },
          isVerifiedFlag(item.exif_verified) ? 'Ja' : 'Nee',
        ],
        [
          { text: 'EXIF SHA-256 hash', bold: true },
          { text: item.exif_hash ?? 'Niet beschikbaar', fontSize: 8, color: '#555555' },
        ],
        [
          { text: 'AI / validatiestatus', bold: true },
          `Status: ${item.ai_status ?? 'Onbekend'}${
            item.ai_confidence != null
              ? ` (${Math.round(item.ai_confidence * 100)}%)`
              : ''
          }`,
        ],
        [
          { text: 'AI bevindingen', bold: true },
          item.ai_notes ?? 'Geen aanvullende bevindingen geregistreerd.',
        ],
        [
          { text: 'Stopmoment bevestigd', bold: true },
          item.stop_moment_confirmed === true ? 'Ja' : 'Nee / niet vastgelegd',
        ],
        [
          { text: 'Meetmiddel bevestigd', bold: true },
          item.measurement_tool_confirmed === true ? 'Ja' : 'Nee / niet vastgelegd',
        ],
        [
          { text: 'Betonkwaliteit / milieu', bold: true },
          [item.betonkwaliteit, item.milieuklasse].filter(Boolean).join(' / ') || '—',
        ],
        [
          { text: 'Volume / leverdatum', bold: true },
          [item.volume ? `${item.volume} m3` : null, item.leverdatum]
            .filter(Boolean)
            .join(' / ') || '—',
        ],
        [{ text: 'Veldnotitie', bold: true }, item.field_note ?? '—'],
        [
          { text: 'Media referentie', bold: true },
          item.photo_uri ?? item.media_uri ?? 'Geen publieke URL beschikbaar',
        ],
      ],
    },
  },
];

const buildConsumerEvidenceBlock = (item: DossierEvidenceRow, index: number) => [
  {
    text: `Controlepunt ${index + 1}`,
    style: 'evidenceTitle',
    pageBreak: index === 0 ? undefined : 'before',
  },
  {
    style: 'evidenceBlock',
    layout: 'lightHorizontalLines',
    table: {
      headerRows: 0,
      widths: ['35%', '65%'],
      body: [
        [
          { text: 'Onderdeel', bold: true, fillColor: '#f2f2f2' },
          { text: item.inspection_point_id ?? 'Onbekend', fillColor: '#f2f2f2' },
        ],
        [
          { text: 'Datum vastlegging', bold: true },
          item.timestamp
            ? new Date(item.timestamp).toLocaleString('nl-NL')
            : 'Niet beschikbaar',
        ],
        [
          { text: 'Locatiecontrole', bold: true },
          item.location_verified === true
            ? `Akkoord (${item.location_spoof_risk ?? 'LOW'})`
            : item.location_security_message ?? 'Niet bevestigd',
        ],
        [{ text: 'Uitvoeringsnotitie', bold: true }, item.field_note ?? '—'],
        [{ text: 'Kwaliteitsopmerking', bold: true }, item.ai_notes ?? '—'],
        [
          { text: 'Materiaal / bondata', bold: true },
          [item.betonkwaliteit, item.milieuklasse, item.volume, item.leverdatum]
            .filter(Boolean)
            .join(' / ') || '—',
        ],
        [
          { text: 'Bewijsreferentie', bold: true },
          item.photo_uri ?? item.media_uri ?? 'Geen mediareferentie beschikbaar',
        ],
      ],
    },
  },
];

const fetchProjectMetadata = async (
  supabase: any,
  projectId: string
): Promise<ProjectRow | null> => {
  try {
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
  } catch (error: any) {
    console.warn(
      `Projectmetadata voor consumentendossier kon niet worden opgehaald: ${
        error?.message ?? 'onbekende fout'
      }`
    );
    return null;
  }
};

const buildConsumerDossierMetrics = (
  evidenceList: DossierEvidenceRow[]
): ConsumerDossierMetrics => {
  const timestamps = evidenceList
    .map((item) => String(item.timestamp ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  return {
    totalEvidence: evidenceList.length,
    approvedEvidence: evidenceList.filter((item) => isApprovedEvidence(item.ai_status))
      .length,
    rejectedEvidence: evidenceList.filter((item) => isRejectedEvidence(item.ai_status))
      .length,
    verifiedEvidence: evidenceList.filter((item) => isVerifiedFlag(item.exif_verified))
      .length,
    bimLinkedEvidence: evidenceList.filter((item) => Boolean(item.ifc_guid)).length,
    latestEvidenceAt: timestamps[0] ?? null,
  };
};

const buildProjectSummaryTable = (
  projectId: string,
  project: ProjectRow | null,
  metrics: ConsumerDossierMetrics,
  status?: ConsumerDossierStatus
) => ({
  style: 'evidenceBlock',
  layout: 'lightHorizontalLines',
  table: {
    headerRows: 0,
    widths: ['35%', '65%'],
    body: [
      ['Project ID', projectId],
      ['Projectnaam', project?.name ?? 'Nog niet vastgelegd'],
      ['Adres', project?.address ?? 'Nog niet vastgelegd'],
      ['Opdrachtgever / initiator', project?.initiator_name ?? 'Nog niet vastgelegd'],
      ['Instrument / borgingsplan', project?.instrument_id ?? 'Nog niet vastgelegd'],
      [
        'Laatste dossierupdate',
        metrics.latestEvidenceAt
          ? new Date(metrics.latestEvidenceAt).toLocaleString('nl-NL')
          : 'Nog geen bewijs geregistreerd',
      ],
      ['Aantal bewijsstukken', String(metrics.totalEvidence)],
      ['Goedgekeurd bewijs', String(metrics.approvedEvidence)],
      ['Open afkeur / aandachtspunten', String(metrics.rejectedEvidence)],
      ['EXIF geverifieerd', String(metrics.verifiedEvidence)],
      ['BIM gekoppeld', String(metrics.bimLinkedEvidence)],
      [
        'Punchlist gereed',
        status
          ? `${status.checklists.punchlist.checkedCount}/${status.checklists.punchlist.requiredCount}`
          : 'Onbekend',
      ],
      [
        'NPR 8092 checklist',
        status
          ? `${status.checklists.consumerDossier.checkedCount}/${status.checklists.consumerDossier.requiredCount}`
          : 'Onbekend',
      ],
      [
        'Documentreferenties',
        status
          ? `${status.documents.completedCount}/${status.documents.requiredCount}`
          : 'Onbekend',
      ],
      ['DSO bouwmelding', project?.dso_bouwmelding_status ?? 'Onbekend'],
      ['DSO gereedmelding', project?.dso_gereedmelding_status ?? 'Onbekend'],
    ],
  },
});

const buildProjectDocumentReferences = (project: ProjectRow | null) => {
  const references = [
    ['Borgingsplan', project?.borgingsplan_url],
    ['Risicobeoordeling', project?.risicobeoordeling_url],
    ['Dossier Bevoegd Gezag', project?.dossier_bevoegd_gezag_url],
    ['Verklaring kwaliteitsborger', project?.verklaring_kwaliteitsborger_url],
  ].filter(([, value]) => Boolean(value));

  if (references.length === 0) {
    return {
      text:
        'Nog geen aanvullende documentreferenties vastgelegd. Voeg borgingsplan, garanties en handleidingen toe voor de definitieve oplevering.',
      margin: [0, 0, 0, 12],
    };
  }

  return {
    ul: references.map(
      ([label, value]) => `${label}: ${String(value ?? '').trim()}`
    ),
    margin: [0, 0, 0, 12],
  };
};

const formatDocumentCategory = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toUpperCase();

  switch (normalized) {
    case 'AS_BUILT':
      return 'As-built';
    case 'MATERIALS':
      return 'Materialen';
    case 'USAGE_FUNCTIONS':
      return 'Gebruiksfuncties';
    case 'MANUALS':
      return 'Handleidingen';
    case 'MAINTENANCE':
      return 'Onderhoud';
    case 'WARRANTIES':
      return 'Garanties';
    case 'CONTRACT_DEVIATIONS':
      return 'Contractafspraken';
    default:
      return normalized || 'Onbekend';
  }
};

const buildConsumerReadinessTable = (status: ConsumerDossierStatus) => ({
  style: 'evidenceBlock',
  layout: 'lightHorizontalLines',
  table: {
    headerRows: 1,
    widths: ['40%', '20%', '40%'],
    body: [
      [
        { text: 'Onderdeel', bold: true, fillColor: '#f2f2f2' },
        { text: 'Status', bold: true, fillColor: '#f2f2f2' },
        { text: 'Dekking', bold: true, fillColor: '#f2f2f2' },
      ],
      [
        'Punchlist oplevering',
        status.checklists.punchlist.complete ? 'Compleet' : 'Open',
        `${status.checklists.punchlist.checkedCount}/${status.checklists.punchlist.requiredCount}`,
      ],
      [
        'NPR 8092 checklist',
        status.checklists.consumerDossier.complete ? 'Compleet' : 'Open',
        `${status.checklists.consumerDossier.checkedCount}/${status.checklists.consumerDossier.requiredCount}`,
      ],
      [
        'Documentreferenties',
        status.documents.complete ? 'Compleet' : 'Open',
        `${status.documents.completedCount}/${status.documents.requiredCount}`,
      ],
      [
        'Consumentrelevant bewijs',
        status.metrics.consumerRelevantEvidenceCount > 0 ? 'Aanwezig' : 'Ontbreekt',
        String(status.metrics.consumerRelevantEvidenceCount),
      ],
      [
        'Gereedmelding Wkb',
        status.checklists.gereedmelding.complete ? 'Compleet' : 'Informeel open',
        `${status.checklists.gereedmelding.checkedCount}/${status.checklists.gereedmelding.requiredCount}`,
      ],
    ],
  },
});

const buildConsumerDocumentReferencesTable = (
  documents: ConsumerDossierDocumentRow[]
) => {
  if (documents.length === 0) {
    return {
      text:
        'Nog geen gestructureerde documentreferenties beschikbaar in de cloud voor dit consumentendossier.',
      margin: [0, 0, 0, 12],
    };
  }

  return {
    style: 'evidenceBlock',
    layout: 'lightHorizontalLines',
    table: {
      headerRows: 1,
      widths: ['24%', '32%', '44%'],
      body: [
        [
          { text: 'Categorie', bold: true, fillColor: '#f2f2f2' },
          { text: 'Referentie', bold: true, fillColor: '#f2f2f2' },
          { text: 'Toelichting', bold: true, fillColor: '#f2f2f2' },
        ],
        ...documents.map((item) => [
          formatDocumentCategory(item.category),
          item.reference_value ?? '—',
          [item.title, item.notes, item.updated_at ? `Bijgewerkt: ${new Date(item.updated_at).toLocaleString('nl-NL')}` : null]
            .filter(Boolean)
            .join('\n') || '—',
        ]),
      ],
    },
  };
};

const generateBevoegdGezagDossier = async (projectId: string): Promise<Buffer> => {
  console.log(
    `🗄️ Start datacollectie voor Dossier Bevoegd Gezag (Project: ${projectId})...`
  );

  registerFonts();
  const supabase = getSupabaseAdminClient();
  const project = await fetchProjectMetadata(supabase, projectId);

  const { data: evidenceList, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('project_id', projectId)
    .in('ai_status', ['APPROVED', 'PASSED'])
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Supabase Database fout bij ophalen bewijs: ${error.message}`);
  }

  const content: any[] = [
    { text: 'Dossier Bevoegd Gezag', style: 'header' },
    {
      text: 'Wet kwaliteitsborging voor het bouwen (Wkb) - Gevolgklasse 1',
      style: 'subheader',
      margin: [0, 0, 0, 16],
    },
    { text: `Project ID: ${projectId}`, style: 'metaLine' },
    {
      text: `Genereerdatum: ${new Date().toLocaleDateString('nl-NL')}`,
      style: 'metaLine',
      margin: [0, 0, 0, 20],
    },
    { text: '1. Verklaring Kwaliteitsborger', style: 'sectionHeader' },
    {
      text:
        'Hierbij verklaart de onafhankelijke kwaliteitsborger dat de kwaliteitsborging is uitgevoerd overeenkomstig de in het instrument gestelde eisen. Er is naar zijn oordeel een gerechtvaardigd vertrouwen dat het bouwwerk voldoet aan de voorschriften zoals bedoeld in de hoofdstukken 2 tot en met 6 van het Besluit bouwwerken leefomgeving (Bbl).',
      italics: true,
      margin: [0, 0, 0, 16],
    },
    {
      text: '2. As-Built Digitale Bewijslast (Cryptografisch Verankerd)',
      style: 'sectionHeader',
    },
    {
      text:
        'Onderstaande log toont het geolocate bewijsmateriaal dat tijdens de uitvoering is vastgelegd en gevalideerd. Alleen goedgekeurd bewijs is in dit dossier opgenomen.',
      margin: [0, 0, 0, 16],
    },
  ];

  if (evidenceList && evidenceList.length > 0) {
    evidenceList.forEach((item: DossierEvidenceRow, index: number) => {
      content.push(...buildEvidenceBlock(item, index));
    });
  } else {
    content.push({
      text: 'Geen goedgekeurde bewijslast gevonden voor dit project.',
      color: '#c62828',
      margin: [0, 8, 0, 0],
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 48],
    info: {
      title: `Wkb Dossier Bevoegd Gezag - ${projectId}`,
      author: 'Wkb Snap & Sync',
      subject: 'Dossier Bevoegd Gezag',
      creator: 'Wkb Snap & Sync',
      producer: 'pdfmake',
    },
    content,
    styles: {
      header: { fontSize: 22, bold: true, color: '#ff6600', margin: [0, 0, 0, 6] },
      subheader: { fontSize: 12, italics: true, color: '#555555' },
      metaLine: { fontSize: 10, color: '#333333' },
      sectionHeader: {
        fontSize: 15,
        bold: true,
        color: '#222222',
        margin: [0, 10, 0, 10],
      },
      evidenceTitle: {
        fontSize: 12,
        bold: true,
        color: '#0b1736',
        margin: [0, 0, 0, 8],
      },
      evidenceBlock: { margin: [0, 0, 0, 12] },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.2,
    },
  };

  return pdfmake.createPdf(docDefinition).getBuffer();
};

const generateConsumentendossier = async (projectId: string): Promise<Buffer> => {
  console.log(`🧾 Start datacollectie voor Consumentendossier (Project: ${projectId})...`);

  registerFonts();
  const context = await loadConsumerDossierContext(projectId);
  const project = (context.project ?? null) as ProjectRow | null;
  const evidence = context.readyConsumerEvidence as DossierEvidenceRow[];
  const rejectedEvidence = context.rejectedConsumerEvidence as DossierEvidenceRow[];
  const documentRows = context.documentRows as ConsumerDossierDocumentRow[];
  const status = context.status as ConsumerDossierStatus;
  const metrics = buildConsumerDossierMetrics(evidence);

  const content: any[] = [
    { text: 'Consumentendossier', style: 'header' },
    {
      text: 'Artikel 7:757a BW - Opleverdossier voor opdrachtgever / consument',
      style: 'subheader',
      margin: [0, 0, 0, 16],
    },
    { text: `Project ID: ${projectId}`, style: 'metaLine' },
    {
      text: `Genereerdatum: ${new Date().toLocaleDateString('nl-NL')}`,
      style: 'metaLine',
      margin: [0, 0, 0, 20],
    },
    {
      text: '1. Project- en dossiersamenvatting',
      style: 'sectionHeader',
    },
    {
      text:
        'Dit consumentendossier bundelt de feitelijke staat van het bouwwerk bij oplevering, inclusief consumentrelevante as-built bewijslast, overdrachtsdocumenten en onderhoudsreferenties. Het ondersteunt de overdracht conform artikel 7:757a BW en de standaardset uit NPR 8092.',
      margin: [0, 0, 0, 16],
    },
    buildProjectSummaryTable(projectId, project, metrics, status),
    {
      text: '2. NPR 8092 overdrachtsmatrix',
      style: 'sectionHeader',
    },
    {
      text:
        'Onderstaande matrix toont de server-side gevalideerde dekking van punchlist, checklist, documentreferenties en consumentgericht bewijs.',
      margin: [0, 0, 0, 16],
    },
    buildConsumerReadinessTable(status),
    {
      text: '3. As-built overzicht van consumentrelevante onderdelen',
      style: 'sectionHeader',
    },
    {
      text:
        'Alleen consumentrelevant bewijs dat EXIF-, locatie- en kwaliteitsmatig dossierklaar is, wordt hieronder opgenomen.',
      margin: [0, 0, 0, 16],
    },
  ];

  if (evidence.length > 0) {
    evidence.forEach((item: DossierEvidenceRow, index: number) => {
      content.push(...buildConsumerEvidenceBlock(item, index));
    });
  } else {
    content.push({
      text: 'Nog geen bewijsstukken beschikbaar voor dit consumentendossier.',
      color: '#c62828',
      margin: [0, 8, 0, 0],
    });
  }

  const attentionItems: any[] = [];

  if (status.issues.length > 0) {
    attentionItems.push({
      ul: status.issues.map((issue) => `${issue.title}: ${issue.detail}`),
      margin: [0, 0, 0, 12],
    });
  }

  if (rejectedEvidence.length > 0) {
    attentionItems.push({
      ul: rejectedEvidence.map((item) => {
        const evidenceStatus = String(item.ai_status ?? 'ONBEKEND').trim() || 'ONBEKEND';
        const note = String(item.ai_notes ?? '').trim();

        return `${item.inspection_point_id ?? 'Onbekend inspectiepunt'} (${evidenceStatus})${
          note ? `: ${note}` : ''
        }`;
      }),
      margin: [0, 0, 0, 12],
    });
  }

  if (attentionItems.length === 0) {
    attentionItems.push({
      text:
        'Geen openstaande afkeur of waarschuwingen geregistreerd op het moment van genereren.',
      margin: [0, 0, 0, 12],
    });
  }

  content.push(
    {
      text: '4. Documentreferenties voor overdracht',
      style: 'sectionHeader',
    },
    buildConsumerDocumentReferencesTable(documentRows),
    {
      text: '5. Aandachtspunten en kwaliteitsnotities',
      style: 'sectionHeader',
    },
    ...attentionItems,
    {
      text: '6. Overige projectreferenties',
      style: 'sectionHeader',
    },
    buildProjectDocumentReferences(project)
  );

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 48],
    info: {
      title: `Wkb Consumentendossier - ${projectId}`,
      author: 'Wkb Snap & Sync',
      subject: 'Consumentendossier',
      creator: 'Wkb Snap & Sync',
      producer: 'pdfmake',
    },
    content,
    styles: {
      header: { fontSize: 22, bold: true, color: '#ff6600', margin: [0, 0, 0, 6] },
      subheader: { fontSize: 12, italics: true, color: '#555555' },
      metaLine: { fontSize: 10, color: '#333333' },
      sectionHeader: {
        fontSize: 15,
        bold: true,
        color: '#222222',
        margin: [0, 10, 0, 10],
      },
      evidenceTitle: {
        fontSize: 12,
        bold: true,
        color: '#0b1736',
        margin: [0, 0, 0, 8],
      },
      evidenceBlock: { margin: [0, 0, 0, 12] },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.2,
    },
  };

  return pdfmake.createPdf(docDefinition).getBuffer();
};

module.exports = {
  generateBevoegdGezagDossier,
  generateConsumentendossier,
};
