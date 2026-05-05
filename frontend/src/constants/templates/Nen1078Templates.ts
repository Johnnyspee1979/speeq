import type {
  AiValidationKey,
  CaptureTimerConfig,
} from '../../types/CaptureTask';

const NEN_1078_CURRENT_EDITION = 'NEN 1078:2024' as const;

export interface Nen1078Task {
  id: string;
  discipline: 'Installatietechniek';
  nenNorm: typeof NEN_1078_CURRENT_EDITION;
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

export const NEN_1078_TEMPLATES: Nen1078Task[] = [
  // 1. BEUGELING
  {
    id: 'NEN-1078-01-BEUGELING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-leiding-beugeling',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Leidingbeugeling Gas',
    description: 'Controle op de juiste hart-op-hart afstand van de leidingbeugels, afhankelijk van de leidingdiameter.',
    builderInstruction: 'WKB STOPMOMENT: Houd een rolmaat naast de met koper of staal gemonteerde gasleiding zodanig dat de afstand tussen twee bevestigingsbeugels duidelijk afleesbaar is. Dit ter voorkoming van doorhangen of trillingsschade.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'TIJDENS MONTAGE / VOOR AFWERKING',
    aiValidationKey: 'DETECT_GAS_PIPE_SUPPORT',
  },
  // 2. MATERIAALSCHEIDING
  {
    id: 'NEN-1078-02-MATERIAAL-SCHEIDING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-materiaal-corrosie',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Materiaalscheiding / Corrosiebescherming',
    description: 'Voorkomen van contact tussen koperen/stalen leidingen en betonspecie of cement.',
    builderInstruction: 'WKB STOPMOMENT: Maak een detailfoto waar de gasleiding een beton- of cementvloer/wand raakt. Zorg dat de beschermende coating, mantelbuis of denso-band duidelijk zichtbaar is om kalk/corrosie-inwerking te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR STORTEN / AFDEKKEN',
    aiValidationKey: 'DETECT_PIPE_SEPARATION', // Hergebruik van NEN 1006 key is hier prima
  },
  // 3. MANTELBUIS DOORVOER
  {
    id: 'NEN-1078-03-MANTELBUIS',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-mantelbuis-doorvoer',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Mantelbuis bij Doorvoering',
    description: 'Detailfoto van gasleiding in aaneengesloten mantelbuis bij vloer- of wanddoorvoer.',
    builderInstruction: 'WKB STOPMOMENT: Maak een detailfoto van de gasleiding bij de doorvoer door vloer of wand. Bewijs visueel dat de gele gasleiding in een aaneengesloten, onbeschadigde mantelbuis ligt om gasophoping in gesloten ruimten of kruipruimte te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_GAS_PIPE_CASING',
  },
  // 4. VERBORGEN VERBINDINGEN
  {
    id: 'NEN-1078-04-VERBINDINGEN',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-verborgen-verbinding',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Verborgen Verbindingen',
    description: 'Uitsluiten van knelkoppelingen in onbereikbare (bouw)delen.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer het leidingtracé net vóórdat de koker, schacht of vloer permanent wordt dichtgezet. Met de foto wordt bewezen dat het weggewerkte deel is gesoldeerd/geperst en géén knelkoppelingen bevat.',
    requiresExif: true,
    stopMoment: 'PRECIEZE STOPMOMENT VOOR AFWERKING MUREN/VLOEREN',
    aiValidationKey: 'DETECT_NO_COMPRESSION_FITTING',
  },
  // 5. TOESTELKRAAN EN AANSLUITING
  {
    id: 'NEN-1078-05-TOESTELKRAAN',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-toestelkraan',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Gaskraan Aansluiting',
    description: 'Controle op een direct bereikbare en veilig bedienbare gastoestelkraan.',
    builderInstruction: 'Fotografeer de aansluiting van het gastoestel (bijv. CV-ketel of kookplaat). De gele gaskraan moet zich op een direct en makkelijk bereikbare, veilige plek bevinden. Let op de Gastec QA slang (mag niet door of achter vaste kastpanelen).',
    requiresExif: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'DETECT_GAS_VALVE',
  },
  // 6. PERSPROEF START
  {
    id: 'NEN-1078-06-PERSPROEF-START',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-persproef-start',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Dichtheidsbeproeving (Aanvang)',
    description: 'Detailfoto van manometer of digitale drukmeter bij aanvang van de gasdichtheidsbeproeving.',
    builderInstruction: 'WKB STOPMOMENT: Zet de gasinstallatie op de vereiste beproevingsdruk conform NEN 1078 Tabel A.1. Maak een heldere detailfoto van de manometer met een leesbare beginstand.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR INGEBRUIKNAME',
    aiValidationKey: 'DETECT_MANOMETER',
  },
  // 7. PERSPROEF EIND
  {
    id: 'NEN-1078-07-PERSPROEF-EIND',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-persproef-eind',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Dichtheidsbeproeving (Eindcontrole)',
    description: 'Detailfoto van manometer na de ingestelde normtijd om drukbehoud te bevestigen.',
    builderInstruction: 'Stel de lektijd / test-tijd in op de app. Maak na het aflopen van de timer direct opnieuw een overzichtsfoto van de manometer. Er mag geen drukverval meetbaar zijn.',
    requiresExif: true,
    requiresMeasurementTool: true,
    requiresTimer: true,
    timerConfig: {
      variant: 'NEN1078_DICHTHEIDSPROEF',
      startInspectionPointId: 'gas-persproef-start',
      defaultDurationMinutes: 10,
      minDurationMinutes: 1,
      maxDurationMinutes: 240,
      stepMinutes: 1,
    },
    stopMoment: 'VOOR INGEBRUIKNAME',
    aiValidationKey: 'DETECT_MANOMETER',
  },
  // 8. GASMETER OPSTELLING
  {
    id: 'NEN-1078-08-GASMETER',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-meteropstelling',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Gasmeter Opstelling',
    description: 'Controle op een veilige en spanningsvrij gemonteerde hoofdgasmeter.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer de volledige gasmeteropstelling (meestal in de meterkast). De gasmeter moet in een deugdelijke, corrosievrije beugel hangen en de leidingen mogen geen overmatige spanning op de meter veroorzaken.',
    requiresExif: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'DETECT_GAS_METER',
  },
  // 9. VENTILATIE (OPEN TOESTELLEN)
  {
    id: 'NEN-1078-09-VENTILATIE',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-ventilatie-open-toestel',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Luchttoevoer (Open Toestellen)',
    description: 'Controle op voldoende niet-afsluitbare luchttoevoer bij open verbrandingstoestellen (B-toestellen).',
    builderInstruction: 'Heeft de woning nog een open gastoestel (zoals een open geiser of gashaard)? Maak dan een foto van het toestel én de verplichte, niet-afsluitbare toevoeropening in dezelfde ruimte. Mechanische afzuiging in deze ruimte is verboden.',
    requiresExif: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'DETECT_VENTILATION_OPENING',
  },
  // 10. GASTEC QA KEURMERK
  {
    id: 'NEN-1078-10-SLANG-KEURMERK',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-slang-keurmerk',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Flexibele Aansluitleiding',
    description: 'Detailcontrole op typegoedkeuring van de flexibele gasslang en aansluiting.',
    builderInstruction: 'WKB STOPMOMENT: Maak een detailfoto van de bedrukking op de flexibele gasslang (bijv. achter een fornuis of bij de meter). Het Gastec QA logo of keurnummer moet duidelijk leesbaar zijn in beeld. De slang mag maximaal voldoen aan toegestane NEN afmetingen.',
    requiresExif: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'OCR_GASTEC_QA',
  },
  // 11. POTENTIAALVEREFFENING (AARDING)
  {
    id: 'NEN-1078-11-POTENTIAALVEREFFENING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-aarding',
    normCodes: [NEN_1078_CURRENT_EDITION, 'NEN 1010'],
    component: 'Hoofdaardverbinding Gas',
    description: 'Bevestigen dat de binnenkomende metalen gasleiding is verbonden met de hoofdaardrail.',
    builderInstruction: 'WKB STOPMOMENT: Maak een detailfoto van de gasleiding direct ná binnenkomst (of vlakbij de gasmeter). Hier moet zichtbaar een deugdelijke aardklem met vereffeningsdraad op gemonteerd zijn, aangesloten op de hoofdaardrail (CAP).',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_BONDING_CLAMP',
  },
  // 12. KRUIPRUIMTE VERBINDINGEN
  {
    id: 'NEN-1078-12-KRUIPRUIMTE',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-kruipruimte-verbinding',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Kruipruimte Leidingwerk',
    description: 'Controle op een ononderbroken leidingtracé zonder verbindingen of fittingen onder de vloer.',
    builderInstruction: 'WKB STOPMOMENT: Loopt de gasleiding door een onbereikbare (kruip)ruimte? Maak een overzichtsfoto van dit tracé. Het leidingwerk moet uit één stuk bestaan of voorzien zijn van goedgekeurde aaneengesloten mantelbuis ter voorkoming van gasophoping in de kruipruimte.',
    requiresExif: true,
    stopMoment: 'VOOR STORTEN / AFDEKKEN',
    aiValidationKey: 'DETECT_CRAWLSPACE_PIPE',
  },
  // 13. MECHANISCHE BESCHERMING
  {
    id: 'NEN-1078-13-MECHANISCHE-BESCHERMING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-mechanische-bescherming',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Mechanische Bescherming',
    description: 'Aanbrengen stalen beschermprofiel op kwetsbare, blootliggende leidingdelen (bijv. in een garage oprit).',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer het stalen beschermprofiel of aanrijdbeveiliging indien de bovengrondse gasleiding zich bevindt op een locatie met verhoogd risico op mechanische beschadiging (zoals een garage, carport of expeditieruimte).',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_MECHANICAL_PROTECTION',
  },
  // 14. ONTLUCHTING MANTELBUIS
  {
    id: 'NEN-1078-14-ONTLUCHTING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_1078_CURRENT_EDITION,
    inspectionPointId: 'gas-mantelbuis-ontluchting',
    normCodes: [NEN_1078_CURRENT_EDITION],
    component: 'Mantelbuis Ontluchting',
    description: 'Controle op de open ventilatie-zijde van een mantelbuis die uitmondt in de gasmeterruimte.',
    builderInstruction: 'WKB STOPMOMENT: Eindigt een mantelbuis vanuit de kruipruimte of leidingschacht in de meterkast? Bevestig met een foto dat het uiteinde van deze mantelbuis open is gelaten, zodat eventueel weglekkend gas in de mantelbuis tijdig kan worden geroken en afgevoerd.',
    requiresExif: true,
    stopMoment: 'EINDMONTAGE',
    aiValidationKey: 'DETECT_CASING_VENTILATION',
  },
];
