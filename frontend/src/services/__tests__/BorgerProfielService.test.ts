import {
  type BorgerProfiel,
  DEFAULT_BESTANDSNAAM_SJABLOON,
  formatBestandsnaam,
  profielCompleetheid,
  renderDossierVoorProfiel,
} from '../BorgerProfielService';
import type { ChecklistItemState } from '../DossierCheckService';
import type { DossierCategorie } from '../../config/dossierBevoegdGezag';

const cats: DossierCategorie[] = [
  { id: 'a', naam: 'A', omschrijving: '', todo: '', autoBron: null, nvtToegestaan: false },
  { id: 'b', naam: 'B', omschrijving: '', todo: '', autoBron: null, nvtToegestaan: false },
  { id: 'c', naam: 'C', omschrijving: '', todo: '', autoBron: null, nvtToegestaan: false },
];

const profiel: BorgerProfiel = {
  id: 'p1',
  naam: 'PlanGarant',
  rubriekVolgorde: ['c', 'a'],
  verplichteCategorieen: ['a', 'c'],
};

describe('BorgerProfielService — renderDossierVoorProfiel', () => {
  it('zet de profiel-volgorde voorop, daarna de rest', () => {
    const out = renderDossierVoorProfiel(profiel, [], cats);
    expect(out.map((r) => r.categorieId)).toEqual(['c', 'a', 'b']);
  });

  it('markeert welke rubrieken verplicht zijn voor dit profiel', () => {
    const out = renderDossierVoorProfiel(profiel, [], cats);
    expect(out.find((r) => r.categorieId === 'a')?.verplichtVoorProfiel).toBe(true);
    expect(out.find((r) => r.categorieId === 'b')?.verplichtVoorProfiel).toBe(false);
  });

  it('neemt de actuele status per rubriek mee', () => {
    const states: ChecklistItemState[] = [{ categorieId: 'a', status: 'AANWEZIG' }];
    const out = renderDossierVoorProfiel(profiel, states, cats);
    expect(out.find((r) => r.categorieId === 'a')?.status).toBe('AANWEZIG');
    expect(out.find((r) => r.categorieId === 'b')?.status).toBe('ONTBREEKT');
  });
});

describe('BorgerProfielService — profielCompleetheid', () => {
  it('rekent alleen over de profiel-verplichte rubrieken', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'AANWEZIG' },
      { categorieId: 'c', status: 'ONTBREEKT' },
      { categorieId: 'b', status: 'ONTBREEKT' }, // niet verplicht voor profiel
    ];
    const r = profielCompleetheid(profiel, states, cats);
    // Noemer = a + c = 2; aanwezig = 1 → 50%. b telt niet mee.
    expect(r.verplicht).toBe(2);
    expect(r.aanwezig).toBe(1);
    expect(r.score).toBe(50);
    expect(r.gereed).toBe(false);
  });

  it('is gereed als alle profiel-verplichte rubrieken aanwezig zijn', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'AANWEZIG' },
      { categorieId: 'c', status: 'AANWEZIG' },
    ];
    const r = profielCompleetheid(profiel, states, cats);
    expect(r.gereed).toBe(true);
    expect(r.score).toBe(100);
  });
});

describe('BorgerProfielService — formatBestandsnaam', () => {
  it('vult project, borger en datum in', () => {
    const naam = formatBestandsnaam(profiel, {
      project: 'Tuinstraat 12',
      datumISO: '2026-06-14T10:00:00.000Z',
    });
    expect(naam).toBe('WKB_Tuinstraat_12_PlanGarant_2026-06-14');
  });

  it('gebruikt het default-sjabloon als er geen is ingesteld', () => {
    expect(profiel.bestandsnaamSjabloon).toBeUndefined();
    expect(DEFAULT_BESTANDSNAAM_SJABLOON).toContain('{project}');
  });

  it('respecteert een eigen sjabloon', () => {
    const eigen: BorgerProfiel = { ...profiel, bestandsnaamSjabloon: '{borger}-{datum}' };
    expect(
      formatBestandsnaam(eigen, { project: 'X', datumISO: '2026-06-14T00:00:00.000Z' })
    ).toBe('PlanGarant-2026-06-14');
  });
});
