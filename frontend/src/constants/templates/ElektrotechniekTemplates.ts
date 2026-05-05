import type { AiValidationKey } from '../../types/CaptureTask';

export interface ElektrotechniekTask {
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

export const ELEKTROTECHNIEK_TEMPLATES: ElektrotechniekTask[] = [
  {
    id: 'EL-3140-BESTAAND',
    inspectionPointId: 'elektra-bestaand-veilig-001',
    normCodes: ['NEN 3140'],
    component: 'Bestaande Installatie Veiliggesteld',
    description: 'Spanningsloze toestand en veilige afscherming bij renovatie.',
    builderInstruction:
      'Leg vast dat de bestaande installatie veilig bereikbaar en spanningsloos is gemaakt voor werkzaamheden en inspectie. Schakel- of afschermmaatregelen moeten zichtbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR INGREEP',
  },
  {
    id: 'EL-01-AARDING-BADKAMER',
    inspectionPointId: 'elektra-aarding-badkamer-001',
    normCodes: ['NEN 1010'],
    component: 'Centraal Aardpunt & Vereffening',
    description: 'Aanwezigheid en aansluiting van het centraal aardpunt (CAP) in natte ruimtes.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer het centraal aardpunt (CAP) in de badkamer vóórdat dit wordt weggewerkt. Toon aan dat aardmat, waterleiding en overige vereffeningsleidingen groen/geel correct zijn aangesloten.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKING',
    aiValidationKey: 'DETECT_EARTH_WIRE',
  },
  {
    id: 'EL-02-PV-KABEL',
    inspectionPointId: 'elektra-pv-traject-001',
    normCodes: ['NEN 1010', 'NPR 5310'],
    component: 'Zonnepanelen (DC) Kabeltracé',
    description: 'Controle van gescheiden kabelvoering van DC-leidingen t.o.v. AC of data.',
    builderInstruction:
      'Fotografeer het kabeltracé van de zonnepanelen (DC-bekabeling) richting de omvormer. Toon aan dat deze kabels fysiek gescheiden zijn van overige AC-stromen of datakabels, in een eigen kabelgoot of buis.',
    requiresExif: true,
    stopMoment: 'VOOR PLAFONDAFWERKING',
  },
  {
    id: 'EL-03-INBOUWDOZEN',
    inspectionPointId: 'elektra-inbouw-dozen-001',
    normCodes: ['NEN 1010'],
    component: 'Inbouwdozen & Wandconduit',
    description: 'Diepte en klemvaste montage van elektra inbouwdozen voor het stucen.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van gemonteerde inbouwdozen in de wand (bijv. slaapkamer). De dozen moeten stevig zijn geklemd/vastgezet en op de juiste diepte zitten (stuc-ring zichtbaar) om brandveilige opbouw te garanderen.',
    requiresExif: true,
    stopMoment: 'VOOR STUCWERK',
    aiValidationKey: 'DETECT_INWALL_CONDUIT',
  },
];
