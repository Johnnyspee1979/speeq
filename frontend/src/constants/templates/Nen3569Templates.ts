import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_3569_CURRENT_EDITION = 'NEN 3569' as const;

export interface Nen3569Task {
  id: string;
  discipline: 'Afbouw & Glas';
  nenNorm: typeof NEN_3569_CURRENT_EDITION;
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

export const NEN_3569_TEMPLATES: Nen3569Task[] = [
  {
    id: 'NEN-3569-01-GLASSTEMPEL',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'beglazing-kitwerk-001',
    normCodes: [NEN_3569_CURRENT_EDITION, 'NEN-EN 13914-2'],
    component: 'Letselveilig Glas & Kitwerk',
    description:
      'Veiligheidsstempel, glaslat en kitdetail van glas in risicogebied met scherp leesbare markering.',
    builderInstruction:
      'WKB STOPMOMENT: Maak detailfoto\'s van kitwerk, glaslat en de veiligheidsstempel in de ruit als het glas in een risicogebied zit. De stempel moet scherp leesbaar zijn, zodat het toegepaste letselveilige glas ondubbelzinnig in het dossier is vastgelegd.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_STAMP',
  },
  {
    id: 'NEN-3569-02-RISICOZONE',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'veiligheidsglas-risicozone-001',
    normCodes: [NEN_3569_CURRENT_EDITION, 'Bbl'],
    component: 'Risicogebied Glas onder 850 mm',
    description:
      'Verticale maatvoering vanaf de afgewerkte vloer langs het glasvlak in een risicogevoelige loop- of stootzone.',
    builderInstruction:
      'Plaats een rolmaat verticaal langs het glas vanaf de afgewerkte vloer en fotografeer de glaszone die zich in het risicogebied bevindt. Zorg dat de deur, looproute of het zijlicht herkenbaar in beeld is, zodat de noodzaak van letselveilig glas objectief aan de situering is gekoppeld.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE_HEIGHT',
  },
  {
    id: 'NEN-3569-03-DEUREN-ZIJLICHTEN',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'veiligheidsglas-deuren-001',
    normCodes: [NEN_3569_CURRENT_EDITION, 'Bbl'],
    component: 'Deuren en Directe Zijlichten',
    description:
      'Gelaagd of gehard veiligheidsglas verplicht in deuren en direct aangrenzende ruiten (<300mm).',
    builderInstruction:
      'Maak een foto van de glazen deuren (verkeersroutes) en de constructief direct aangrenzende zijlichten. Ondanks de afstand tot de vloer stelt de NEN 3569 hier verplicht letselveilig (Gelaagd of Gehard) glas met aantoonbare stempel/fabricagecode om zwaar doorloopsnijdletsel te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_STAMP',
  },
  {
    id: 'NEN-3569-04-DOORVAL-BALUSTRADES',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'veiligheidsglas-doorval-001',
    normCodes: [NEN_3569_CURRENT_EDITION, 'Bbl', 'NEN-EN 12600'],
    component: 'Glazen Balustrades & Vloerafscheiding (> 1m)',
    description:
      'Gelaagd doorvalbeveiligend glas t.b.v. vloerafscheidingen, Franse balkons of vides (hoogteverschil groter dan 1 meter).',
    builderInstruction:
      'Fotografeer de glazen doorvalbeveiliging, inclusief de verankering in de glasklemmen of profielen, vanaf een afstand met overzicht én een inzet van de veiligheidsstempel. Gelaagd glas stopt personen van het doorvallen naar een lager niveau.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_BARRIER',
  },
  {
    id: 'NEN-3569-05-DAKBEGLAZING-LUIFELS',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'veiligheidsglas-dak-001',
    normCodes: [NEN_3569_CURRENT_EDITION, 'Bbl'],
    component: 'Dakbeglazing en Glazen Luifels',
    description:
      'De binnenruit (onderzijde) van daklichten of puien hellend boven personen moet altijd letselbeperkend zijn.',
    builderInstruction:
      'Fotografeer de onderzijde van het daklicht, de lichtstraat of de structurele glazen luifel waaronder mensen verblijven of passeren. De binnenruit moet van gelaagd letselveilig glas voorzien zijn ter voorkoming van instortende glasscherven bij impact (bijvoorbeeld hagel of vallende objecten op de buitenruit).',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_STAMP',
  },
  {
    id: 'NEN-3569-06-NATTE-CEL',
    discipline: 'Afbouw & Glas',
    nenNorm: NEN_3569_CURRENT_EDITION,
    inspectionPointId: 'veiligheidsglas-badkamer-001',
    normCodes: [NEN_3569_CURRENT_EDITION],
    component: 'Bad-, Douchewanden & Uitglijdsectoren',
    description:
      'Vlakglas dat is geplaatst naast sanitaire elementen of doucheruimtes (uitglijdgevaar).',
    builderInstruction:
      'Toon van een afstandje aan dat glazen scheidingswanden, inloopdouches of bad-omhullingen zijn voorzien van minimaal gehard letselveilig glas. Op de foto moet de contour van wand én nabijgelegen douchekop/kraan zichtbaar zijn ter verantwoording van NEN 3569.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_STAMP',
  },
];
