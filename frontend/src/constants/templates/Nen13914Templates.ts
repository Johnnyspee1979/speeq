import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_13914_CURRENT_EDITION = 'NEN-EN 13914' as const;

export interface Nen13914Task {
  id: string;
  discipline: 'Afbouw';
  nenNorm: typeof NEN_13914_CURRENT_EDITION;
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

export const NEN_13914_TEMPLATES: Nen13914Task[] = [
  {
    id: 'NEN-13914-01-BINNENSTUC-VLAKHEID',
    discipline: 'Afbouw',
    nenNorm: NEN_13914_CURRENT_EDITION,
    inspectionPointId: 'stuc-vlakheid-001',
    normCodes: ['NEN-EN 13914-2'],
    component: 'Binnenstuc Vlakheid met Meetrei',
    description:
      'Aluminium meetrei tegen binnenwand bij diffuus licht, zonder strijklicht of vertekende schaduwwerking.',
    builderInstruction:
      'WKB STOPMOMENT: Plaats een aluminium meetrei van minimaal een meter tegen de binnenwand en fotografeer zonder strijklicht, spotbundels of tegenlicht. Leg het volledige contactvlak vast zodat holling, bolling en opleverkwaliteit objectief beoordeelbaar zijn.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_STRAIGHTEDGE',
  },
  {
    id: 'NEN-13914-02-BUITENSTUC-VLAKHEID',
    discipline: 'Afbouw',
    nenNorm: NEN_13914_CURRENT_EDITION,
    inspectionPointId: 'stuc-buiten-vlakheid-001',
    normCodes: ['NEN-EN 13914-1'],
    component: 'Buitenbepleistering Vlakheid',
    description:
      'Meetrei tegen gevelvlak met kozijnaansluitingen, hoeken of dilataties leesbaar in hetzelfde beeld.',
    builderInstruction:
      'Plaats een meetrei tegen de buitenbepleistering en leg de vlakheid bij diffuus daglicht vast. Neem ook kozijnaansluitingen, hoeken of dilataties mee in beeld zodat scheur- en aansluitrisico\'s direct aan de vlakheidscontrole zijn gekoppeld.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_STRAIGHTEDGE',
  },
  {
    id: 'NEN-13914-03-STRIJKLICHT',
    discipline: 'Afbouw',
    nenNorm: NEN_13914_CURRENT_EDITION,
    inspectionPointId: 'stuc-strijklicht-001',
    normCodes: ['NEN-EN 13914-2'],
    component: 'Strijklichtgevoelige Wandbeoordeling',
    description:
      'Overzichtsfoto van kritische wandvlakken bij diffuus licht, expliciet zonder kunstmatig strijklicht of overtrokken schaduwwerking.',
    builderInstruction:
      'Maak een overzichtsfoto van wandvlakken die gevoelig zijn voor discussies onder strijklicht. Fotografeer bij diffuus daglicht of egaal kunstlicht zonder harde lichtbundel langs het wandvlak, zodat de beoordeling aansluit op de norm en niet op overdreven schaduwwerking.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DIFFUSE_LIGHT',
  },
];
