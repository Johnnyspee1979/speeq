import type { AiValidationKey } from '../../types/CaptureTask';

export interface BouwfysicaTask {
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

export const BOUWFYSICA_TEMPLATES: BouwfysicaTask[] = [
  {
    id: 'BG-8800-01-ISOLATIE',
    inspectionPointId: 'isolatie-aansluiting-001',
    normCodes: ['NTA 8800', 'Bbl'],
    component: 'Isolatie, Kierdichting & Rc-waarde (BENG 1)',
    description: 'Isolatie-etiket, laagopbouw en dikte met rolmaat aan thermische schil.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer isolatiemateriaal, etiketten, laagopbouw en dikte met een strakke rolmaat in beeld. Leg ook kierdichting en aansluitingen van de thermische schil vast, exact vóórdat de dampremmende folie of gipsafwerking het zicht ontneemt.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFWERKEN (GIPS/FOLIE)',
    aiValidationKey: 'DETECT_INSULATION_LABEL',
  },
  {
    id: 'BG-8800-02-LUCHTDICHT',
    inspectionPointId: 'luchtdichtheid-aansluiting-001',
    normCodes: ['NTA 8800', 'Bbl'],
    component: 'Luchtdichtheid & Aansluitdetails (qv;10)',
    description:
      'Luchtdichtheidstape, kitnaden en aansluitingen rondom kozijnen, dak en sparingen.',
    builderInstruction:
      'Maak detailfoto\'s van luchtdichte tapes, slabben, folies en kitnaden rondom (dak)kozijnen en dakdoorvoeren ter onderbouwing van de qv;10 luchtdoorlatendheid. Het afdichtingsdetail moet naadloos en volledig zichtbaar zijn voordat de afwerking wordt gesloten.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKEN',
  },
  {
    id: 'BG-8800-03-U-WAARDE-GLAS',
    inspectionPointId: 'isolatieglas-u-waarde-001',
    normCodes: ['NTA 8800', 'Bbl'],
    component: 'U-waarde HR++ / Triple Beglazing',
    description:
      'Close-up van de fabricage-code en U-waarde in de afstandsband/kader van de beglazing.',
    builderInstruction:
      'Maak een haarscherpe close-up van de stempeltekst of fabricagecode in de (aluminium of warm-edge) afstandsband in de spouw van het raam. De OCR-detectie moet de Ug-waarde of HR++/Triple aanduiding kunnen lezen ter verantwoording van de invoer in de BENG-berekening.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_WINDOW_U_VALUE',
  },
  {
    id: 'BG-8800-04-KOUDEBRUG',
    inspectionPointId: 'koudebrug-onderbreking-001',
    normCodes: ['NTA 8800'],
    component: 'Thermische Snedes & Koudebruggen',
    description:
      'Aantonen van onderbroken thermische bruggen bij kozijnen, lateien of funderingsaansluitingen (SBR-details).',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer kritieke constructieve knooppunten zoals funderingsblokken (FOAMGLAS/PIR) of de isolerende scheiding bij stalen geveldragers en balkonaansluitingen. Zorg dat de koudebrug-onderbreking visueel onmiskenbaar is voordat de vloer/gevel definitief sluit.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_THERMAL_BRIDGE_BREAK',
  },
  {
    id: 'BG-8800-05-ZONNEPANELEN-WP',
    inspectionPointId: 'pv-panelen-wattpiek-001',
    normCodes: ['NTA 8800', 'BENG 3'],
    component: 'Zonnepanelen / PV (Aandeel Hernieuwbaar)',
    description:
      'Registratie van het typeplaatje op het paneel of omvormer ter aantonen van het overeengekomen (Wp) vermogen.',
    builderInstruction:
      'Maak een close-up foto van het typeplaatje achterop de zonnepanelen (of op de verpakking) en/of de stringomvormer. De OCR leest direct het aangeduide vermogen in Wattpiek (Wp) af om de eisen voor hernieuwbare energie (BENG 3) in het borgingsdossier dicht te timmeren.',
    requiresExif: true,
    stopMoment: 'TIJDENS INSTALLATIE',
    aiValidationKey: 'OCR_SOLAR_PANEL_WATTAGE',
  },
  {
    id: 'BG-17037-DAGLICHT',
    inspectionPointId: 'daglicht-opening-001',
    normCodes: ['NEN-EN 17037'],
    component: 'Daglichtopeningen',
    description: 'Raamopeningen, glasvlakken en mogelijke belemmeringen voor daglicht.',
    builderInstruction:
      'Fotografeer kozijnen, glasvlakken en eventuele belemmeringen voor daglichttoetreding. De relevante raam- of gevelopening moet volledig herkenbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },
  {
    id: 'BG-2778-VOCHTWERING',
    inspectionPointId: 'vochtwering-dpc-001',
    normCodes: ['NEN 2778'],
    component: 'Vochtwering & Waterdichtheid (DPC/Lood)',
    description: 'Aanwezigheid van DPC folie, loodslabbes en kimband tegen regendoorslag en optrekkend vocht.',
    builderInstruction:
      'WKB STOPMOMENT: Leg waterkerende folies (DPC), loodslabben rondom kozijnen of kimband in natte ruimtes (badkamer) vast. Het moet duidelijk zichtbaar zijn dat deze overlappen en waterdicht zijn afgewerkt.',
    requiresExif: true,
    stopMoment: 'VOOR AFDEKKEN',
    aiValidationKey: 'DETECT_WATERPROOFING_MEMBRANE',
  },
];
