import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_1010_CURRENT_EDITION = 'NEN 1010:2020+C1:2024' as const;

export interface Nen1010Task {
  id: string;
  discipline: 'Elektrotechniek';
  nenNorm: typeof NEN_1010_CURRENT_EDITION;
  inspectionPointId: string;
  normCodes: string[];
  component: string;
  description: string;
  builderInstruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
}

export const NEN_1010_TEMPLATES: Nen1010Task[] = [
  {
    id: 'NEN-1010-01-METERKAST-OPEN',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'meterkast-indeling-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Verdeelinrichting (Zonder Kap)',
    description:
      'Overzicht van hoofdschakelaar, 30mA aardlekschakelaars, automaten en groepverdeling in de geopende groepenkast.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een overzichtsfoto van de bekabelde groepenkast zonder kap. Hoofdschakelaar, 30mA aardlekschakelaars, automaten en labeling van PV, warmtepomp of laadpaal moeten leesbaar zijn. De Edge-AI controleert of de kast open is, telt de groepen per aardlekschakelaar en signaleert een onlogische of te volle verdeling.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_OPEN_BOARD_AND_COUNT',
  },
  {
    id: 'NEN-1010-02-AARDLEK-SPECIFICATIE',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'aardlek-specificatie-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Specificatie Aardlekschakelaar (30 mA)',
    description:
      'Haarscherpe close-up van aardlekschakelaars met leesbare 30 mA-markering en typeaanduiding.',
    builderInstruction:
      'Maak een scherpe close-up van de aardlekschakelaars in de meterkast. Zorg dat de opdruk leesbaar is, zodat OCR de 30 mA-classificatie en het type van de beveiliging kan uitlezen voor het dossier.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_RCD_30MA',
  },
  {
    id: 'NEN-1010-03-PV-GROEP',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'pv-eindgroep-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'PV-Omvormer op Eigen Eindgroep',
    description:
      'Detail van de PV-aansluiting op een eigen, onverdeelde automaat in de geopende verdeelinrichting.',
    builderInstruction:
      'Maak een detailfoto in de geopende meterkast. Toon dat de kabel van de PV-omvormer direct op een eigen, onverdeelde installatieautomaat is aangesloten en dat de groepsaanduiding leesbaar is.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },
  {
    id: 'NEN-1010-04-PV-STICKER',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'pv-waarschuwing-sticker-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'PV-Waarschuwingssticker',
    description:
      'Gesloten verdeelinrichting met zichtbare PV-waarschuwingssticker voor hulpverleners en servicepartijen.',
    builderInstruction:
      'Maak een overzichtsfoto van de gesloten verdeelinrichting. De verplichte PV-waarschuwingssticker moet duidelijk zichtbaar en leesbaar op of direct bij de kast zijn aangebracht.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_PV_STICKER',
  },
  {
    id: 'NEN-1010-05-AARDLEKTYPE-PV-EV',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'aardlek-type-pv-ev-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Typekeuze Aardlek PV / EV',
    description:
      'Detail van de toegepaste aardlekbeveiliging of RDC-DD/DC-detectie bij PV-omvormer of laadpunt.',
    builderInstruction:
      'Maak een detailfoto van de toegepaste aardlekbeveiliging of DC-foutstroomdetectie voor PV-omvormer of laadpunt. Het type van de beveiliging en eventuele RDC-DD/DC-detectie moeten leesbaar zijn, inclusief de gekoppelde eindgroep.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_RCD_TYPE_B',
  },
  {
    id: 'NEN-1010-06-CAP-BADKAMER',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'cap-badkamer-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Aanvullende Potentiaalvereffening (CAP)',
    description:
      'Centraal aardpunt met vereffeningsdraden naar aardmat, radiator en waterleiding in natte ruimte.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een close-up foto van het centraal aardpunt in badkamer of technische ruimte. Vereffeningsdraden naar aardmat, radiator en waterleiding moeten vastgeschroefd en herleidbaar zichtbaar zijn voordat de wand wordt gesloten.',
    requiresExif: true,
    stopMoment: 'VOOR SLUITEN WAND/VLOER',
    aiValidationKey: 'DETECT_CAP_WIRES',
  },
  {
    id: 'NEN-1010-07-KLEURCODERING',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'elektra-kleurcodering-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Kleurcodering Bedrading',
    description:
      'Lasdoos of aansluiting met correct herkenbare ader-kleuren en zonder foutieve omkleuring van de nul.',
    builderInstruction:
      'Maak een detailfoto van een geopende lasdoos of aansluiting. Bewijs dat ader-kleuren consequent en herkenbaar zijn toegepast, dat de nuldraad correct als blauw herkenbaar is en dat aders niet improviserend zijn omgekleurd.',
    requiresExif: true,
    stopMoment: 'VOOR AFMONTEREN / DICHTZETTEN',
    aiValidationKey: 'DETECT_WIRE_COLORS',
  },
  {
    id: 'NEN-1010-08-BEUGELING',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'elektra-beugeling-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Leidinginfrastructuur & Beugeling',
    description:
      'Installatiebuizen, bochten en bevestigingsafstanden met meetlint vóór dichtzetten.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer buizen, bochten en bevestigingsafstanden met een meetlint in beeld. Laat zien dat beugeling en draadvulling conform uitvoering zijn aangebracht.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-1010-09-BADKAMER-ZONE',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'badkamer-zone-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Badkamerzones & IP-bescherming',
    description:
      'Maatvoering van schakelmateriaal of aansluitpunt ten opzichte van douche of badzone.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer het elektra-aansluitpunt in de badkamer met een rolmaat in beeld. Toon de afstand tot douche of bad en het toegepaste spatwaterbestendige materiaal vóór tegelwerk of afmontage.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR TEGELWERK / AFMONTEREN',
    aiValidationKey: 'DETECT_BATHROOM_ZONE',
  },
  {
    id: 'NEN-1010-10-CENTRAALDOOS',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'centraaldoos-bedrading-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Centraaldozen & Afgedopte Aders',
    description:
      'Centraaldoos of laspunt met veilige verbindingen en geen losse, onbeschermde aders.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van centraaldoos of laspunt voordat het plafond of de wand wordt gesloten. Verbindingen, lasklemmen en afgedopte aders moeten veilig en toegankelijk in de doos liggen.',
    requiresExif: true,
    stopMoment: 'VOOR PLAFOND DICHT',
    aiValidationKey: 'DETECT_CAPPED_WIRES',
  },
  {
    id: 'NEN-1010-11-DOORVOER',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'elektra-doorvoer-bescherming-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Mechanische Bescherming & Doorvoeren',
    description:
      'Kabel- en buisdoorvoeren met beschermbuis, wartel of randbescherming tegen beschadiging.',
    builderInstruction:
      'Maak een detailfoto van kabel- of buisdoorvoeren in meterkast, vloer of wand. Toon beschermbuis, wartel of randbescherming aan zodat de kabelisolatie niet kan insnijden of beschadigen.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_CABLE_PROTECTION',
  },
  {
    id: 'NEN-1010-12-AARDLEK-TEST',
    discipline: 'Elektrotechniek',
    nenNorm: NEN_1010_CURRENT_EDITION,
    inspectionPointId: 'aardlek-test-001',
    normCodes: [NEN_1010_CURRENT_EDITION],
    component: 'Aardlekschakelaar Beproeving',
    description:
      'Installatietester of testdisplay met aanspreekstroom, uitschakeltijd en herleidbare koppeling naar de beproefde aardlekschakelaar.',
    builderInstruction:
      'Maak tijdens de eerste inspectie een foto van de installatietester of het testdisplay waarmee de aardlekschakelaar wordt beproefd. Aanspreekstroom, uitschakeltijd en de identificatie van de beproefde aardlekschakelaar of groep moeten leesbaar zijn; controleer ook de testknop en leg het resultaat vast.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_TRIP_TIME',
  },
];
