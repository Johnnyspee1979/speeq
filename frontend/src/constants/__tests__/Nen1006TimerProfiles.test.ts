/**
 * @jest-environment node
 *
 * Struct-invariant- en helper-tests voor de NEN 1006-persproef-timerprofielen.
 * Het camera-/timerpad in de capture-flow rekent met deze profielen: een
 * verkeerde basistijd of een ontbrekend profiel laat de borgingstimer fout
 * lopen. We borgen de data-invarianten (record-key == profiel-id, positieve
 * duur, optionele volume-extensie alleen positief) én het rekencontract van de
 * helpers (duur in minuten/ms/label, volume-extensie, en de type-guards +
 * badge-tekst die de UI toont).
 *
 * Pure data/logica: de module importeert alleen types → @jest-environment node.
 */

import type {
  Nen1006CaptureTimerConfig,
  Nen1078CaptureTimerConfig,
  Nen1006TimerProfileId,
} from '../../types/CaptureTask';
import {
  NEN_1006_TIMER_PROFILES,
  getNen1006TimerProfile,
  getNen1006TimerDurationMinutes,
  getNen1006TimerDurationMs,
  getNen1006TimerDurationLabel,
  profileSupportsVolumeExtension,
  isNen1006TimerConfig,
  isNen1078TimerConfig,
  getCaptureTimerBadgeLabel,
} from '../Nen1006TimerProfiles';

const IDS = Object.keys(NEN_1006_TIMER_PROFILES) as Nen1006TimerProfileId[];

describe('NEN_1006_TIMER_PROFILES (struct)', () => {
  it('bevat profielen', () => {
    expect(IDS.length).toBeGreaterThan(0);
  });

  it('heeft per profiel een id gelijk aan de record-key', () => {
    const bad = IDS.filter((key) => NEN_1006_TIMER_PROFILES[key].id !== key);
    expect(bad).toEqual([]);
  });

  it('heeft niet-lege shortLabel, title en description', () => {
    const bad = IDS.filter((key) => {
      const p = NEN_1006_TIMER_PROFILES[key];
      return (
        p.shortLabel.trim() === '' ||
        p.title.trim() === '' ||
        p.description.trim() === ''
      );
    });
    expect(bad).toEqual([]);
  });

  it('heeft een positieve, eindige baseDurationMinutes', () => {
    const bad = IDS.filter((key) => {
      const m = NEN_1006_TIMER_PROFILES[key].baseDurationMinutes;
      return !Number.isFinite(m) || m <= 0;
    });
    expect(bad).toEqual([]);
  });

  it('heeft een volume-extensie die ofwel afwezig is, ofwel positief', () => {
    const bad = IDS.filter((key) => {
      const ext = NEN_1006_TIMER_PROFILES[key].extensionMinutesPer100Litres;
      return ext !== undefined && (!Number.isFinite(ext) || ext <= 0);
    });
    expect(bad).toEqual([]);
  });
});

describe('getNen1006TimerProfile', () => {
  it('geeft het profiel-object terug voor elke id', () => {
    for (const id of IDS) {
      expect(getNen1006TimerProfile(id)).toBe(NEN_1006_TIMER_PROFILES[id]);
    }
  });
});

describe('getNen1006TimerDurationMinutes', () => {
  it('geeft de basistijd terug zonder volume-extensie', () => {
    expect(getNen1006TimerDurationMinutes('WATER_LEAK_TIGHTNESS_10_MIN')).toBe(10);
    expect(getNen1006TimerDurationMinutes('AIR_GAS_LEAK_TIGHTNESS_120_MIN')).toBe(120);
  });

  it('negeert extra-blokken voor een profiel zonder extensie', () => {
    expect(
      getNen1006TimerDurationMinutes('WATER_PRESSURE_RESISTANCE_10_MIN', 5),
    ).toBe(10);
  });

  it('telt extensie per extra 100-liter-blok op bij een profiel met extensie', () => {
    // 120 + 3 * 20 = 180
    expect(
      getNen1006TimerDurationMinutes('AIR_GAS_LEAK_TIGHTNESS_120_MIN', 3),
    ).toBe(180);
  });

  it('clampt een negatief aantal blokken naar 0', () => {
    expect(
      getNen1006TimerDurationMinutes('AIR_GAS_LEAK_TIGHTNESS_120_MIN', -4),
    ).toBe(120);
  });
});

describe('getNen1006TimerDurationMs', () => {
  it('rekent minuten om naar milliseconden', () => {
    expect(getNen1006TimerDurationMs('WATER_LEAK_TIGHTNESS_10_MIN')).toBe(
      10 * 60 * 1000,
    );
    expect(
      getNen1006TimerDurationMs('AIR_GAS_LEAK_TIGHTNESS_120_MIN', 2),
    ).toBe(160 * 60 * 1000);
  });
});

describe('getNen1006TimerDurationLabel', () => {
  it('formatteert de duur als "<n> min"', () => {
    expect(getNen1006TimerDurationLabel('WATER_LEAK_TIGHTNESS_10_MIN')).toBe('10 min');
    expect(
      getNen1006TimerDurationLabel('AIR_GAS_LEAK_TIGHTNESS_120_MIN', 1),
    ).toBe('140 min');
  });
});

describe('profileSupportsVolumeExtension', () => {
  it('is alleen waar voor het lucht/gas-lekdichtheidsprofiel', () => {
    const supported = IDS.filter((id) => profileSupportsVolumeExtension(id));
    expect(supported).toEqual(['AIR_GAS_LEAK_TIGHTNESS_120_MIN']);
  });
});

const nen1006Config: Nen1006CaptureTimerConfig = {
  variant: 'NEN1006_PERSPROEF',
  startInspectionPointId: 'ip-start',
  defaultProfileId: 'WATER_LEAK_TIGHTNESS_10_MIN',
  supportedProfileIds: ['WATER_LEAK_TIGHTNESS_10_MIN'],
};

const nen1078Config: Nen1078CaptureTimerConfig = {
  variant: 'NEN1078_DICHTHEIDSPROEF',
  startInspectionPointId: 'ip-start',
  defaultDurationMinutes: 15,
  minDurationMinutes: 5,
  maxDurationMinutes: 60,
  stepMinutes: 5,
};

describe('config type-guards', () => {
  it('isNen1006TimerConfig herkent alleen de NEN 1006-variant', () => {
    expect(isNen1006TimerConfig(nen1006Config)).toBe(true);
    expect(isNen1006TimerConfig(nen1078Config)).toBe(false);
    expect(isNen1006TimerConfig(undefined)).toBe(false);
  });

  it('isNen1078TimerConfig herkent alleen de NEN 1078-variant', () => {
    expect(isNen1078TimerConfig(nen1078Config)).toBe(true);
    expect(isNen1078TimerConfig(nen1006Config)).toBe(false);
    expect(isNen1078TimerConfig(undefined)).toBe(false);
  });
});

describe('getCaptureTimerBadgeLabel', () => {
  it('geeft null wanneer de taak geen timer vereist', () => {
    expect(getCaptureTimerBadgeLabel({ requiresTimer: false })).toBeNull();
    expect(
      getCaptureTimerBadgeLabel({ requiresTimer: false, timerConfig: nen1006Config }),
    ).toBeNull();
  });

  it('toont de NEN 1006-badge bij een NEN 1006-config', () => {
    expect(
      getCaptureTimerBadgeLabel({ requiresTimer: true, timerConfig: nen1006Config }),
    ).toBe('TIMER NEN 1006');
  });

  it('toont de NEN 1078-badge bij een NEN 1078-config', () => {
    expect(
      getCaptureTimerBadgeLabel({ requiresTimer: true, timerConfig: nen1078Config }),
    ).toBe('TIMER NEN 1078');
  });

  it('valt terug op de generieke badge wanneer een timer verplicht is zonder config', () => {
    expect(getCaptureTimerBadgeLabel({ requiresTimer: true })).toBe('TIMER VERPLICHT');
  });
});
