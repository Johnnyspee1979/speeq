/**
 * @jest-environment node
 *
 * Struct-invariant- en helper-tests voor NenStandards — de NEN-disciplines
 * (vakgebieden), de NEN-norm-database en de afgeleide capture-tasks waarmee de
 * bouwvakker per discipline concrete borgingsopgaven kiest. Het capture-/dossier-
 * pad leunt op stabiele discipline-id's, geldige enums en kloppende refs.
 *
 * We borgen:
 *  - NEN_DISCIPLINES: unieke geldige DisciplineId, geldige iconName-enum, hex-
 *    accentkleur, niet-lege tekstvelden + summaryNorms, en per task niet-lege
 *    id/title/instruction, boolean requiresExif en niet-lege normCodes;
 *  - NEN_NORM_DATABASE: unieke code, geldige NenCategory, niet-lege tekstvelden +
 *    keywords, alle disciplineIds geldig, en primaryDisciplineId zit altijd in
 *    de disciplineIds-lijst (referentiële consistentie);
 *  - de helpers: findNenDisciplineById (round-trip), getNenDisciplinesForNorm
 *    (resolved alle refs), toNenCaptureTask (id-vorm + inspectionPointId-fallback
 *    naar task.id + standards-join), nenCaptureTasks (telt alle tasks), en de
 *    twee inspectionPointId-lookups incl. undefined/null bij onbekende key.
 *
 * Pure data (alleen `import type` + template-arrays) → @jest-environment node.
 */

import {
  NEN_DISCIPLINES,
  NEN_NORM_DATABASE,
  findNenDisciplineById,
  getNenDisciplinesForNorm,
  toNenCaptureTask,
  nenCaptureTasks,
  findNenTaskContextByInspectionPointId,
  findNenCaptureTaskByInspectionPointId,
  type DisciplineId,
} from '../NenStandards';

const DISCIPLINE_IDS = new Set<DisciplineId>([
  'constructie_fundering',
  'elektrotechniek',
  'installatie_water_gas',
  'bouwfysica_gebruik',
  'brandveiligheid',
  'dak_gevel',
  'afbouw',
]);
const ICON_NAMES = new Set(['Hammer', 'Zap', 'Droplet', 'Flame', 'Home', 'Layout']);
const CATEGORIES = new Set(['Constructie', 'Brandveiligheid', 'Installatie', 'Bouwfysica', 'Afbouw']);
const HEX6 = /^#[0-9A-Fa-f]{6}$/;

const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';
const isNonEmptyStringList = (v: unknown): boolean =>
  Array.isArray(v) && v.length > 0 && v.every((s) => isNonEmptyString(s));

describe('NEN_DISCIPLINES (struct)', () => {
  it('bevat disciplines', () => {
    expect(NEN_DISCIPLINES.length).toBeGreaterThan(0);
  });

  it('heeft unieke, geldige DisciplineId-s', () => {
    const ids = NEN_DISCIPLINES.map((d) => d.id);
    const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const invalid = ids.filter((id) => !DISCIPLINE_IDS.has(id));
    expect(dups).toEqual([]);
    expect(invalid).toEqual([]);
  });

  it('heeft een geldige iconName en hex-accentkleur', () => {
    const badIcon = NEN_DISCIPLINES.filter((d) => !ICON_NAMES.has(d.iconName)).map((d) => d.id);
    const badAccent = NEN_DISCIPLINES.filter((d) => !HEX6.test(d.accentColor)).map((d) => d.id);
    expect(badIcon).toEqual([]);
    expect(badAccent).toEqual([]);
  });

  it('heeft niet-lege tekstvelden en summaryNorms', () => {
    const bad = NEN_DISCIPLINES.filter(
      (d) =>
        !isNonEmptyString(d.title) ||
        !isNonEmptyString(d.standards) ||
        !isNonEmptyString(d.description) ||
        !isNonEmptyStringList(d.summaryNorms),
    ).map((d) => d.id);
    expect(bad).toEqual([]);
  });

  it('heeft per task niet-lege id/title/instruction, boolean requiresExif en normCodes', () => {
    const bad = NEN_DISCIPLINES.flatMap((d) =>
      d.tasks
        .filter(
          (t) =>
            !isNonEmptyString(t.id) ||
            !isNonEmptyString(t.title) ||
            !isNonEmptyString(t.instruction) ||
            typeof t.requiresExif !== 'boolean' ||
            !isNonEmptyStringList(t.normCodes),
        )
        .map((t) => `${d.id}:${t.id}`),
    );
    expect(bad).toEqual([]);
  });
});

describe('NEN_NORM_DATABASE (struct)', () => {
  it('bevat normen', () => {
    expect(NEN_NORM_DATABASE.length).toBeGreaterThan(0);
  });

  it('heeft unieke norm-codes', () => {
    const codes = NEN_NORM_DATABASE.map((n) => n.code);
    const dups = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))];
    expect(dups).toEqual([]);
  });

  it('heeft geldige category, niet-lege tekstvelden en keywords', () => {
    const bad = NEN_NORM_DATABASE.filter(
      (n) =>
        !CATEGORIES.has(n.category) ||
        !isNonEmptyString(n.code) ||
        !isNonEmptyString(n.title) ||
        !isNonEmptyString(n.description) ||
        !isNonEmptyString(n.wkbCheck) ||
        !isNonEmptyStringList(n.keywords),
    ).map((n) => n.code);
    expect(bad).toEqual([]);
  });

  it('verwijst alleen naar bestaande disciplineIds', () => {
    const bad = NEN_NORM_DATABASE.filter(
      (n) =>
        !Array.isArray(n.disciplineIds) ||
        n.disciplineIds.length === 0 ||
        n.disciplineIds.some((id) => !DISCIPLINE_IDS.has(id)),
    ).map((n) => n.code);
    expect(bad).toEqual([]);
  });

  it('heeft een primaryDisciplineId die in de disciplineIds-lijst zit', () => {
    const bad = NEN_NORM_DATABASE.filter(
      (n) => !n.disciplineIds.includes(n.primaryDisciplineId),
    ).map((n) => n.code);
    expect(bad).toEqual([]);
  });
});

describe('findNenDisciplineById', () => {
  it('vindt elke discipline op id (round-trip)', () => {
    const miss = NEN_DISCIPLINES.filter((d) => findNenDisciplineById(d.id)?.id !== d.id).map((d) => d.id);
    expect(miss).toEqual([]);
  });
});

describe('getNenDisciplinesForNorm', () => {
  it('resolved alle disciplineIds van elke norm naar discipline-objecten', () => {
    const bad = NEN_NORM_DATABASE.filter(
      (n) => getNenDisciplinesForNorm(n).length !== new Set(n.disciplineIds).size,
    ).map((n) => n.code);
    expect(bad).toEqual([]);
  });
});

describe('toNenCaptureTask', () => {
  const discipline = NEN_DISCIPLINES[0];

  it('bouwt een id van de vorm nen-<discipline>-<taskId> en markeert NEN-bron', () => {
    const task = discipline.tasks[0];
    const ct = toNenCaptureTask(discipline, task);
    expect(ct.id).toBe(`nen-${discipline.id}-${task.id}`);
    expect(ct.selectionSource).toBe('NEN');
    expect(ct.disciplineTitle).toBe(discipline.title);
  });

  it('gebruikt task.inspectionPointId, of valt terug op task.id', () => {
    const withIp = discipline.tasks.find((t) => t.inspectionPointId !== undefined);
    const withoutIp = NEN_DISCIPLINES.flatMap((d) => d.tasks).find(
      (t) => t.inspectionPointId === undefined,
    );
    if (withIp) {
      expect(toNenCaptureTask(discipline, withIp).inspectionPointId).toBe(withIp.inspectionPointId);
    }
    // De data bevat minstens één task zonder inspectionPointId (fallback-tak).
    expect(withoutIp).toBeDefined();
    if (withoutIp) {
      const owner = NEN_DISCIPLINES.find((d) => d.tasks.includes(withoutIp))!;
      expect(toNenCaptureTask(owner, withoutIp).inspectionPointId).toBe(withoutIp.id);
    }
  });

  it('voegt normCodes samen tot de standards-string', () => {
    const task = discipline.tasks[0];
    const ct = toNenCaptureTask(discipline, task);
    expect(ct.standards).toBe(task.normCodes.join(' / ') || discipline.standards);
  });
});

describe('nenCaptureTasks', () => {
  it('bevat één capture-task per discipline-task', () => {
    const total = NEN_DISCIPLINES.reduce((sum, d) => sum + d.tasks.length, 0);
    expect(nenCaptureTasks.length).toBe(total);
  });
});

describe('inspectionPointId-lookups', () => {
  it('vindt context + capture-task voor een bestaande inspectionPointId', () => {
    const ipTask = NEN_DISCIPLINES.flatMap((d) => d.tasks).find(
      (t) => t.inspectionPointId !== undefined,
    )!;
    const ctx = findNenTaskContextByInspectionPointId(ipTask.inspectionPointId!);
    expect(ctx?.task.id).toBe(ipTask.id);
    expect(findNenCaptureTaskByInspectionPointId(ipTask.inspectionPointId!)).toBeDefined();
  });

  it('geeft null/undefined bij een onbekende inspectionPointId', () => {
    expect(findNenTaskContextByInspectionPointId('bestaat-niet-xyz')).toBeNull();
    expect(findNenCaptureTaskByInspectionPointId('bestaat-niet-xyz')).toBeUndefined();
  });
});
