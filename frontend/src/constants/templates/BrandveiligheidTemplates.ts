import type { AiValidationKey } from '../../types/CaptureTask';

export interface BrandveiligheidTask {
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

export const BRANDVEILIGHEID_TEMPLATES: BrandveiligheidTask[] = [
  {
    id: 'BRA-6075-ROOK-S200',
    inspectionPointId: 'rookwerende-deur-001',
    normCodes: ['NEN 6075'],
    component: 'Rookwerendheid Deur S200',
    description:
      'Valdorpel, rookwerende strips en kierdichting voor koude en warme rook.',
    builderInstruction:
      'Maak een foto van de onderzijde van de deur en de rookwerende afdichting rondom. De automatische rubberen valdorpel moet zichtbaar zijn om de Sa- of S200-eis aantoonbaar te maken.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DROP_SEAL',
  },
  {
    id: 'BRA-6050-DAK',
    inspectionPointId: 'dak-no-flame-zone-001',
    normCodes: ['NEN 6050'],
    component: 'Brandveilig Dakdetail',
    description:
      'No-flame zone van 75 cm rondom opstanden en doorvoeren.',
    builderInstruction:
      'Fotografeer de dakopstand, lichtkoepel of doorvoer. Binnen de 75 cm veiligheidszone moet zelfklevende of gefohnde dakbedekking zichtbaar zijn, zonder roet- of schroeisporen van een brander.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKEN',
    aiValidationKey: 'DETECT_NO_FLAME_ZONE',
  },
  {
    id: 'BRA-13501-GLAS',
    inspectionPointId: 'brandwerend-glas-stempel-001',
    normCodes: ['NEN-EN 13501-2', 'NEN 3569'],
    component: 'Brandwerende Beglazing',
    description:
      'Macro-opname van de fabrieksstempel of ets in de hoek van de ruit.',
    builderInstruction:
      'Maak een macro-foto van de permanente fabrieksstempel of ets in de hoek van het brandwerende glas. Een overzichtsfoto zonder leesbaar kenmerk is onvoldoende als juridisch bewijs.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_GLASS_STAMP',
  },
  {
    id: 'BRA-13501-KABEL',
    inspectionPointId: 'brand-kabelclassificatie-001',
    normCodes: ['NEN-EN 13501-6'],
    component: 'Kabelclassificatie & Kabelgoot',
    description:
      'Leesbare kabelcodering en bevestiging van kabelgoot in brandsituatie.',
    builderInstruction:
      'Leg kabels, kabelgoten en bevestigingen vast met leesbare codering. De brand- en rookklasse van de toegepaste kabel moet uit het label of productmerk herleidbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKEN',
  },
];
