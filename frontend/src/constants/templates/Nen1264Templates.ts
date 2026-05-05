import type { AiValidationKey, CaptureTimerConfig } from '../../types/CaptureTask';

export interface Nen1264Task {
  id: string;
  discipline: 'Installatietechniek';
  nenNorm: string;
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

export const NEN_1264_TEMPLATES: Nen1264Task[] = [
  {
    id: 'NEN-1264-01-AANLEG',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN-EN 1264-4',
    inspectionPointId: 'vloerverwarming-lussen-001',
    normCodes: ['NEN-EN 1264-4', 'Bbl', 'ISSO-Publicatie 49'],
    component: 'Vloerverwarming Lussen & Afstand',
    description: 'Borging van de hart-op-hart (h.o.h.) afstand en bevestiging van vloerverwarmingsbuizen incl. randisolatie.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer het gelegde leidingnet overdwars in de ruimte vóórdat de dekvloer gestort wordt. Leg een rolmaat dwars over tenminste 3 leidingen om de h.o.h. patroonafstand aan te tonen. Randisolatie (foamband) langs de wanden moet zichtbaar intact zijn.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR STORTEN DEKVLOER',
    aiValidationKey: 'DETECT_UNDERFLOOR_HEATING',
  },
  {
    id: 'NEN-1264-02-AFPERSEN',
    discipline: 'Installatietechniek',
    nenNorm: 'NEN-EN 1264-4',
    inspectionPointId: 'vloerverwarming-drukproef-001',
    normCodes: ['NEN-EN 1264-4', 'ISSO-Publicatie 49'],
    component: 'Afpersen en Manometer (Drukproef)',
    description: 'Vloerverwarming dient voor én tijdens het storten van de dekvloer continu onder (water)druk te staan ter visuele lekdetectie.',
    builderInstruction:
      'WKB STOPMOMENT: Neem een detailfoto van de verdeler waarop de aangesloten manometer duidelijk zichtbaar is. Wijzer moet staan op de geëiste persdruk (meestal rond de 3 bar) tijdens de start van het storten.',
    requiresExif: true,
    stopMoment: 'VOOR STORTEN DEKVLOER',
    aiValidationKey: 'DETECT_PRESSURE_GAUGE',
  },
];
