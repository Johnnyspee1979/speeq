import type { AiValidationKey, CaptureTimerConfig } from '../../types/CaptureTask';

const NEN_3215_CURRENT_EDITION = 'NEN 3215' as const;

export interface Nen3215Task {
  id: string;
  discipline: 'Installatietechniek';
  nenNorm: typeof NEN_3215_CURRENT_EDITION;
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

export const NEN_3215_TEMPLATES: Nen3215Task[] = [
  {
    id: 'NEN-3215-01-AFSCHOT',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-afschot-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Afschot Verzamelleidingen',
    description:
      'Waterpas op gemonteerde verzamelleiding met leesbare luchtbel, afschot en beugeling in beeld.',
    builderInstruction:
      'WKB STOPMOMENT: Leg een waterpas fysiek op de gemonteerde liggende PVC-rioolbuis en maak een foto waarop de luchtbel goed leesbaar is. Bewijs hiermee dat het afschot van de verzamelleiding correct is aangebracht en laat tegelijk bochten, hulpstukken en beugeling zichtbaar in beeld om foutieve montage vóór het dichtzetten uit te sluiten.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_SPIRIT_LEVEL',
  },
  {
    id: 'NEN-3215-02-WATERSLOT-SIFON',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-waterslot-sifon-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Stankafsluiting (Waterslot 50 mm)',
    description:
      'Detailfoto van sifon of doucheafvoer met verticale rolmaat voor controle op minimaal 50 mm waterslot.',
    builderInstruction:
      'WKB STOPMOMENT: Plaats een rolmaat verticaal langs de aangesloten sifon of afvoer en maak een detailfoto. Bewijs daarmee dat het waterslot minimaal 50 mm diep is, zodat rioollucht en stankklachten na oplevering aantoonbaar worden voorkomen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_WATER_SEAL',
  },
  {
    id: 'NEN-3215-03-ONTLASTVOORZIENING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-ontlastvoorziening-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Ontlastvoorziening (Gevel)',
    description:
      'Detailfoto van de ontlastvoorziening bij samenkomst van hemelwaterafvoer en vuilwater aan de gevel.',
    builderInstruction:
      'Maak een detailfoto van de ontlastvoorziening aan de gevel op het punt waar hemelwaterafvoer en vuilwater samenkomen. Het detail moet helder aantonen dat de verplichte beveiliging tegen opstuwing en inpandige overstroming correct is aangebracht.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_RELIEF_VALVE',
  },
  {
    id: 'NEN-3215-04-DICHTHEID-VERBINDINGEN',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-verbindingen-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Lucht- en Waterdichtheid Verbindingen',
    description:
      'Detail van lijmverbindingen, manchetten en aangesloten mof-spie verbindingen vóór wegwerken.',
    builderInstruction:
      'Maak een scherpe detailfoto van de gelijmde verbindingen of manchet-aansluitingen voordat leidingen in de vloer of grond verdwijnen. Controleer visueel dat de leidingen spanningsvrij en over de volledige insteekdiepte lucht- en waterdicht zijn aangesloten.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_PIPE_SLOPE',
  },
  {
    id: 'NEN-3215-05-ONTSPANNINGSLEIDING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-ontspanning-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Ontspanningsleiding (Beluchting)',
    description:
      'Aantonen dat de primaire standleiding onvernauwd wordt doorgevoerd als ontspanningsleiding bovendaks.',
    builderInstruction:
      'Trek een verticale foto van de standleiding (verzamelbuis) en het traject naar buiten (dakdoorvoer). De buisterdoorsnede naar buiten mag nooit vernauwen t.o.v. de standleiding. Dit voorkomt dat sifons bij grote lozingen via onderdruk worden leeggezogen.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_ROOF_VENT',
  },
  {
    id: 'NEN-3215-06-BEUGELING-EXPANSIE',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-beugeling-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Beugeling & Expansie (Kruipruimte/Schacht)',
    description:
      'Overzichtsfoto van het correct fixeren (vastpunt) en vrij kunnen uitzetten/krimpen (glijbeugel) van rioolbuizen.',
    builderInstruction:
      'Fotografeer het traject in de kruipruimte of leidingschacht waarbij de rioolbeugels duidelijk in beeld zijn. Ter voorkoming van breuk of krimphoofdzakelijk verlies van afschot door hitte-verschillen, moeten er aantoonbaar glijbeugels én vaste punten worden gebruikt conform opgave fabrikant.',
    requiresExif: true,
    stopMoment: 'NA AFWERKING',
    aiValidationKey: 'DETECT_PIPE_BRACKET',
  },
  {
    id: 'NEN-3215-07-GESCHEIDEN-STELSEL',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-gescheiden-001',
    normCodes: [NEN_3215_CURRENT_EDITION, 'Bbl', 'Gemeentelijk Rioolplan'],
    component: 'Gescheiden Stelsel (HWA / VWA)',
    description:
      'Ontkoppeling van Vuilwater (VWA) en Hemelwater (HWA).',
    builderInstruction:
      'Toon visueel (met foto van de infiltratiekrat of huisaansluiting richting straatput) aan dat het dakoppervlakte-water (HWA) strict is gescheiden van het toilet-/grijswater (VWA), zodat extreme buien nooit via stijging het inpandige toilet of de badkamer bereiken.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },
  {
    id: 'NEN-3215-08-DIAMETER-WC',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-diameter-wc-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Aansluitdiameter Grote Lozingstoestellen (WC)',
    description:
      'Controle op nominale leidingdiameter (minimaal Ø90 of Ø110 mm) bij toiletten t.b.v. correcte afvoer fecaal materiaal.',
    builderInstruction:
      'WKB STOPMOMENT: Houd een rolmaat dwars over de valpijp of afvoer direct na de hangtoilet/wc om aan te tonen dat de binnenriolering breed genoeg is (bijv. Ø110).',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_PIPE_DIAMETER',
  },
  {
    id: 'NEN-3215-09-STROMENDE-VERBINDING',
    discipline: 'Installatietechniek',
    nenNorm: NEN_3215_CURRENT_EDITION,
    inspectionPointId: 'riolering-stromend-t-stuk-001',
    normCodes: [NEN_3215_CURRENT_EDITION],
    component: 'Stromende versus Haakse (T/Y) Verbindingen',
    description:
      'Detectie of er foutieve haakse (90°) aansluitingen in liggende T-stukken zijn toegepast in plaats van 45° stroomstukken.',
    builderInstruction:
      'Fotografeer elke belangrijke samenkomst in de liggende riolering (bijv. in de dekvloer of kruipruimte). T-stukken haaks op de stromingsrichting zijn verboden; zorg dat Y-stukken (45 graden) goed belicht vastgelegd worden ter voorkoming van structurele verstoppingen.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_Y_JUNCTION',
  },
];
