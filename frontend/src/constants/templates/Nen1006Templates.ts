import type {
  AiValidationKey,
  CaptureTimerConfig,
} from '../../types/CaptureTask';

export interface Nen1006Task {
  id: string;
  discipline: 'Installatietechniek';
  nenNorm: 'NEN 1006 / WB 2.3';
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

export const NEN_1006_TEMPLATES: Nen1006Task[] = [
  {
    id: 'NEN-1006-01-HOTSPOTS',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-hotspot-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Legionellapreventie & Bevestiging',
    description:
      'Overzichtsfoto met leidingafstand, isolatie en zichtbare leidingbeugeling in de ruwbouw.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer het leidingtracé op de ruwbouwvloer. Gebruik een rolmaat om de minimale fysieke afstand of thermische isolatie tussen warmwater/CV en koudwater aan te tonen (max 25°C). Zorg dat tevens de deugdelijke beugeling zichtbaar is.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_PIPE_SEPARATION',
  },
  {
    id: 'NEN-1006-02-MANTELBUIZEN',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-mantelbuis-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Doorvoeringen & Bescherming',
    description:
      'Detailfoto van leidingdoorvoeren met zichtbare mantelbuis als mechanische bescherming.',
    builderInstruction:
      'Maak een detailfoto van de leidingen ter plaatse van de wand- of vloerdoorvoeren. Bewijs visueel dat er beschermende mantelbuizen zijn toegepast ter voorkoming van mechanische schade.',
    requiresExif: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_PROTECTION_PIPE',
  },
  {
    id: 'NEN-1006-03-PERSPROEF-START',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-persproef-start-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Persproef (Aanvang)',
    description:
      'Detailfoto van de manometer bij aanvang van de persproef op testdruk.',
    builderInstruction:
      'WKB STOPMOMENT: Sluit de persinstallatie aan en breng het leidingsysteem op de vereiste druk (bijv. 1,5 keer de werkdruk). Maak een heldere detailfoto van de wijzer op de manometer om de begindruk te registreren.',
    requiresExif: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_MANOMETER',
  },
  {
    id: 'NEN-1006-04-PERSPROEF-EIND',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-persproef-eind-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Persproef (Eindcontrole Timer)',
    description:
      'Detailfoto van de manometer na de normatieve wachttijd volgens de gekozen testmethode.',
    builderInstruction:
      'Maak na het aflopen van de verplichte afpers-timer (bijv. 10 of 120 minuten) opnieuw een foto van de manometer. Dit fotobewijs toont onweerlegbaar de lekdichtheid en drukbestendigheid in wanden en vloeren aan.',
    requiresExif: true,
    requiresTimer: true,
    timerConfig: {
      variant: 'NEN1006_PERSPROEF',
      startInspectionPointId: 'nen1006-persproef-start-001',
      defaultProfileId: 'WATER_PRESSURE_RESISTANCE_10_MIN',
      supportedProfileIds: [
        'WATER_LEAK_TIGHTNESS_10_MIN',
        'WATER_PRESSURE_RESISTANCE_10_MIN',
        'AIR_GAS_LEAK_TIGHTNESS_120_MIN',
        'AIR_GAS_PRESSURE_RESISTANCE_10_MIN',
      ],
    },
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_MANOMETER',
  },
  {
    id: 'NEN-1006-05-AFMONTAGE',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-afmontage-kit-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Waterdichte Afmontage Natte Ruimte',
    description: 'Close-up van waterdicht afgekitte muurplaten en S-koppelingen vóór rozetten.',
    builderInstruction:
      'Maak een close-up foto van de muurplaten (bijv. de S-koppelingen in de douchecabine). Toon aan dat de sparingen in het tegelwerk rondom de koppeling volledig waterdicht zijn afgekit om lekkage in de spouw te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR AFMONTEREN',
    aiValidationKey: 'DETECT_SEALANT',
  },
  {
    id: 'NEN-1006-06-SPOELEN',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-spoelen-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Doorspoelen voor Ingebruikname',
    description: 'Bewijs van actief doorspoelen met geopende tappunten vóór ingebruikname.',
    builderInstruction:
      'Toon met een overzichtsfoto (met opengedraaide tappunten) aan dat de volledige leidingwaterinstallatie is doorgespoeld ter preventie van restvuil en verontreiniging.',
    requiresExif: true,
    stopMoment: 'BIJ OPLEVERING',
  },
  {
    id: 'NEN-1006-07-TERUGSTROOM',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-terugstroom-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Terugstroombeveiliging (Keerklep)',
    description: 'Aantonen aanwezigheid van correcte keerklep (EA/CA/BA) bij risicopunten.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van de terugstroombeveiliging (bijv. de inlaatcombinatie bij de cv-ketel of keerklep bij een buitenkraan). De stroomrichting-pijl en het KIWA-keurmerk moeten indien mogelijk zichtbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_CHECK_VALVE',
  },
  {
    id: 'NEN-1006-08-DODE-LEIDING',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-dode-leiding-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Beperking Dode Leidingstukken',
    description: 'Visuele controle dat afgedopte/toekomstige aansluitpunten voldoen aan max. lengte.',
    builderInstruction:
      'Fotografeer een afgedopt of tijdelijk leidingstuk (bijv. voor toekomstige wastafel). Toon aan (eventueel met rolmaat) dat het dode leidingstuk niet langer is dan 5x de inwendige diameter om legionella-groei te voorkomen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_TAPE_MEASURE',
  },
  {
    id: 'NEN-1006-09-WATERMETER',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-watermeter-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Watermeteropstelling & Hoofdkraan',
    description: 'Overzicht watermeter, beugeling en de toegankelijkheid van de hoofdkraan.',
    builderInstruction:
      'Maak een overzichtsfoto van de meterkast: de watermeteropstelling moet spanningsvrij gebeugeld zijn en de hoofdafsluiter moet vrij toegankelijk zijn.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },
  {
    id: 'NEN-1006-10-WARMWATERTAP',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-warmwatertap-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Warmwatertoestel Aansluiting',
    description: 'Controle van inlaatcombinatie en beveiligingen bij boiler/warmtepomp.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer de koudwater-aansluiting op de warmteopwekker. Toon aan dat er een goedgekeurde inlaatcombinatie of ontlastklep met trechter is gemonteerd om overmatige druk tijdens verwarming veilig af te voeren.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_SAFETY_VALVE',
  },
  {
    id: 'NEN-1006-11-VERBORGEN-VERBINDING',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN 1006 / WB 2.3',
    inspectionPointId: 'nen1006-verborgen-verbinding-001',
    normCodes: ['NEN 1006', 'WB 2.3'],
    component: 'Verborgen Leidingverbindingen',
    description: 'Controle op toegestane verbindingstechniek in ontoegankelijke plekken (vloer/wand).',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van leidingverbindingen die in de dekvloer of wand worden weggewerkt. Knelkoppelingen zijn in onbereikbare ruimtes NIET toegestaan. Toon aan dat de leiding uit één stuk bestaat (mantelbuis/slang-in-slang) of dat er een goedgekeurde permanente perstechniek is gebruikt.',
    requiresExif: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
  },
];
