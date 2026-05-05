import type {
  ConsumerDossierDocumentCategory,
  Evidence,
  StoredConsumerDossierDocument as DatabaseStoredConsumerDossierDocument,
  StoredConsumerDossierItem as DatabaseStoredConsumerDossierItem,
  StoredGereedmeldingItem,
  StoredPunchlistItem,
} from '../database/database';
import {
  findNenTaskContextByInspectionPointId,
  type DisciplineId,
} from '../constants/NenStandards';
import { wkbTaskTemplates, type DossierScope } from '../data/WkbTemplates';

export type ConsumerDossierRequirement = {
  id: string;
  title: string;
  description: string;
  legalBasis: string;
};

export type ConsumerDossierDocumentRequirement = {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  category: ConsumerDossierDocumentCategory;
  referenceLabel: string;
  referencePlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  referenceRequired: boolean;
  notesRequired: boolean;
};

export type StoredConsumerDossierItem = DatabaseStoredConsumerDossierItem;
export type StoredConsumerDossierDocument = DatabaseStoredConsumerDossierDocument;

type ComplianceSeverity = 'warning' | 'critical';

export type WkbComplianceIssue = {
  id: string;
  severity: ComplianceSeverity;
  title: string;
  detail: string;
};

export type WkbComplianceModuleStatus = {
  id: DisciplineId;
  title: string;
  legalBasis: string;
  dossierScope: 'BEVOEGD_GEZAG' | 'BOTH';
  evidenceCount: number;
  readyEvidenceCount: number;
  covered: boolean;
  ready: boolean;
  blocker: string | null;
};

export type WkbEvidenceComplianceContext = {
  title: string;
  disciplineId: DisciplineId | null;
  disciplineTitle: string | null;
  standards: string | null;
  stopMoment: string | null;
  requiresMeasurementTool: boolean;
  dossierScope: DossierScope | null;
  selectionSource: 'NEN' | 'WKB' | 'UNKNOWN';
};

export type WkbComplianceSnapshot = {
  overallScore: number;
  readyEvidenceCount: number;
  localOnlyEvidenceCount: number;
  failedEvidenceCount: number;
  reviewEvidenceCount: number;
  missingExifCount: number;
  missingLocationVerificationCount: number;
  missingStopMomentCount: number;
  missingMeasurementToolCount: number;
  consumerDossierCheckedCount: number;
  consumerDossierTotalCount: number;
  consumerDossierDocumentFilledCount: number;
  consumerDossierDocumentTotalCount: number;
  punchlistCheckedCount: number;
  punchlistTotalCount: number;
  gereedmeldingCheckedCount: number;
  gereedmeldingTotalCount: number;
  bevoegdGezagReady: boolean;
  gereedmeldingReady: boolean;
  consumentReady: boolean;
  modules: WkbComplianceModuleStatus[];
  issues: WkbComplianceIssue[];
};

const COMPLIANCE_MODULES: Array<{
  id: DisciplineId;
  title: string;
  legalBasis: string;
  dossierScope: 'BEVOEGD_GEZAG' | 'BOTH';
}> = [
  {
    id: 'constructie_fundering',
    title: 'Constructie & Fundering',
    legalBasis: 'Bbl hoofdstuk 2 / NEN-EN 1990 t/m 1992',
    dossierScope: 'BEVOEGD_GEZAG',
  },
  {
    id: 'brandveiligheid',
    title: 'Brand- & Rookwerendheid',
    legalBasis: 'Bbl hoofdstuk 3 / NEN 6068 / 6069 / 6075',
    dossierScope: 'BEVOEGD_GEZAG',
  },
  {
    id: 'elektrotechniek',
    title: 'Elektrotechniek',
    legalBasis: 'Bbl hoofdstuk 4 / NEN 1010 / NEN 3140',
    dossierScope: 'BEVOEGD_GEZAG',
  },
  {
    id: 'installatie_water_gas',
    title: 'Water, Gas & Klimaat',
    legalBasis: 'Bbl hoofdstuk 4 / NEN 1006 / 1078 / 3215 / 1087',
    dossierScope: 'BEVOEGD_GEZAG',
  },
  {
    id: 'bouwfysica_gebruik',
    title: 'Bouwfysica & Gebruik',
    legalBasis: 'Bbl hoofdstuk 4 / NTA 8800 / NEN 5077 / 2580 / 9120',
    dossierScope: 'BEVOEGD_GEZAG',
  },
  {
    id: 'afbouw',
    title: 'Afbouw & Glas',
    legalBasis: 'Art. 7:757a BW / NEN-EN 13914 / NEN 3569',
    dossierScope: 'BOTH',
  },
];

export const CONSUMER_DOSSIER_REQUIREMENTS: ConsumerDossierRequirement[] = [
  {
    id: 'cd_1',
    title: 'As-built tekeningen en installaties vastgelegd',
    description:
      'As-built tekeningen van de gerealiseerde woning en installaties zijn aanwezig, inclusief gebruiksrelevante documentatie waarmee de opdrachtgever kan controleren wat daadwerkelijk is gebouwd.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_2',
    title: 'Toegepaste materialen, kleurcodes en installaties gespecificeerd',
    description:
      'Toegepaste bouwmaterialen, afwerkingen, RAL/NCS-kleuren en installatiecomponenten zijn herleidbaar beschreven voor overdracht, herstel en nazorg.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_3',
    title: 'Gebruiksfuncties van ruimten en onderdelen beschreven',
    description:
      'De gebruiksfuncties van het bouwwerk en de belangrijkste ruimten of voorzieningen zijn vastgelegd, zodat duidelijk is waarvoor het opgeleverde werk bedoeld en geschikt is.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_4',
    title: 'Handleidingen van installaties toegevoegd',
    description:
      'Warmtepomp, WTW, ventilatie, omvormer en overige installaties zijn overdraagbaar gedocumenteerd met gebruikersinstructies voor de opdrachtgever.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_5',
    title: 'Onderhoudsvoorschriften van bouwdelen en installaties compleet',
    description:
      'Onderhoudsinstructies voor daken, gevels, afwerkingen en installaties zijn geborgd, inclusief service-intervallen die invloed hebben op prestatie en garantie.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_6',
    title: 'Garantiebewijzen en garantietermijnen aanwezig',
    description:
      'Garantiedocumenten, garantietermijnen en productgebonden waarborgen van bouwdelen en apparatuur zijn compleet voor overdracht.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
  {
    id: 'cd_7',
    title: 'Afwijkende dossierafspraken contractueel vastgelegd',
    description:
      'Als is afgeweken van de standaardinhoud uit NPR 8092 of art. 7:757a BW, is dat expliciet in de aannemingsovereenkomst of overdrachtsset vastgelegd; zonder afwijking geldt de standaardset.',
    legalBasis: 'Art. 7:757a BW / NPR 8092',
  },
];

export const CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS: ConsumerDossierDocumentRequirement[] = [
  {
    id: 'cdd_1',
    requirementId: 'cd_1',
    title: 'As-built tekeningen en installaties',
    description:
      'Verwijs naar de revisietekening, installatietekening of maplocatie van de gerealiseerde woning.',
    category: 'AS_BUILT',
    referenceLabel: 'Bestandslink of dossierreferentie',
    referencePlaceholder: 'Bijv. https://... of Revisie map A / Tekening 12',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Omschrijf welke as-built set hier wordt overgedragen.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_2',
    requirementId: 'cd_2',
    title: 'Materialen, kleurcodes en installatiespecificaties',
    description:
      'Leg vast waar materiaalstaten, RAL/NCS-kleuren en productspecificaties zijn terug te vinden.',
    category: 'MATERIALS',
    referenceLabel: 'Specificatie of referentie',
    referencePlaceholder: 'Bijv. Materialenstaat woningtype B / RAL 9010',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Noteer relevante kleur- of productspecificaties.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_3',
    requirementId: 'cd_3',
    title: 'Gebruiksfuncties en ruimtetoelichting',
    description:
      'Geef een verwijzing naar de gebruiksfuncties van ruimten of een opleverstaat die deze beschrijft.',
    category: 'USAGE_FUNCTIONS',
    referenceLabel: 'Referentie gebruiksfuncties',
    referencePlaceholder: 'Bijv. Opleverstaat niveau 0-1 / woningplattegrond',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Beschrijf bijzonder gebruik of beperkingen.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_4',
    requirementId: 'cd_4',
    title: 'Handleidingen installaties',
    description:
      'Verwijs naar de gebruikershandleidingen van warmtepomp, WTW, ventilatie, omvormer en overige installaties.',
    category: 'MANUALS',
    referenceLabel: 'Handleiding of portal-link',
    referencePlaceholder: 'Bijv. https://.../warmtepomp-handleiding.pdf',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Noteer serienummers of maplocaties indien relevant.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_5',
    requirementId: 'cd_5',
    title: 'Onderhoudsvoorschriften',
    description:
      'Leg vast waar onderhoudsinstructies voor daken, gevels, afwerkingen en installaties staan.',
    category: 'MAINTENANCE',
    referenceLabel: 'Onderhoudsdocument',
    referencePlaceholder: 'Bijv. Onderhoudsboek woning / gevel en dak',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Noteer onderhoudsintervallen of serviceverplichtingen.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_6',
    requirementId: 'cd_6',
    title: 'Garantiebewijzen en termijnen',
    description:
      'Verwijs naar garantiebewijzen, garantietermijnen en productgebonden waarborgen.',
    category: 'WARRANTIES',
    referenceLabel: 'Garantiebewijs of register',
    referencePlaceholder: 'Bijv. Garantiedossier lot 4 / serienummerregister',
    noteLabel: 'Toelichting',
    notePlaceholder: 'Noteer garantietermijnen of aanspreekpunten.',
    referenceRequired: true,
    notesRequired: false,
  },
  {
    id: 'cdd_7',
    requirementId: 'cd_7',
    title: 'Contractuele afwijkingen of bevestiging standaardset',
    description:
      'Noteer expliciet welke afwijkingen contractueel zijn afgesproken, of leg vast dat geen afwijkingen gelden en de standaardset van NPR 8092 van toepassing is.',
    category: 'CONTRACT_DEVIATIONS',
    referenceLabel: 'Contractreferentie',
    referencePlaceholder: 'Optioneel: contractartikel, bijlage of addendum',
    noteLabel: 'Afspraaknotitie',
    notePlaceholder:
      'Bijv. Geen afwijkingen overeengekomen; standaardset NPR 8092 volledig van toepassing.',
    referenceRequired: false,
    notesRequired: true,
  },
];

const isAiApproved = (status?: Evidence['aiStatus'] | null) =>
  ['APPROVED', 'OK', 'PASSED'].includes((status ?? '').toUpperCase());

export const isEvidenceCaptureRequirementComplete = (item: Evidence) => {
  const context = getEvidenceComplianceContext(item.inspectionPointId);
  const stopMomentSatisfied =
    !context.stopMoment || item.stopMomentConfirmed === true;
  const measurementSatisfied =
    !context.requiresMeasurementTool || item.measurementToolConfirmed === true;

  return stopMomentSatisfied && measurementSatisfied;
};

export const isEvidenceReadyForCompliance = (item: Evidence) =>
  item.syncStatus === 'SYNCED' &&
  item.exifVerified &&
  item.locationVerified === true &&
  isAiApproved(item.aiStatus) &&
  isEvidenceCaptureRequirementComplete(item);

const countChecked = (
  items:
    | StoredPunchlistItem[]
    | StoredGereedmeldingItem[]
    | StoredConsumerDossierItem[]
) => items.filter((item) => item.checked).length;

const hasText = (value?: string | null) => Boolean(value && value.trim().length > 0);

const getConsumerDossierDocumentDefinition = (documentId: string) =>
  CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.find((item) => item.id === documentId);

export const isConsumerDossierDocumentComplete = (
  document: StoredConsumerDossierDocument
) => {
  const definition = getConsumerDossierDocumentDefinition(document.id);

  if (!definition) {
    return hasText(document.referenceValue) || hasText(document.notes);
  }

  const referenceComplete =
    !definition.referenceRequired || hasText(document.referenceValue);
  const notesComplete = !definition.notesRequired || hasText(document.notes);

  return referenceComplete && notesComplete;
};

const addIssue = (
  issues: WkbComplianceIssue[],
  issue: WkbComplianceIssue | null
) => {
  if (issue) {
    issues.push(issue);
  }
};

export const getEvidenceComplianceContext = (
  inspectionPointId: string
): WkbEvidenceComplianceContext => {
  const nenContext = findNenTaskContextByInspectionPointId(inspectionPointId);

  if (nenContext) {
    return {
      title: nenContext.task.title,
      disciplineId: nenContext.discipline.id,
      disciplineTitle: nenContext.discipline.title,
      standards: nenContext.task.normCodes.join(' / ') || nenContext.discipline.standards,
      stopMoment: nenContext.task.stopMoment ?? null,
      requiresMeasurementTool: Boolean(nenContext.task.requiresMeasurementTool),
      dossierScope:
        nenContext.discipline.id === 'afbouw' ? 'BOTH' : 'BEVOEGD_GEZAG',
      selectionSource: 'NEN',
    };
  }

  const template = wkbTaskTemplates.find(
    (item) => item.inspectionPointId === inspectionPointId
  );

  if (template) {
    return {
      title: template.title,
      disciplineId: template.disciplineId,
      disciplineTitle: template.disciplineTitle,
      standards: template.standards,
      stopMoment: template.stopMoment ?? null,
      requiresMeasurementTool: Boolean(template.requiresMeasurementTool),
      dossierScope: template.dossierScope,
      selectionSource: 'WKB',
    };
  }

  return {
    title: inspectionPointId,
    disciplineId: null,
    disciplineTitle: null,
    standards: null,
    stopMoment: null,
    requiresMeasurementTool: false,
    dossierScope: null,
    selectionSource: 'UNKNOWN',
  };
};

export const buildWkbComplianceSnapshot = ({
  evidence,
  punchlistItems,
  gereedmeldingItems,
  consumerDossierItems,
  consumerDossierDocuments = [],
}: {
  evidence: Evidence[];
  punchlistItems: StoredPunchlistItem[];
  gereedmeldingItems: StoredGereedmeldingItem[];
  consumerDossierItems: StoredConsumerDossierItem[];
  consumerDossierDocuments?: StoredConsumerDossierDocument[];
}): WkbComplianceSnapshot => {
  const readyEvidenceCount = evidence.filter(isEvidenceReadyForCompliance).length;
  const localOnlyEvidenceCount = evidence.filter(
    (item) => item.syncStatus !== 'SYNCED'
  ).length;
  const failedEvidenceCount = evidence.filter(
    (item) => item.syncStatus === 'FAILED'
  ).length;
  const reviewEvidenceCount = evidence.filter(
    (item) => !isAiApproved(item.aiStatus)
  ).length;
  const missingExifCount = evidence.filter((item) => !item.exifVerified).length;
  const missingLocationVerificationCount = evidence.filter(
    (item) => item.locationVerified !== true
  ).length;
  const missingStopMomentCount = evidence.filter((item) => {
    const context = getEvidenceComplianceContext(item.inspectionPointId);
    return Boolean(context.stopMoment) && item.stopMomentConfirmed !== true;
  }).length;
  const missingMeasurementToolCount = evidence.filter((item) => {
    const context = getEvidenceComplianceContext(item.inspectionPointId);
    return context.requiresMeasurementTool && item.measurementToolConfirmed !== true;
  }).length;
  const punchlistCheckedCount = countChecked(punchlistItems);
  const gereedmeldingCheckedCount = countChecked(gereedmeldingItems);
  const consumerDossierCheckedCount = countChecked(consumerDossierItems);
  const consumerDossierDocumentsById = new Map(
    consumerDossierDocuments.map((item) => [item.id, item])
  );
  const consumerDossierDocumentFilledCount =
    CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.filter((definition) => {
      const document = consumerDossierDocumentsById.get(definition.id);
      return document ? isConsumerDossierDocumentComplete(document) : false;
    }).length;

  const modules = COMPLIANCE_MODULES.map((module) => {
    const relevantEvidence = evidence.filter((item) => {
      const context = getEvidenceComplianceContext(item.inspectionPointId);
      return context.disciplineId === module.id;
    });

    const readyModuleEvidence = relevantEvidence.filter(isEvidenceReadyForCompliance);
    const ready = readyModuleEvidence.length > 0;
    const covered = relevantEvidence.length > 0;

    return {
      id: module.id,
      title: module.title,
      legalBasis: module.legalBasis,
      dossierScope: module.dossierScope,
      evidenceCount: relevantEvidence.length,
      readyEvidenceCount: readyModuleEvidence.length,
      covered,
      ready,
      blocker: ready
        ? null
        : covered
          ? 'Bewijs aanwezig, maar nog niet juridisch dossierklaar.'
          : 'Nog geen bewijs voor deze discipline vastgelegd.',
    } satisfies WkbComplianceModuleStatus;
  });

  const requiredBevoegdGezagModules = modules.filter(
    (module) => module.dossierScope === 'BEVOEGD_GEZAG' || module.dossierScope === 'BOTH'
  );
  const missingBevoegdGezagModules = requiredBevoegdGezagModules.filter(
    (module) => !module.ready
  );

  const consumerRelevantEvidenceCount = evidence.filter((item) => {
    if (!isEvidenceReadyForCompliance(item)) {
      return false;
    }

    const context = getEvidenceComplianceContext(item.inspectionPointId);
    return context.dossierScope === 'CONSUMENT' || context.dossierScope === 'BOTH';
  }).length;

  const issues: WkbComplianceIssue[] = [];

  addIssue(
    issues,
    missingBevoegdGezagModules.length > 0
      ? {
          id: 'missing-modules',
          severity: 'critical',
          title: 'Technische Wkb-modules nog niet volledig gedekt',
          detail: missingBevoegdGezagModules
            .map((module) => module.title)
            .join(', '),
        }
      : null
  );

  addIssue(
    issues,
    failedEvidenceCount > 0
      ? {
          id: 'failed-sync',
          severity: 'critical',
          title: 'Bewijsstukken met mislukte synchronisatie',
          detail: `${failedEvidenceCount} bewijsstuk(ken) moeten opnieuw worden verwerkt voordat export of melding veilig is.`,
        }
      : null
  );

  addIssue(
    issues,
    missingExifCount > 0
      ? {
          id: 'missing-exif',
          severity: 'critical',
          title: 'Niet alle bewijsstukken hebben bevestigd EXIF-bewijs',
          detail: `${missingExifCount} bewijsstuk(ken) missen een bevestigde EXIF-status.`,
        }
      : null
  );

  addIssue(
    issues,
    missingLocationVerificationCount > 0
      ? {
          id: 'missing-location-verification',
          severity: 'critical',
          title: 'Locatieverificatie ontbreekt of is afgekeurd',
          detail: `${missingLocationVerificationCount} bewijsstuk(ken) missen een geldige projectlocatie-controle of tonen verhoogd spoof-risico.`,
        }
      : null
  );

  addIssue(
    issues,
    missingStopMomentCount > 0
      ? {
          id: 'missing-stopmoment-proof',
          severity: 'critical',
          title: 'Verplichte stopmomenten zijn niet overal bevestigd',
          detail: `${missingStopMomentCount} bewijsstuk(ken) missen een expliciete stopmoment-bevestiging.`,
        }
      : null
  );

  addIssue(
    issues,
    missingMeasurementToolCount > 0
      ? {
          id: 'missing-measurement-proof',
          severity: 'critical',
          title: 'Meetmiddelbewijs ontbreekt bij maatgevoelige controles',
          detail: `${missingMeasurementToolCount} bewijsstuk(ken) missen een bevestiging dat rolmaat of waterpas in beeld was.`,
        }
      : null
  );

  addIssue(
    issues,
    localOnlyEvidenceCount > 0
      ? {
          id: 'local-only',
          severity: 'warning',
          title: 'Nog niet alles staat veilig in de cloud',
          detail: `${localOnlyEvidenceCount} bewijsstuk(ken) staan nog lokaal of wachten op synchronisatie.`,
        }
      : null
  );

  addIssue(
    issues,
    reviewEvidenceCount > 0
      ? {
          id: 'review-required',
          severity: 'warning',
          title: 'Niet alle bewijsstukken zijn inhoudelijk akkoord',
          detail: `${reviewEvidenceCount} bewijsstuk(ken) hebben nog AI/review-aandacht.`,
        }
      : null
  );

  addIssue(
    issues,
    gereedmeldingItems.length === 0 || gereedmeldingCheckedCount !== gereedmeldingItems.length
      ? {
          id: 'gereedmelding-incomplete',
          severity: 'critical',
          title: 'Gereedmelding-checklist is nog niet compleet',
          detail:
            gereedmeldingItems.length === 0
              ? 'De gereedmelding-checklist is nog niet ingevuld of opgeslagen.'
              : `${gereedmeldingCheckedCount}/${gereedmeldingItems.length} vereisten zijn afgevinkt.`,
        }
      : null
  );

  addIssue(
    issues,
    punchlistItems.length === 0 || punchlistCheckedCount !== punchlistItems.length
      ? {
          id: 'punchlist-open',
          severity: 'warning',
          title: 'Opleverings-restpunten staan nog open',
          detail:
            punchlistItems.length === 0
              ? 'De opleverings-checklist is nog niet ingevuld of opgeslagen.'
              : `${punchlistItems.length - punchlistCheckedCount} restpunt(en) zijn nog niet afgevinkt.`,
        }
      : null
  );

  addIssue(
    issues,
    consumerDossierItems.length === 0 ||
    consumerDossierCheckedCount !== consumerDossierItems.length
      ? {
          id: 'consumer-dossier-incomplete',
          severity: 'warning',
          title: 'Consumentendossier mist nog overdrachtsinformatie',
          detail:
            consumerDossierItems.length === 0
              ? 'De consumentendossier-checklist is nog niet ingevuld of opgeslagen.'
              : `${consumerDossierCheckedCount}/${consumerDossierItems.length} consumentendossier-onderdelen zijn afgevinkt.`,
        }
      : null
  );

  addIssue(
    issues,
    consumerDossierDocumentFilledCount !==
    CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.length
      ? {
          id: 'consumer-documentation-missing',
          severity: 'warning',
          title: 'Consumentendossier mist nog documentreferenties',
          detail: `${consumerDossierDocumentFilledCount}/${CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.length} NPR 8092-documentonderdelen zijn inhoudelijk ingevuld.`,
        }
      : null
  );

  addIssue(
    issues,
    consumerRelevantEvidenceCount === 0
      ? {
          id: 'consumer-evidence-missing',
          severity: 'warning',
          title: 'Nog geen consumentgerichte opleverbewijzen dossierklaar',
          detail:
            'Leg minimaal afbouw-, glas- of opleveringsbewijs vast dat ook voor de koper bruikbaar is.',
        }
      : null
  );

  const criticalIssues = issues.filter((item) => item.severity === 'critical').length;
  const warningIssues = issues.filter((item) => item.severity === 'warning').length;

  const consumerChecklistComplete =
    consumerDossierItems.length > 0 &&
    consumerDossierCheckedCount === consumerDossierItems.length;
  const consumerDocumentSetComplete =
    consumerDossierDocumentFilledCount ===
    CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.length;
  const punchlistComplete =
    punchlistItems.length > 0 && punchlistCheckedCount === punchlistItems.length;
  const gereedmeldingComplete =
    gereedmeldingItems.length > 0 &&
    gereedmeldingCheckedCount === gereedmeldingItems.length;

  const bevoegdGezagReady =
    missingBevoegdGezagModules.length === 0 &&
    failedEvidenceCount === 0 &&
    missingExifCount === 0 &&
    missingLocationVerificationCount === 0 &&
    missingStopMomentCount === 0 &&
    missingMeasurementToolCount === 0 &&
    localOnlyEvidenceCount === 0 &&
    reviewEvidenceCount === 0 &&
    gereedmeldingComplete;

  const gereedmeldingReady =
    bevoegdGezagReady && gereedmeldingComplete && readyEvidenceCount > 0;

  const consumentReady =
    consumerChecklistComplete &&
    consumerDocumentSetComplete &&
    punchlistComplete &&
    consumerRelevantEvidenceCount > 0 &&
    failedEvidenceCount === 0;

  const achievedPoints =
    readyEvidenceCount +
    modules.filter((module) => module.ready).length * 2 +
    (gereedmeldingComplete ? 4 : 0) +
    (consumerChecklistComplete ? 3 : 0) +
    (punchlistComplete ? 2 : 0);
  const lostPoints = criticalIssues * 6 + warningIssues * 2;
  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(((achievedPoints - lostPoints + 16) / 30) * 100))
  );

  return {
    overallScore,
    readyEvidenceCount,
    localOnlyEvidenceCount,
    failedEvidenceCount,
    reviewEvidenceCount,
    missingExifCount,
    missingLocationVerificationCount,
    missingStopMomentCount,
    missingMeasurementToolCount,
    consumerDossierCheckedCount,
    consumerDossierTotalCount: consumerDossierItems.length,
    consumerDossierDocumentFilledCount,
    consumerDossierDocumentTotalCount:
      CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.length,
    punchlistCheckedCount,
    punchlistTotalCount: punchlistItems.length,
    gereedmeldingCheckedCount,
    gereedmeldingTotalCount: gereedmeldingItems.length,
    bevoegdGezagReady,
    gereedmeldingReady,
    consumentReady,
    modules,
    issues,
  };
};
