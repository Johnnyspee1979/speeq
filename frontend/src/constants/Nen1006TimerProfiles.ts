import type {
  CaptureTask,
  CaptureTimerConfig,
  Nen1006CaptureTimerConfig,
  Nen1006TimerProfileId,
  Nen1078CaptureTimerConfig,
} from '../types/CaptureTask';

export type Nen1006TimerProfile = {
  id: Nen1006TimerProfileId;
  shortLabel: string;
  title: string;
  description: string;
  baseDurationMinutes: number;
  extensionMinutesPer100Litres?: number;
};

export const NEN_1006_TIMER_PROFILES: Record<
  Nen1006TimerProfileId,
  Nen1006TimerProfile
> = {
  WATER_LEAK_TIGHTNESS_10_MIN: {
    id: 'WATER_LEAK_TIGHTNESS_10_MIN',
    shortLabel: 'Water 10 min',
    title: 'Lekdichtheid met drinkwater',
    description:
      'Controleer de testdruk gedurende exact 10 minuten zonder drukverlies.',
    baseDurationMinutes: 10,
  },
  WATER_PRESSURE_RESISTANCE_10_MIN: {
    id: 'WATER_PRESSURE_RESISTANCE_10_MIN',
    shortLabel: 'Water druk 10 min',
    title: 'Drukbestendigheid met drinkwater',
    description:
      'Handhaaf de persdruk exact 10 minuten om de drukbestendigheid aan te tonen.',
    baseDurationMinutes: 10,
  },
  AIR_GAS_LEAK_TIGHTNESS_120_MIN: {
    id: 'AIR_GAS_LEAK_TIGHTNESS_120_MIN',
    shortLabel: 'Lucht/gas 120 min',
    title: 'Lekdichtheid met lucht of inert gas',
    description:
      'Basistijd is 120 minuten tot 100 liter leidinginhoud, plus 20 minuten per extra 100 liter.',
    baseDurationMinutes: 120,
    extensionMinutesPer100Litres: 20,
  },
  AIR_GAS_PRESSURE_RESISTANCE_10_MIN: {
    id: 'AIR_GAS_PRESSURE_RESISTANCE_10_MIN',
    shortLabel: 'Lucht/gas druk 10 min',
    title: 'Drukbestendigheid met lucht of inert gas',
    description:
      'Na de lekdichtheidscontrole volgt een drukbestendigheidsfase van exact 10 minuten.',
    baseDurationMinutes: 10,
  },
};

export const getNen1006TimerProfile = (profileId: Nen1006TimerProfileId) =>
  NEN_1006_TIMER_PROFILES[profileId];

export const getNen1006TimerDurationMinutes = (
  profileId: Nen1006TimerProfileId,
  extraVolumeBlocks = 0
) => {
  const profile = getNen1006TimerProfile(profileId);
  const safeExtraBlocks = Math.max(extraVolumeBlocks, 0);

  if (!profile.extensionMinutesPer100Litres) {
    return profile.baseDurationMinutes;
  }

  return (
    profile.baseDurationMinutes +
    safeExtraBlocks * profile.extensionMinutesPer100Litres
  );
};

export const getNen1006TimerDurationMs = (
  profileId: Nen1006TimerProfileId,
  extraVolumeBlocks = 0
) => getNen1006TimerDurationMinutes(profileId, extraVolumeBlocks) * 60 * 1000;

export const getNen1006TimerDurationLabel = (
  profileId: Nen1006TimerProfileId,
  extraVolumeBlocks = 0
) => `${getNen1006TimerDurationMinutes(profileId, extraVolumeBlocks)} min`;

export const profileSupportsVolumeExtension = (profileId: Nen1006TimerProfileId) =>
  Boolean(getNen1006TimerProfile(profileId).extensionMinutesPer100Litres);

export const isNen1006TimerConfig = (
  timerConfig?: CaptureTimerConfig
): timerConfig is Nen1006CaptureTimerConfig =>
  timerConfig?.variant === 'NEN1006_PERSPROEF';

export const isNen1078TimerConfig = (
  timerConfig?: CaptureTimerConfig
): timerConfig is Nen1078CaptureTimerConfig =>
  timerConfig?.variant === 'NEN1078_DICHTHEIDSPROEF';

export const getCaptureTimerBadgeLabel = (
  task: Pick<CaptureTask, 'requiresTimer' | 'timerConfig'>
) => {
  if (!task.requiresTimer) {
    return null;
  }

  if (isNen1006TimerConfig(task.timerConfig)) {
    return 'TIMER NEN 1006';
  }

  if (isNen1078TimerConfig(task.timerConfig)) {
    return 'TIMER NEN 1078';
  }

  return 'TIMER VERPLICHT';
};
