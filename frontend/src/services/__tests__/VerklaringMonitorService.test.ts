import {
  type BorgingsplanEis,
  STANDAARD_DREMPEL_WERKDAGEN,
  bepaalVerklaringStatus,
  bouwVerklaringChecklist,
  evalueerTijdlijn,
  formatVerklaringRegel,
  werkdagenTussen,
} from '../VerklaringMonitorService';

const eisen: BorgingsplanEis[] = [
  { id: 'fund-foto', naam: 'Foto wapening fundering', soort: 'foto', kritisch: true },
  { id: 'keuring', naam: 'Keuringsrapport beton', soort: 'keuringsrapport', kritisch: true },
  { id: 'asbuilt', naam: 'As-built tekening', soort: 'as-built' },
  { id: 'afwijking', naam: 'Afwijkingen gedocumenteerd', soort: 'afwijking' },
];

describe('VerklaringMonitorService — bouwVerklaringChecklist', () => {
  it('leidt items af uit het borgingsplan en markeert aanwezig via gedekt', () => {
    const items = bouwVerklaringChecklist(eisen, ['fund-foto', 'asbuilt']);
    expect(items).toHaveLength(4);
    expect(items.find((i) => i.id === 'fund-foto')?.aanwezig).toBe(true);
    expect(items.find((i) => i.id === 'keuring')?.aanwezig).toBe(false);
    expect(items.find((i) => i.id === 'keuring')?.kritisch).toBe(true);
    expect(items.find((i) => i.id === 'asbuilt')?.kritisch).toBe(false);
  });
});

describe('VerklaringMonitorService — bepaalVerklaringStatus', () => {
  it('rood zodra een kritisch item ontbreekt', () => {
    const items = bouwVerklaringChecklist(eisen, ['asbuilt', 'afwijking']);
    const status = bepaalVerklaringStatus(items);
    expect(status.statusKleur).toBe('rood');
    expect(status.kritischOntbreekt).toBe(true);
    expect(status.gereed).toBe(false);
  });

  it('oranje als alleen niet-kritische items ontbreken', () => {
    const items = bouwVerklaringChecklist(eisen, ['fund-foto', 'keuring']);
    const status = bepaalVerklaringStatus(items);
    expect(status.statusKleur).toBe('oranje');
    expect(status.kritischOntbreekt).toBe(false);
    expect(status.score).toBe(50);
  });

  it('groen als alles aanwezig is — van rood naar groen', () => {
    const rood = bepaalVerklaringStatus(bouwVerklaringChecklist(eisen, []));
    expect(rood.statusKleur).toBe('rood');
    const groen = bepaalVerklaringStatus(
      bouwVerklaringChecklist(eisen, ['fund-foto', 'keuring', 'asbuilt', 'afwijking'])
    );
    expect(groen.statusKleur).toBe('groen');
    expect(groen.gereed).toBe(true);
    expect(groen.score).toBe(100);
  });

  it('lege checklist telt als groen (niets te bewijzen)', () => {
    const status = bepaalVerklaringStatus([]);
    expect(status.statusKleur).toBe('groen');
    expect(status.score).toBe(100);
  });
});

describe('VerklaringMonitorService — werkdagenTussen', () => {
  it('telt alleen ma–vr, exclusief startdag', () => {
    // ma 2026-06-15 → ma 2026-06-22 = 5 werkdagen (weekend overgeslagen)
    expect(werkdagenTussen(new Date('2026-06-15'), new Date('2026-06-22'))).toBe(5);
  });

  it('geeft 0 als de einddatum niet later is', () => {
    expect(werkdagenTussen(new Date('2026-06-15'), new Date('2026-06-15'))).toBe(0);
    expect(werkdagenTussen(new Date('2026-06-20'), new Date('2026-06-15'))).toBe(0);
  });
});

describe('VerklaringMonitorService — evalueerTijdlijn', () => {
  const groen = bepaalVerklaringStatus(
    bouwVerklaringChecklist(eisen, ['fund-foto', 'keuring', 'asbuilt', 'afwijking'])
  );
  const rood = bepaalVerklaringStatus(bouwVerklaringChecklist(eisen, []));

  it('geen datum → geen waarschuwing', () => {
    const t = evalueerTijdlijn({ gereedmeldingDatum: null, status: rood });
    expect(t.waarschuw).toBe(false);
    expect(t.drempel).toBe(STANDAARD_DREMPEL_WERKDAGEN);
  });

  it('waarschuwt binnen de drempel als status niet groen is', () => {
    const t = evalueerTijdlijn({
      gereedmeldingDatum: '2026-06-22',
      status: rood,
      nu: new Date('2026-06-15'),
    });
    expect(t.waarschuw).toBe(true);
    expect(t.werkdagenResterend).toBe(5);
  });

  it('geen waarschuwing als status groen is, ook binnen de drempel', () => {
    const t = evalueerTijdlijn({
      gereedmeldingDatum: '2026-06-22',
      status: groen,
      nu: new Date('2026-06-15'),
    });
    expect(t.waarschuw).toBe(false);
    expect(t.reden).toContain('aftekenen');
  });

  it('ruim buiten de drempel → geen waarschuwing', () => {
    const t = evalueerTijdlijn({
      gereedmeldingDatum: '2026-08-01',
      status: rood,
      nu: new Date('2026-06-15'),
    });
    expect(t.waarschuw).toBe(false);
  });

  it('verstreken datum + niet groen → waarschuwt', () => {
    const t = evalueerTijdlijn({
      gereedmeldingDatum: '2026-06-10',
      status: rood,
      nu: new Date('2026-06-15'),
    });
    expect(t.waarschuw).toBe(true);
    expect(t.verstreken).toBe(true);
  });
});

describe('VerklaringMonitorService — formatVerklaringRegel', () => {
  it('markeert ontbrekende kritische items', () => {
    const [foto] = bouwVerklaringChecklist(eisen, []);
    expect(formatVerklaringRegel(foto)).toContain('(kritisch)');
    expect(formatVerklaringRegel(foto)).toContain('✗');
  });
});
