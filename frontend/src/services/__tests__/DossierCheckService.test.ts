import {
  type ChecklistItemState,
  computeCompleteness,
  pasAutomatischeDekkingToe,
} from '../DossierCheckService';
import {
  DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN,
  type DossierCategorie,
} from '../../config/dossierBevoegdGezag';

// Compacte testset met narekenbare uitkomsten (los van de echte config).
const testCategorieen: DossierCategorie[] = [
  { id: 'a', naam: 'A', omschrijving: '', todo: 'doe A', autoBron: null, nvtToegestaan: false },
  { id: 'b', naam: 'B', omschrijving: '', todo: 'doe B', autoBron: 'EVIDENCE', nvtToegestaan: false },
  { id: 'c', naam: 'C', omschrijving: '', todo: 'doe C', autoBron: null, nvtToegestaan: true },
  { id: 'd', naam: 'D', omschrijving: '', todo: 'doe D', autoBron: 'EVIDENCE', nvtToegestaan: true },
];

describe('DossierCheckService — computeCompleteness', () => {
  it('groen + 100% als alle niet-n.v.t. aanwezig zijn', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'AANWEZIG' },
      { categorieId: 'b', status: 'AANWEZIG' },
      { categorieId: 'c', status: 'NVT', nvtReden: 'geen constructiewijziging' },
      { categorieId: 'd', status: 'NVT', nvtReden: 'geen installaties' },
    ];
    const r = computeCompleteness(states, testCategorieen);
    expect(r.gereed).toBe(true);
    expect(r.statusKleur).toBe('groen');
    expect(r.score).toBe(100);
    expect(r.verplicht).toBe(2); // c+d zijn n.v.t.
    expect(r.ontbrekend).toHaveLength(0);
  });

  it('n.v.t. telt niet mee in de noemer', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'AANWEZIG' },
      { categorieId: 'b', status: 'ONTBREEKT' },
      { categorieId: 'c', status: 'NVT', nvtReden: 'x' },
      { categorieId: 'd', status: 'NVT', nvtReden: 'y' },
    ];
    const r = computeCompleteness(states, testCategorieen);
    // 1 van 2 verplicht aanwezig → 50%, oranje, niet gereed.
    expect(r.verplicht).toBe(2);
    expect(r.aanwezig).toBe(1);
    expect(r.score).toBe(50);
    expect(r.statusKleur).toBe('oranje');
    expect(r.gereed).toBe(false);
  });

  it('rood onder 50%', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'ONTBREEKT' },
      { categorieId: 'b', status: 'ONTBREEKT' },
      { categorieId: 'c', status: 'AANWEZIG' },
      { categorieId: 'd', status: 'ONTBREEKT' },
    ];
    const r = computeCompleteness(states, testCategorieen);
    // verplicht = a,b,c,d = 4; aanwezig = 1 → 25% rood.
    expect(r.score).toBe(25);
    expect(r.statusKleur).toBe('rood');
  });

  it('ontbrekende items dragen mensentaal-todo mee', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'a', status: 'ONTBREEKT' },
    ];
    const r = computeCompleteness(states, testCategorieen);
    const a = r.ontbrekend.find((o) => o.categorieId === 'a');
    expect(a?.todo).toBe('doe A');
  });

  it('onbekende/ontbrekende state telt als ONTBREEKT', () => {
    const r = computeCompleteness([], testCategorieen);
    expect(r.aanwezig).toBe(0);
    expect(r.ontbrekend.length).toBe(4);
  });
});

describe('DossierCheckService — pasAutomatischeDekkingToe', () => {
  it('zet EVIDENCE-categorie op AANWEZIG als die gedekt is', () => {
    const out = pasAutomatischeDekkingToe([], ['b'], testCategorieen);
    expect(out.find((s) => s.categorieId === 'b')?.status).toBe('AANWEZIG');
    // Niet-gedekte EVIDENCE-categorie blijft ontbreken.
    expect(out.find((s) => s.categorieId === 'd')?.status).toBe('ONTBREEKT');
    // Handmatige categorie zonder autoBron blijft ontbreken.
    expect(out.find((s) => s.categorieId === 'a')?.status).toBe('ONTBREEKT');
  });

  it('respecteert een handmatige NVT (handmatig wint)', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'd', status: 'NVT', nvtReden: 'geen installaties' },
    ];
    const out = pasAutomatischeDekkingToe(states, ['d'], testCategorieen);
    expect(out.find((s) => s.categorieId === 'd')?.status).toBe('NVT');
  });

  it('werkt end-to-end met automatische dekking + score', () => {
    const out = pasAutomatischeDekkingToe(
      [
        { categorieId: 'a', status: 'AANWEZIG' },
        { categorieId: 'c', status: 'NVT', nvtReden: 'x' },
      ],
      ['b', 'd'],
      testCategorieen
    );
    const r = computeCompleteness(out, testCategorieen);
    // a aanwezig, b auto, c nvt, d auto → 3 van 3 verplicht → groen.
    expect(r.gereed).toBe(true);
    expect(r.score).toBe(100);
  });
});

describe('DossierCheckService — echte config', () => {
  it('de standaard categorie-lijst heeft unieke, stabiele ids', () => {
    const ids = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leeg project is rood en niet gereed', () => {
    const r = computeCompleteness([]);
    expect(r.gereed).toBe(false);
    expect(r.statusKleur).toBe('rood');
  });
});
