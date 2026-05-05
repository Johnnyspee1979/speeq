import type { Evidence, StoredGereedmeldingItem, StoredPunchlistItem } from '../../database/database';
import {
  CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS,
  CONSUMER_DOSSIER_REQUIREMENTS,
  buildWkbComplianceSnapshot,
  type StoredConsumerDossierDocument,
  type StoredConsumerDossierItem,
} from '../wkbCompliance';

const createEvidence = (
  inspectionPointId: string,
  overrides: Partial<Evidence> = {}
): Evidence => ({
  id: `e-${inspectionPointId}`,
  projectId: 'wkb-demo',
  inspectionPointId,
  mediaUri: 'file:///evidence.jpg',
  timestamp: '2026-03-14T09:00:00.000Z',
  latitude: 52.09,
  longitude: 5.12,
  gpsAccuracy: 3,
  exifHash: `hash-${inspectionPointId}`,
  exifVerified: true,
  userId: 'user-1',
  ifcGuid: null,
  fieldNote: null,
  stopMomentConfirmed: true,
  measurementToolConfirmed: true,
  locationVerified: true,
  locationSpoofRisk: 'LOW',
  locationSecurityMessage: 'GPS-signaal is bruikbaar voor Wkb-vastlegging.',
  syncStatus: 'SYNCED',
  aiStatus: 'PASSED',
  aiConfidence: 0.95,
  aiNotes: 'Akkoord',
  cloudRecordId: 11,
  ...overrides,
});

const createCheckedPunchlist = (): StoredPunchlistItem[] => [
  {
    id: 'p1',
    title: 'Restpunten afgerond',
    checked: true,
    updatedAt: '2026-03-14T09:00:00.000Z',
    syncStatus: 'PENDING',
  },
];

const createCheckedGereedmelding = (): StoredGereedmeldingItem[] => [
  {
    id: 'g1',
    title: 'Verklaring kwaliteitsborger aanwezig',
    checked: true,
    updatedAt: '2026-03-14T09:00:00.000Z',
    syncStatus: 'PENDING',
  },
];

const createCheckedConsumerDossier = (): StoredConsumerDossierItem[] =>
  CONSUMER_DOSSIER_REQUIREMENTS.map((item) => ({
    id: item.id,
    title: item.title,
    checked: true,
    updatedAt: '2026-03-14T09:00:00.000Z',
    syncStatus: 'PENDING',
  }));

const createCompleteConsumerDocuments = (): StoredConsumerDossierDocument[] =>
  CONSUMER_DOSSIER_DOCUMENT_REQUIREMENTS.map((item) => ({
    id: item.id,
    requirementId: item.requirementId,
    title: item.title,
    category: item.category,
    referenceValue: item.referenceRequired ? `Document ${item.id}` : '',
    notes: item.notesRequired
      ? 'Geen afwijkingen overeengekomen; standaardset NPR 8092 van toepassing.'
      : 'Gedocumenteerd in het consumentendossier.',
    updatedAt: '2026-03-14T09:00:00.000Z',
    syncStatus: 'PENDING',
  }));

describe('wkbCompliance', () => {
  it('contains the NPR 8092 default consumer dossier set including as-built and contract deviations', () => {
    expect(
      CONSUMER_DOSSIER_REQUIREMENTS.some(
        (item) => item.id === 'cd_1' && item.title.includes('As-built')
      )
    ).toBe(true);
    expect(
      CONSUMER_DOSSIER_REQUIREMENTS.some(
        (item) => item.id === 'cd_3' && item.title.includes('Gebruiksfuncties')
      )
    ).toBe(true);
    expect(
      CONSUMER_DOSSIER_REQUIREMENTS.some((item) => item.id === 'cd_7')
    ).toBe(true);
  });

  it('blocks bevoegd gezag readiness when key modules are missing', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [createEvidence('kik-wapening-002')],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(false);
    expect(snapshot.issues.some((issue) => issue.id === 'missing-modules')).toBe(true);
  });

  it('marks the full dossier ready when all major Wkb modules are covered', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('kik-wapening-002'),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
        createEvidence('beglazing-kitwerk-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(true);
    expect(snapshot.gereedmeldingReady).toBe(true);
    expect(snapshot.consumentReady).toBe(true);
  });

  it('blocks the consumer dossier if the consumer checklist is not completed', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('beglazing-kitwerk-001'),
        createEvidence('kik-wapening-002'),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: [],
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.consumentReady).toBe(false);
    expect(
      snapshot.issues.some((issue) => issue.id === 'consumer-dossier-incomplete')
    ).toBe(true);
  });

  it('flags local-only evidence as a blocker for bevoegd gezag exports', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('kik-wapening-002', { syncStatus: 'PENDING' }),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
        createEvidence('beglazing-kitwerk-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(false);
    expect(snapshot.localOnlyEvidenceCount).toBe(1);
  });

  it('blocks dossier readiness when a required stopmoment was not confirmed', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('kik-wapening-002', { stopMomentConfirmed: false }),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
        createEvidence('beglazing-kitwerk-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(false);
    expect(snapshot.missingStopMomentCount).toBe(1);
    expect(
      snapshot.issues.some((issue) => issue.id === 'missing-stopmoment-proof')
    ).toBe(true);
  });

  it('blocks dossier readiness when a measurement-based check is not confirmed', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('toegankelijkheid-draaicirkel-001', {
          measurementToolConfirmed: false,
        }),
        createEvidence('kik-wapening-002'),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('beglazing-kitwerk-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(false);
    expect(snapshot.missingMeasurementToolCount).toBe(1);
    expect(
      snapshot.issues.some((issue) => issue.id === 'missing-measurement-proof')
    ).toBe(true);
  });

  it('blocks dossier readiness when location verification is not approved', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('brand-doorvoering-001', {
          locationVerified: false,
          locationSpoofRisk: 'HIGH',
          locationSecurityMessage: 'Locatie lijkt gemanipuleerd; Wkb-vastlegging is geblokkeerd.',
        }),
        createEvidence('kik-wapening-002'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
        createEvidence('beglazing-kitwerk-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: createCompleteConsumerDocuments(),
    });

    expect(snapshot.bevoegdGezagReady).toBe(false);
    expect(snapshot.missingLocationVerificationCount).toBe(1);
    expect(
      snapshot.issues.some((issue) => issue.id === 'missing-location-verification')
    ).toBe(true);
  });

  it('blocks the consumer dossier when the documentset is not fully referenced', () => {
    const snapshot = buildWkbComplianceSnapshot({
      evidence: [
        createEvidence('beglazing-kitwerk-001'),
        createEvidence('kik-wapening-002'),
        createEvidence('brand-doorvoering-001'),
        createEvidence('meterkast-indeling-001'),
        createEvidence('riolering-afschot-001'),
        createEvidence('isolatie-aansluiting-001'),
      ],
      punchlistItems: createCheckedPunchlist(),
      gereedmeldingItems: createCheckedGereedmelding(),
      consumerDossierItems: createCheckedConsumerDossier(),
      consumerDossierDocuments: [],
    });

    expect(snapshot.consumentReady).toBe(false);
    expect(
      snapshot.issues.some((issue) => issue.id === 'consumer-documentation-missing')
    ).toBe(true);
  });
});
