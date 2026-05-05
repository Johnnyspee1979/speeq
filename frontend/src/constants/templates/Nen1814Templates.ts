import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_1814_CURRENT_EDITION = 'NEN 1814' as const;

export interface Nen1814Task {
  id: string;
  discipline: 'Bouwfysica & Gebruik';
  nenNorm: typeof NEN_1814_CURRENT_EDITION;
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

export const NEN_1814_TEMPLATES: Nen1814Task[] = [
  {
    id: 'NEN-1814-01-VERANKERING',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-steunbeugel-verankering-001',
    normCodes: [NEN_1814_CURRENT_EDITION, 'Bbl'],
    component: 'Verankering Steunbeugels (Ruwbouwfase)',
    description:
      'Detailfoto van dragende achterconstructie, achterhout of montageplaten vóór het sluiten van de wand.',
    builderInstruction:
      'WKB STOPMOMENT: Maak in de ruwbouwfase een detailfoto van het dragende achterhout, de montageplaat of de massieve wand ter plaatse van het rolstoeltoilet. Toon onweerlegbaar aan dat de steunbeugels straks in een solide draagconstructie worden verankerd voordat de wand wordt gesloten en betegeld.',
    requiresExif: true,
    stopMoment: 'VOOR SLUITEN WAND',
    aiValidationKey: 'DETECT_WALL_ANCHORING',
  },
  {
    id: 'NEN-1814-02-BEUGEL-HOOGTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-steunbeugel-hoogte-001',
    normCodes: [NEN_1814_CURRENT_EDITION, 'Bbl'],
    component: 'Montagehoogte Steunbeugels 700-850 mm',
    description:
      'Afgemonteerde horizontale steunbeugels aan beide zijden van het toilet met verticale maatvoering vanaf de vloer.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van de afgemonteerde horizontale steunbeugels aan beide zijden van het toilet. Plaats een uitgerolde rolmaat verticaal vanaf de afgewerkte vloer tot aan de beugel en toon aan dat de montagehoogte tussen 700 en 850 mm ligt. Leg waar mogelijk ook de circa 32 mm diameter van de beugel en de stabiele eindmontage vast.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_SUPPORT_BAR_HEIGHT',
  },
  {
    id: 'NEN-1814-03-DREMPEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-drempel-20mm',
    normCodes: [NEN_1814_CURRENT_EDITION, 'Bbl'],
    component: 'Drempelhoogte Maximaal 20mm',
    description: 'Controle op maximale niveauverschillen en drempelhoogte.',
    builderInstruction: 'WKB STOPMOMENT: Leg de drempelhoogte bij de toegang of binnendeuren vast met een duidelijk leesbare rolmaat of meetblokje. De maximale opstap mag niet meer dan 20 mm bedragen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_THRESHOLD_HEIGHT',
  },
  {
    id: 'NEN-1814-04-DEURBREEDTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-doorgang-breedte',
    normCodes: [NEN_1814_CURRENT_EDITION, 'Bbl'],
    component: 'Vrije Doorgangsbreedte Deuren',
    description: 'Controle van de vrije minimale (netto) doorgangsbreedte bij deuren.',
    builderInstruction: 'WKB STOPMOMENT: Bepaal met de lasermeter of rolmaat de netto vrije doorgangsbreedte van de deur (tussen de kozijnstijlen minus de deurdikte indien niet volledig te openen). Toon de afgelezen breedte aan op beeld.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DOOR_WIDTH',
  },
  {
    id: 'NEN-1814-05-DRAAICIRKEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-draaicirkel',
    normCodes: [NEN_1814_CURRENT_EDITION, 'NEN 9120', 'Bbl'],
    component: 'Draaicirkel Rolstoel',
    description: 'Vrije obstakelvrije manoeuvreerruimte en draaicirkel in wezenlijke ruimten.',
    builderInstruction: 'WKB STOPMOMENT: Maak een overzichtsfoto van de vrije vloeroppervlakte in de verkeersruimte of sanitaire cel. Controleer visueel met rolmaat of vloermarkering of de vereiste draaicirkel (vaak Ø 1500 mm) daadwerkelijk obstakelvrij kan worden gerealiseerd.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TURNING_CIRCLE',
  },
  {
    id: 'NEN-1814-06-HELLINGBAAN',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-hellingbaan',
    normCodes: [NEN_1814_CURRENT_EDITION, 'NEN 9120'],
    component: 'Hellingshoek Hellingbaan',
    description: 'Overbrugging niveauverschillen via verantwoorde helling in plaats van drempel.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer het hellingvlak met een duimstok, waterpas of digitale hellingmeter ter controle van het percentage (vaak max 1:20 of 5%).',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_RAMP_SLOPE',
  },
  {
    id: 'NEN-1814-07-BEDIENING',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-bediening-hoogte',
    normCodes: [NEN_1814_CURRENT_EDITION, 'Bbl', 'NEN 1010'],
    component: 'Montagehoogte Bedieningselementen',
    description: 'Hoogte controle van schakelmateriaal en wandcontactdozen voor rolstoelgebruik.',
    builderInstruction: 'WKB STOPMOMENT: Gebruik een verticale rolmaat vanaf de afgewerkte vloer tot aan de wandcontactdoos of lichtschakelaar in de toegankelijke ruimten. De hoogte moet regulier tussen de 900 mm en 1200 mm liggen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'DETECT_SWITCH_HEIGHT',
  },
  {
    id: 'NEN-1814-08-GLASMARKERING',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_1814_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-glas-markering',
    normCodes: [NEN_1814_CURRENT_EDITION, 'NEN 3569'],
    component: 'Visuele Markering Glas',
    description: 'Aanwezigheid contrastmarkering of gematteerde strepen ter voorkoming letsel bij slechthorenden/slechtzienden.',
    builderInstruction: 'WKB STOPMOMENT: Zorg dat grote glazen wanden of pendeldeuren in looproutes altijd zijn voorzien van visuele (contrast) markeringen. Fotografeer deze gematteerde of geplakte elementen op de deur op ooghst/borsthoogte.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_MARKING',
  },
];
