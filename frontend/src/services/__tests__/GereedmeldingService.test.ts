import {
  BORGERSVERKLARING_CATEGORIE_ID,
  REACTIETERMIJN_DAGEN,
  beoordeelGereedmeldPakket,
  berekenKlok,
  berekenUitersteReactiedatum,
  formatKlokRegel,
} from '../GereedmeldingService';
import {
  type ChecklistItemState,
  computeCompleteness,
} from '../DossierCheckService';
import type { DossierCategorie } from '../../config/dossierBevoegdGezag';

describe('GereedmeldingService — tweeweken-klok', () => {
  it('uiterste reactiedatum is gereedmelding + 14 dagen', () => {
    const uiterste = berekenUitersteReactiedatum('2026-06-01T10:00:00.000Z');
    expect(uiterste).toBe('2026-06-15T10:00:00.000Z');
    expect(REACTIETERMIJN_DAGEN).toBe(14);
  });

  it('rekent resterende dagen narekenbaar uit', () => {
    const klok = berekenKlok('2026-06-01T10:00:00.000Z', '2026-06-08T10:00:00.000Z');
    expect(klok.uiterste).toBe('2026-06-15T10:00:00.000Z');
    expect(klok.dagenResterend).toBe(7);
    expect(klok.verstreken).toBe(false);
  });

  it('markeert een verstreken termijn en klemt op 0', () => {
    const klok = berekenKlok('2026-06-01T10:00:00.000Z', '2026-06-20T10:00:00.000Z');
    expect(klok.verstreken).toBe(true);
    expect(klok.dagenResterend).toBe(0);
  });

  it('rondt een halve resterende dag naar boven af', () => {
    const klok = berekenKlok('2026-06-01T10:00:00.000Z', '2026-06-14T22:00:00.000Z');
    // uiterste 15 juni 10:00, nu 14 juni 22:00 → 12 uur over → 1 dag.
    expect(klok.dagenResterend).toBe(1);
  });

  it('formatKlokRegel toont resterende dagen of verstreken', () => {
    const lopend = berekenKlok('2026-06-01T10:00:00.000Z', '2026-06-08T10:00:00.000Z');
    expect(formatKlokRegel(lopend)).toContain('nog 7 dag');
    const voorbij = berekenKlok('2026-06-01T10:00:00.000Z', '2026-06-20T10:00:00.000Z');
    expect(formatKlokRegel(voorbij)).toContain('verstreken');
  });
});

describe('GereedmeldingService — pakketoordeel', () => {
  const cats: DossierCategorie[] = [
    { id: 'keuringsrapporten', naam: 'Keuringen', omschrijving: '', todo: 'leg vast', autoBron: 'EVIDENCE', nvtToegestaan: false },
    { id: BORGERSVERKLARING_CATEGORIE_ID, naam: 'Verklaring borger', omschrijving: '', todo: 'vraag op', autoBron: null, nvtToegestaan: false },
  ];

  it('flagt borgersverklaring expliciet als die ontbreekt', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'keuringsrapporten', status: 'AANWEZIG' },
      { categorieId: BORGERSVERKLARING_CATEGORIE_ID, status: 'ONTBREEKT' },
    ];
    const completeness = computeCompleteness(states, cats);
    const oordeel = beoordeelGereedmeldPakket(completeness, states);
    expect(oordeel.borgersverklaringOntbreekt).toBe(true);
    expect(oordeel.gereed).toBe(false);
    expect(oordeel.blokkers.map((b) => b.categorieId)).toContain(BORGERSVERKLARING_CATEGORIE_ID);
  });

  it('is gereed als alles aanwezig is, borger inbegrepen', () => {
    const states: ChecklistItemState[] = [
      { categorieId: 'keuringsrapporten', status: 'AANWEZIG' },
      { categorieId: BORGERSVERKLARING_CATEGORIE_ID, status: 'AANWEZIG' },
    ];
    const completeness = computeCompleteness(states, cats);
    const oordeel = beoordeelGereedmeldPakket(completeness, states);
    expect(oordeel.gereed).toBe(true);
    expect(oordeel.borgersverklaringOntbreekt).toBe(false);
    expect(oordeel.blokkers).toHaveLength(0);
  });
});
