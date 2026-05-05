import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_9120_CURRENT_EDITION = 'NEN 9120:2025' as const;

export interface Nen9120Task {
  id: string;
  discipline: 'Bouwfysica & Gebruik';
  nenNorm: typeof NEN_9120_CURRENT_EDITION;
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

export const NEN_9120_TEMPLATES: Nen9120Task[] = [
  {
    id: 'NEN-9120-01-TOILETRUIMTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-toiletruimte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl', 'NEN 2580'],
    component: 'Rolstoeltoilet Binnenmaat 1650 x 2200 mm',
    description:
      'Netto binnenmaat van integraal toegankelijke toiletruimte in de ruwbouwfase met rolmaat in beeld.',
    builderInstruction:
      'WKB STOPMOMENT: Leg in de ruwbouwfase een uitgerolde rolmaat langs beide hoofdrichtingen van de toiletruimte en maak een overzichtsfoto. Bewijs dat de netto binnenmaat minimaal 1650 x 2200 mm bedraagt en voldoende basis biedt voor een obstakelvrije draaicirkel van 1500 mm die buiten het draaivlak van de deur kan blijven voordat tegelwerk of sanitair de maat verkleint.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFBOUW',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-02-DEURBREEDTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-deurbreedte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Vrije Doorgang Deur 850 mm',
    description:
      'Netto vrije doorgangsbreedte van de deuropening met horizontale rolmaat in beeld.',
    builderInstruction:
      'WKB STOPMOMENT: Open de deur volledig. Plaats een uitgerolde rolmaat horizontaal in de deuropening en fotografeer de netto vrije doorgang. Bewijs dat de vrije doorgangsbreedte minimaal 850 mm bedraagt op de toegangsroute.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DOOR_WIDTH',
  },
  {
    id: 'NEN-9120-03-DREMPEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-drempelhoogte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Drempelhoogte Toegangsroute max. 20 mm',
    description:
      'Verticale maatvoering van de drempelhoogte met rolmaat langs de afgewerkte vloeren.',
    builderInstruction:
      'WKB STOPMOMENT: Plaats een rolmaat verticaal langs de drempel op de toegangsroute en maak een detailfoto. Bewijs dat het hoogteverschil tussen de afgewerkte vloeren maximaal 20 mm bedraagt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_THRESHOLD_HEIGHT',
  },
  {
    id: 'NEN-9120-04-TOILET-DRAAICIRKEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-draaicirkel-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Draaicirkel Toilet 1500 x 1500 mm',
    description:
      'Obstakelvrije draaicirkel van 1500 mm met meetlint in beeld en bruikbare opstelruimte rond het closet.',
    builderInstruction:
      'WKB STOPMOMENT: Leg de volledige obstakelvrije draaicirkel van 1500 mm vast met een uitgerolde rolmaat of meetlint in beeld. Fotografeer de ruimte zo dat aantoonbaar is dat de draairuimte en de benodigde opstelruimte rond het closet daadwerkelijk bruikbaar zijn en niet worden geblokkeerd door deur, sanitair of andere obstakels.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TURNING_CIRCLE',
  },
  {
    id: 'NEN-9120-16-TOILET-DEURZWAAI',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-toilet-deurzwaai-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Toiletdeur draait naar buiten en buiten draaicirkel',
    description:
      'Bewijs dat de toiletdeur naar buiten opent en dat de draaicirkel volledig buiten het draaivlak van de deur blijft.',
    builderInstruction:
      'WKB STOPMOMENT: Open de toiletdeur volledig en maak een overzichtsfoto waarop zowel de deuropening als de gemarkeerde of gemeten draaicirkel zichtbaar zijn. Toon aan dat de deur naar buiten draait en dat de volledige draaicirkel van 1500 mm buiten het draaivlak van de deur ligt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DOOR_SWING_CLEARANCE',
  },
  {
    id: 'NEN-9120-17-WASBAK-OVERLAP',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-toilet-wasbak-hoogte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Wasbak-overlap draaicirkel bij min. 750 mm',
    description:
      'Hoogtemeting van onderzijde of vrije onderrijdbare ruimte van de wasbak als deel van de draaicirkel onder de wasbak valt.',
    builderInstruction:
      'Plaats een rolmaat verticaal onder de wasbak en maak een detailfoto van de vrije onderrijdbare hoogte. Als een deel van de draaicirkel onder de wasbak valt, moet aantoonbaar zijn dat de wasbak op minimaal 750 mm hoogte is gemonteerd zodat voetsteunen van de rolstoel onder de wasbak kunnen draaien.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE_HEIGHT',
  },
  {
    id: 'NEN-9120-06-TRANSFER',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-transfer-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Transferruimte naast Closet 900 mm',
    description:
      'Vrije zijruimte naast closetpot voor transfer van rolstoel naar toilet.',
    builderInstruction:
      'Trek de rolmaat uit vanaf de zijkant van de closetpot tot aan de zijwand en fotografeer dit. De vrije transferruimte van minimaal 900 mm moet onweerlegbaar zichtbaar zijn.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-07-CLOSETHOOGTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-closethoogte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Zwevend Closet 500 mm',
    description:
      'Zithoogte van hangend closet met vrijgehouden vloerzone voor toegankelijke sanitaire ruimte.',
    builderInstruction:
      'Meet de zithoogte van het hangende closet en fotografeer dit met een rolmaat in beeld. Toon aan dat een hoogte van circa 500 mm is aangehouden en dat de vloer onder het closet vrij blijft om de draairuimte beter bruikbaar te houden.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-08-DOUCHE-ROLLATOR-DRAAICIRKEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douche-draaicirkel-1050-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Doucheruimte Loophulpmiddel 1050 mm',
    description:
      'Obstakelvrije draaicirkel van minimaal 1050 mm voor bezoekbare of aanpasbare doucheruimte met loophulpmiddel.',
    builderInstruction:
      'WKB STOPMOMENT: Leg in de doucheruimte een obstakelvrije draaicirkel van minimaal 1050 mm vast voor gebruikers met een loophulpmiddel zoals een rollator. Fotografeer de maatvoering in de ruimte, inclusief wanden, douchehoek, afvoer en vaste obstakels, zodat de bruikbare manoeuvreerruimte objectief herleidbaar is.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TURNING_CIRCLE',
  },
  {
    id: 'NEN-9120-09-DOUCHE-ROLSTOEL-DRAAICIRKEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douche-draaicirkel-1500-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Rolstoeltoegankelijke Doucheruimte 1500 mm',
    description:
      'Volledige obstakelvrije draaicirkel van 1500 mm in rolstoeltoegankelijke of openbaar toegankelijke douche.',
    builderInstruction:
      'WKB STOPMOMENT: Leg binnen de doucheruimte een volledige obstakelvrije draaicirkel van 1500 mm vast. Fotografeer de maatvoering zo dat duidelijk is dat de draairuimte daadwerkelijk bruikbaar is binnen het douchelokaal en niet wordt aangetast door sanitair, wanden of andere obstakels.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TURNING_CIRCLE',
  },
  {
    id: 'NEN-9120-13-DOUCHE-BINNENMAAT',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-doucheruimte-binnenmaat-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Rolstoeltoegankelijke Doucheruimte 1500 x 1800 mm',
    description:
      'Netto binnenmaat van een zelfstandige rolstoeltoegankelijke doucheruimte met maatvoering in twee richtingen.',
    builderInstruction:
      'WKB STOPMOMENT: Leg de netto binnenmaat van de rolstoeltoegankelijke doucheruimte vast met rolmaat of lasermaat in beeld. Bewijs dat de ruimte minimaal 1500 mm x 1800 mm bedraagt voordat afbouw, sanitair of aftimmering de bruikbare maat verkleinen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFBOUW',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-14-GECOMBINEERDE-DOUCHE-TOILET-RUIMTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-gecombineerde-douche-toilet-binnenmaat-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Gecombineerde Douche- en Toiletruimte 2200 x 2200 mm',
    description:
      'Netto binnenmaat van gecombineerde rolstoeltoegankelijke douche- en toiletruimte met maatvoering in twee richtingen.',
    builderInstruction:
      'Leg in hotels, campings, groepsaccommodaties of andere gecombineerde sanitaire ruimten de netto binnenmaat vast met rolmaat of lasermaat in beeld. Bewijs dat de totale ruimte minimaal 2200 mm x 2200 mm bedraagt zodat toilet, douche en manoeuvreerruimte gezamenlijk bruikbaar blijven.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFBOUW',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-10-DOUCHE-DEURZWAAI',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douche-deurzwaai-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Douchedeur buiten 1500 mm draaivlak',
    description:
      'Bewijs dat de 1500 mm draaicirkel buiten het bereik van de opengaande douche- of ruimtedeur blijft.',
    builderInstruction:
      'Open de deur volledig en maak een overzichtsfoto waarop zowel de deuropening als de gemarkeerde of gemeten 1500 mm draaicirkel zichtbaar zijn. Toon aan dat de volledige draaicirkel zich buiten het draaivlak van de deur bevindt, zodat een rolstoelgebruiker veilig kan manoeuvreren.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DOOR_SWING_CLEARANCE',
  },
  {
    id: 'NEN-9120-11-DOUCHEVLOER-AFSCHOT',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douchevloer-afschot-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Drempelloze Douchevloer en Afschot max. 2%',
    description:
      'Drempelloze, slipvrije vloer zonder abrupte hoogteverschillen met gelijkmatig afschot naar de afvoer van maximaal 2 procent.',
    builderInstruction:
      'WKB STOPMOMENT: Leg de douchevloer vast met een waterpas, digitale hellingmeter of strakke maatvoering in beeld. Bewijs dat de vloer drempelloos, slipvrij en zonder abrupte hoogteverschillen is uitgevoerd en dat het afschot richting afvoer gelijkmatig blijft en maximaal 2 procent bedraagt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_WATERPAS',
  },
  {
    id: 'NEN-9120-15-DOUCHE-GEBRUIKSRUIMTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douche-gebruiksruimte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Douche Gebruiksruimte, Hulpzone & Douchezitje',
    description:
      'Obstakelvrije gebruiksruimte van minimaal 900 x 1200 mm met maatvoering bij douchezitje en hulpverleningsruimte.',
    builderInstruction:
      'WKB STOPMOMENT: Leg de gebruiksruimte van de douche vast met maatvoering in beeld. Bewijs dat minimaal 900 x 1200 mm obstakelvrij beschikbaar is, dat bij hulpverlening ten minste 900 mm vrije ruimte naast het douchezitje aanwezig blijft en dat het hart van het douchezitje minimaal 550 mm uit de zijwand ligt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-9120-12-DOUCHE-DROGE-OPSTELRUIMTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_9120_CURRENT_EDITION,
    inspectionPointId: 'toegankelijkheid-douche-droge-opstelruimte-001',
    normCodes: [NEN_9120_CURRENT_EDITION, 'Bbl'],
    component: 'Droge Rolstoelopstelruimte naast Douche',
    description:
      'Vrije droge opstelruimte voor rolstoel tussen douchezone en closet in gecombineerde sanitaire ruimten.',
    builderInstruction:
      'Maak in een gecombineerde toilet- en doucheruimte een overzichtsfoto met maatvoering van de droge opstelruimte tussen de douche en de closetpot. Toon aan dat naast de draaicirkel ook een bruikbare droge rolstoelpositie overblijft, zodat natte wielen niet door de hele ruimte hoeven te worden gereden.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
];
