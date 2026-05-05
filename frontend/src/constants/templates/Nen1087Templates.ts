import type { AiValidationKey, CaptureTimerConfig } from '../../types/CaptureTask';

const NEN_1087_CURRENT_EDITION = 'NEN 1087 / NEN 8087' as const;

export interface Nen1087Task {
  id: string;
  discipline: 'Installatietechniek';
  nenNorm: typeof NEN_1087_CURRENT_EDITION;
  inspectionPointId: string;
  normCodes: string[];
  component: string;
  description: string;
  builderInstruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  timerConfig?: CaptureTimerConfig;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
}

export const NEN_1087_TEMPLATES: Nen1087Task[] = [
  {
    id: 'NEN-1087-01-UNIT-KANAALROUTE',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1087_CURRENT_EDITION,
    inspectionPointId: 'ventilatiekanalen-001',
    normCodes: ['NEN 1087', 'NEN 8087'],
    component: 'Ventilatie-unit, Kanaalroute & Ventielen',
    description:
      'Overzicht van ventilatie-unit, kanaalaansluitingen, ophanging en ventielposities vóór het sluiten van plafond of schacht.',
    builderInstruction:
      'WKB STOPMOMENT: Maak overzichtsfoto’s van de ventilatie-unit, kanaalroute, kanaalaansluitingen en ventielposities voordat plafonds of schachten worden gesloten. Zorg dat de kanaalvoering, bevestiging, richting en toegepaste componenten duidelijk herkenbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR PLAFOND DICHT',
  },
  {
    id: 'NEN-1087-02-TOEVOER-DEBIET',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1087_CURRENT_EDITION,
    inspectionPointId: 'ventilatie-toevoer-debiet-001',
    normCodes: ['NEN 1087'],
    component: 'Toevoerventiel Debietmeting',
    description:
      'Debietmeting op toevoerventiel met anemometer of flowmeter en leesbare meetwaarde in beeld.',
    builderInstruction:
      'Meet het luchtdebiet op een toevoerventiel met een anemometer of flowmeter en maak een scherpe detailfoto van de meetopstelling. Toon de actuele meetwaarde en de ingestelde ventilatiestand aan zodat de inregeling as-built herleidbaar is.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_ANEMOMETER',
  },
  {
    id: 'NEN-1087-03-AFVOER-DEBIET',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1087_CURRENT_EDITION,
    inspectionPointId: 'ventilatie-afvoer-debiet-001',
    normCodes: ['NEN 1087'],
    component: 'Afvoerventiel Debietmeting',
    description:
      'Debietmeting op afvoerventiel met anemometer of flowmeter en leesbare meetwaarde in beeld.',
    builderInstruction:
      'Meet het luchtdebiet op een afvoerventiel met een anemometer of flowmeter en fotografeer de meetwaarde samen met het ventiel. Leg hiermee vast dat ook de afvoerzijde van het systeem aantoonbaar is ingeregeld.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_ANEMOMETER',
  },
  {
    id: 'NEN-8087-04-RENOVATIE-DOORSTROOM',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1087_CURRENT_EDITION,
    inspectionPointId: 'ventilatie-renovatie-doorstroom-001',
    normCodes: ['NEN 8087'],
    component: 'Renovatievoorziening & Doorstroom',
    description:
      'Ventilatievoorziening in bestaande bouw met zichtbare aanpassing van rooster, doorstroomopening of renovatiekanaal.',
    builderInstruction:
      'Maak in renovatie- of bestaande-bouwsituaties een overzichtsfoto van de toegepaste ventilatievoorziening en eventuele doorstroomopening, rooster of kanaalaanpassing. Het beeld moet laten zien hoe de vernieuwde ventilatieroute in de bestaande situatie is opgelost.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },
];
