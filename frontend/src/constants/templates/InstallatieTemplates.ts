import type { AiValidationKey, CaptureTimerConfig } from '../../types/CaptureTask';

export interface InstallatieTask {
  id: string;
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

export const INSTALLATIE_TEMPLATES: InstallatieTask[] = [
  {
    id: 'INST-01-VLOERVERWARMING',
    inspectionPointId: 'inst-vloerverwarming-legafstand-001',
    normCodes: ['ISSO 49'],
    component: 'Vloerverwarming Legpatroon & H.o.H.',
    description: 'Controle van het slakkenhuis- of meanderpatroon en de hart-op-hart buisafstand.',
    builderInstruction:
      'WKB STOPMOMENT: Neem een overzichtsfoto van de aangelegde vloerverwarmingsbuizen vóór het storten van de dekvloer. Leg je rolmaat of duimstok over meerdere buizen om de exacte hart-op-hart (H.o.H) afstand (bijv. 10 cm als hoofdverwarming) en het patroon te bewijzen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DEKVLOER / DICHTZETTEN',
    aiValidationKey: 'DETECT_FLOOR_HEATING',
  },
  {
    id: 'INST-02-EXPANSIEVAT',
    inspectionPointId: 'inst-expansievat-001',
    normCodes: ['ISSO / ROA'],
    component: 'Expansievat & Beveiliging CV',
    description: 'Aansluiting, montage en steunbeugeling van het expansievat t.b.v. drukopvang.',
    builderInstruction:
      'Maak een detailfoto van de aansluiting van het expansievat in het gesloten CV-circuit. De console of muurbeugel, voordruk-specificaties en de leidingaansluiting moeten zichtbaar in beeld zijn.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_EXPANSION_VESSEL',
  },
  {
    id: 'INST-03-VENTILATIE',
    inspectionPointId: 'inst-wtw-kanalen-001',
    normCodes: ['Bouwbesluit / BBL', 'ISSO 61'],
    component: 'Reinheid Mechanische Ventilatie',
    description: 'Visueel bewijs dat luchtkanalen vóór en tijdens montage stofvrij/afgedopt zijn gehouden.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer het luchtkanaal of de WTW aansluiting. Toon hierbij duidelijk aan dat de binnenkant fabrieks-schoon is, of dat de uiteinden stofdicht zijn afgedicht met kappen/tape gedurende de ruwbouwfase.',
    requiresExif: true,
    stopMoment: 'TIJDENS BOUWFASERING',
  },
  {
    id: 'INST-04-AFKLEPPEN',
    inspectionPointId: 'inst-brandvlinderklep-001',
    normCodes: ['NEN 6069'],
    component: 'Brand- en Vlinderkleppen',
    description: 'Aanwezigheid en open positie van brandkleppen in kanaaldoorvoeren.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto IN of OP het luchtkanaal, ter plaatse van een brandcompartimentscheiding. De brandklep of vlinderklep moet zichtbaar en in operationele (open) toestand verkeren.',
    requiresExif: true,
    stopMoment: 'VOOR PLAFONDAFWERKING',
    aiValidationKey: 'DETECT_FIRE_DAMPER',
  },
];
