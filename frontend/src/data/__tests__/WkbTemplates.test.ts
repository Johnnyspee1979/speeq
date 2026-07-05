/**
 * Struct-invariant-tests voor wkbTaskTemplates — de samengestelde WKB-taak-
 * templatelijst (NEN-normsets + discipline-sets samengevoegd) en de lookup
 * findWkbTaskTemplateByInspectionPointId.
 *
 * We borgen pure data-invarianten die het dossier-pad veronderstelt: elke
 * template heeft de verplichte niet-lege velden, een geldige categorie en
 * dossier-scope, en een geldige hex-kleur. Daarnaast leggen we het feitelijke
 * lookup-contract vast (eerste match op inspectionPointId; undefined bij een
 * onbekende key).
 *
 * NB: id en inspectionPointId zijn bewust NIET globaal-uniek in de huidige data
 * (meerdere blokken hergebruiken dezelfde norm-arrays). Dit is een bekende
 * bevinding — niet hier afgedwongen om de test niet aan brak gedrag te koppelen.
 */

import {
  wkbTaskTemplates,
  findWkbTaskTemplateByInspectionPointId,
} from '../WkbTemplates';

const CATEGORIES = new Set([
  'BOUW',
  'STRUCTURAL',
  'BOUWFYSICA',
  'INSTALLATIE',
  'AFBOUW_SCHILDER',
  'ELEKTRA',
  'BRANDVEILIGHEID',
]);
const SCOPES = new Set(['BEVOEGD_GEZAG', 'CONSUMENT', 'BOTH']);
const HEX = /^#[0-9A-Fa-f]{6}$/;
const REQUIRED_STRINGS = [
  'id',
  'title',
  'description',
  'inspectionPointId',
  'disciplineId',
  'disciplineTitle',
  'standards',
  'instruction',
] as const;

describe('wkbTaskTemplates', () => {
  it('bevat templates', () => {
    expect(wkbTaskTemplates.length).toBeGreaterThan(0);
  });

  it('heeft per template de verplichte niet-lege string-velden', () => {
    const offenders = wkbTaskTemplates
      .filter((t) =>
        REQUIRED_STRINGS.some(
          (f) => typeof t[f] !== 'string' || (t[f] as string).trim() === '',
        ),
      )
      .map((t) => t.id);
    expect(offenders).toEqual([]);
  });

  it('gebruikt alleen geldige categorie- en dossierscope-waarden', () => {
    const badCat = wkbTaskTemplates.filter((t) => !CATEGORIES.has(t.categoryId)).map((t) => t.id);
    const badScope = wkbTaskTemplates.filter((t) => !SCOPES.has(t.dossierScope)).map((t) => t.id);
    expect(badCat).toEqual([]);
    expect(badScope).toEqual([]);
  });

  it('heeft een geldige hex-kleur en boolean requiresExif', () => {
    const badColor = wkbTaskTemplates.filter((t) => !HEX.test(t.color)).map((t) => t.id);
    const badExif = wkbTaskTemplates
      .filter((t) => typeof t.requiresExif !== 'boolean')
      .map((t) => t.id);
    expect(badColor).toEqual([]);
    expect(badExif).toEqual([]);
  });

  it('koppelt een icon-component aan elke template', () => {
    const noIcon = wkbTaskTemplates.filter((t) => t.icon == null).map((t) => t.id);
    expect(noIcon).toEqual([]);
  });
});

describe('findWkbTaskTemplateByInspectionPointId', () => {
  it('vindt voor elke template een match op inspectionPointId', () => {
    const misses = wkbTaskTemplates
      .filter((t) => {
        const hit = findWkbTaskTemplateByInspectionPointId(t.inspectionPointId);
        return !hit || hit.inspectionPointId !== t.inspectionPointId;
      })
      .map((t) => t.inspectionPointId);
    expect(misses).toEqual([]);
  });

  it('geeft de eerste match terug bij hergebruikte inspectionPointId', () => {
    const ip = wkbTaskTemplates[0].inspectionPointId;
    const first = wkbTaskTemplates.find((t) => t.inspectionPointId === ip);
    expect(findWkbTaskTemplateByInspectionPointId(ip)?.id).toBe(first?.id);
  });

  it('geeft undefined bij een onbekende inspectionPointId', () => {
    expect(findWkbTaskTemplateByInspectionPointId('bestaat-niet-xyz')).toBeUndefined();
  });
});
