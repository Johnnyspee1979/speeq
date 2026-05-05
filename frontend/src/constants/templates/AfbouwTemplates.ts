import type { AiValidationKey } from '../../types/CaptureTask';

export interface AfbouwTask {
  id: string;
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

export const AFBOUW_TEMPLATES: AfbouwTask[] = [
  {
    id: 'AFBOUW-01-STUCWERK',
    inspectionPointId: 'afbouw-stuc-vlakheid-001',
    normCodes: ['NEN 2877'],
    component: 'Vlakheid Stucwerk',
    description: 'Controle op de vlakheidsklasse en rechtheid van wandafwerkingen.',
    builderInstruction:
      'Plaats een aluminium meetrei (straightedge) horizontaal en verticaal tegen de gestucte wand. Fotografeer langs de rei om aan te tonen dat de maximale afwijking ruim binnen de afgesproken NEN 2877 / TBA toleranties valt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR SCHILDEREN / SAUZEN',
    aiValidationKey: 'DETECT_STRAIGHTEDGE',
  },
  {
    id: 'AFBOUW-02-TEGELWERK',
    inspectionPointId: 'afbouw-tegel-afschot-001',
    normCodes: ['URL / BRL'],
    component: 'Afschot Tegelwerk Natte Cel',
    description: 'Controle van het correcte afschot van de tegelvloer richting de drain/put.',
    builderInstruction:
      'Leg een waterpas op de afgewerkte tegelvloer in de doucheruimte in de stroomrichting van het putje. De bel in de waterpas moet duidelijk aantonen dat er voldoende constructief afschot (bijv. 1-1,5 cm/m) is gehanteerd om plasvorming te voorkomen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_SPIRIT_LEVEL',
  },
  {
    id: 'AFBOUW-03-KITWERK',
    inspectionPointId: 'afbouw-kitwerk-kozijn-001',
    normCodes: ['NEN-EN 15651'],
    component: 'Water- / Luchtdichte Kitvoegen',
    description: 'Visueel bewijs van doorlopend, vlak en ononderbroken kitwerk langs kozijnkaders.',
    builderInstruction:
      'Fotografeer de aansluitnaad tussen het binnen-/buitenkozijn en het metselwerk/stucwerk. Het moet visueel duidelijk zijn dat de kitrups ononderbroken en strak is aangebracht ten behoeve van de thermische en akoestische schil (qV;10 / kierdichting).',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_SEALANT',
  },
];
