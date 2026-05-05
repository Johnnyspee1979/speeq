import {
  Droplet,
  Flame,
  Hammer,
  Home,
  Paintbrush,
  type LucideIcon,
  Zap,
} from 'lucide-react-native';
import type { DisciplineId } from '../constants/NenStandards';
import { AFBOUW_TEMPLATES } from '../constants/templates/AfbouwTemplates';
import { BOUWFYSICA_TEMPLATES } from '../constants/templates/BouwfysicaTemplates';
import { BRANDVEILIGHEID_TEMPLATES } from '../constants/templates/BrandveiligheidTemplates';
import { CONSTRUCTIE_TEMPLATES } from '../constants/templates/ConstructieTemplates';
import { ELEKTROTECHNIEK_TEMPLATES } from '../constants/templates/ElektrotechniekTemplates';
import { INSTALLATIE_TEMPLATES } from '../constants/templates/InstallatieTemplates';
import { NEN_13914_TEMPLATES } from '../constants/templates/Nen13914Templates';
import { NEN_1006_TEMPLATES } from '../constants/templates/Nen1006Templates';
import { NEN_1010_TEMPLATES } from '../constants/templates/Nen1010Templates';
import { NEN_1264_TEMPLATES } from '../constants/templates/Nen1264Templates';
import { NEN_1814_TEMPLATES } from '../constants/templates/Nen1814Templates';
import { NEN_1087_TEMPLATES } from '../constants/templates/Nen1087Templates';
import { NEN_1078_TEMPLATES } from '../constants/templates/Nen1078Templates';
import { NEN_2580_TEMPLATES } from '../constants/templates/Nen2580Templates';
import { NEN_3215_TEMPLATES } from '../constants/templates/Nen3215Templates';
import { NEN_3569_TEMPLATES } from '../constants/templates/Nen3569Templates';
import { NEN_5077_TEMPLATES } from '../constants/templates/Nen5077Templates';
import { NEN_6068_6069_TEMPLATES } from '../constants/templates/Nen6068_6069Templates';
import { NEN_9120_TEMPLATES } from '../constants/templates/Nen9120Templates';
import { NEN_199X_TEMPLATES } from '../constants/templates/Nen199xTemplates';
import type { AiValidationKey, CaptureTimerConfig } from '../types/CaptureTask';

export type TaskCategory =
  | 'BOUW'
  | 'STRUCTURAL'
  | 'BOUWFYSICA'
  | 'INSTALLATIE'
  | 'AFBOUW_SCHILDER'
  | 'ELEKTRA'
  | 'BRANDVEILIGHEID';

export type DossierScope = 'BEVOEGD_GEZAG' | 'CONSUMENT' | 'BOTH';

export interface WkbTaskTemplate {
  id: string;
  categoryId: TaskCategory;
  title: string;
  description: string;
  inspectionPointId: string;
  icon: LucideIcon;
  color: string;
  disciplineId: DisciplineId;
  disciplineTitle: string;
  standards: string;
  instruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  timerConfig?: CaptureTimerConfig;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
  dossierScope: DossierScope;
}

export const wkbTaskTemplates: WkbTaskTemplate[] = [
  ...CONSTRUCTIE_TEMPLATES.map((template, index) => ({
    id: `bouw-${index + 1}`,
    categoryId: 'BOUW' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Hammer as LucideIcon,
    color: '#FF6600',
    disciplineId: 'constructie_fundering' as DisciplineId,
    disciplineTitle: 'Constructie & Fundering',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    stopMoment: template.stopMoment,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[...NEN_5077_TEMPLATES, ...NEN_2580_TEMPLATES, ...NEN_1814_TEMPLATES, ...NEN_9120_TEMPLATES, ...BOUWFYSICA_TEMPLATES].map(
    (template, index) => ({
      id: `bouwfysica-${index + 1}`,
      categoryId: 'BOUWFYSICA' as const,
      title: template.component,
      description: template.description,
      inspectionPointId: template.inspectionPointId,
      icon: Home as LucideIcon,
      color: '#0E7490',
      disciplineId: 'bouwfysica_gebruik' as DisciplineId,
      disciplineTitle: 'Bouwfysica & Gebruik',
      standards: template.normCodes.join(' / '),
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      dossierScope: 'BEVOEGD_GEZAG' as const,
    })
  ),
  ...[...NEN_6068_6069_TEMPLATES, ...BRANDVEILIGHEID_TEMPLATES].map((template, index) => ({
    id: `brand-${index + 1}`,
    categoryId: 'BRANDVEILIGHEID' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Flame as LucideIcon,
    color: '#FF453A',
    disciplineId: 'brandveiligheid' as DisciplineId,
    disciplineTitle: 'Brand- & Rookwerendheid',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[
    ...NEN_9120_TEMPLATES,
  ].map((template, index) => ({
    id: `bouw-algemeen-${index + 1}`,
    categoryId: 'BOUW' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Home as LucideIcon,
    color: '#FF3B30',
    disciplineId: 'bouwkundig' as DisciplineId,
    disciplineTitle: 'Bouwkundig Algemeen (Bbl)',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[
    ...NEN_199X_TEMPLATES,
  ].map((template, index) => ({
    id: `constructie-${index + 1}`,
    categoryId: 'STRUCTURAL' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Droplet as LucideIcon,
    color: '#8E8D8A',
    disciplineId: 'constructieve_veiligheid' as DisciplineId,
    disciplineTitle: 'Constructieve Veiligheid',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    requiresTimer: template.requiresTimer,
    timerConfig: template.timerConfig,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[
    ...BOUWFYSICA_TEMPLATES,
    ...NEN_2580_TEMPLATES,
    ...NEN_5077_TEMPLATES,
  ].map((template, index) => ({
    id: `bouwfysica-${index + 1}`,
    categoryId: 'BOUWFYSICA' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Flame as LucideIcon,
    color: '#FF9500',
    disciplineId: 'bouwfysica' as DisciplineId,
    disciplineTitle: 'Bouwfysica & Energie',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[
    ...NEN_1006_TEMPLATES,
    ...NEN_1078_TEMPLATES,
    ...NEN_1264_TEMPLATES,
    ...NEN_3215_TEMPLATES,
    ...NEN_1087_TEMPLATES,
    ...INSTALLATIE_TEMPLATES,
  ].map((template, index) => ({
    id: `inst-${index + 1}`,
    categoryId: 'INSTALLATIE' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Droplet as LucideIcon,
    color: '#007AFF',
    disciplineId: 'installatie_water_gas' as DisciplineId,
    disciplineTitle: 'Water, Gas & Klimaat',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    requiresTimer: template.requiresTimer,
    timerConfig: template.timerConfig,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  ...[...NEN_1010_TEMPLATES, ...ELEKTROTECHNIEK_TEMPLATES].map((template, index) => ({
    id: `elek-${index + 1}`,
    categoryId: 'ELEKTRA' as const,
    title: template.component,
    description: template.description,
    inspectionPointId: template.inspectionPointId,
    icon: Zap as LucideIcon,
    color: '#FFD60A',
    disciplineId: 'elektrotechniek' as DisciplineId,
    disciplineTitle: 'Elektrotechniek',
    standards: template.normCodes.join(' / '),
    instruction: template.builderInstruction,
    requiresExif: template.requiresExif,
    requiresMeasurementTool: template.requiresMeasurementTool,
    stopMoment: template.stopMoment,
    aiValidationKey: template.aiValidationKey,
    dossierScope: 'BEVOEGD_GEZAG' as const,
  })),
  {
    id: 'afb-1',
    categoryId: 'AFBOUW_SCHILDER',
    title: 'Houtrot Herstel',
    description: 'Foto voor en na herstel van kozijn of gevelaansluiting.',
    inspectionPointId: 'houtrot-herstel-001',
    icon: Paintbrush,
    color: '#34C759',
    disciplineId: 'afbouw',
    disciplineTitle: 'Afbouw & Glas',
    standards: 'NEN-EN 13914-2',
    instruction:
      'Leg het herstelde detail vast met aandacht voor vlakheid, afwerking en aansluiting op bestaand werk.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    dossierScope: 'CONSUMENT',
  },
  ...[...NEN_13914_TEMPLATES, ...NEN_3569_TEMPLATES, ...AFBOUW_TEMPLATES].map(
    (template, index) => ({
      id: `afb-${index + 2}`,
      categoryId: 'AFBOUW_SCHILDER' as const,
      title: template.component,
      description: template.description,
      inspectionPointId: template.inspectionPointId,
      icon: Paintbrush as LucideIcon,
      color: '#34C759',
      disciplineId: 'afbouw' as DisciplineId,
      disciplineTitle: 'Afbouw & Glas',
      standards: template.normCodes.join(' / '),
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      dossierScope:
        template.normCodes.includes('NEN 3569') ? ('BOTH' as const) : ('CONSUMENT' as const),
    })
  ),
];

export const findWkbTaskTemplateByInspectionPointId = (inspectionPointId: string) =>
  wkbTaskTemplates.find((item) => item.inspectionPointId === inspectionPointId);
