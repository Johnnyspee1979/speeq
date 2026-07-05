import {
  type SamenvattingBron,
  type SamenvattingControlepunt,
  BOUWFASEN,
  bouwKwaliteitssamenvatting,
  formatSamenvatting,
} from '../KwaliteitssamenvattingService';

const cp = (
  id: string,
  fase: string,
  o: Partial<SamenvattingControlepunt> = {}
): SamenvattingControlepunt => ({
  id,
  fase,
  afgerond: true,
  heeftFoto: true,
  heeftTijdstempel: true,
  heeftLocatie: true,
  ...o,
});

const volledig: SamenvattingBron = {
  project: {
    naam: 'Woning 12',
    adres: 'Dorpsstraat 1',
    gevolgklasse: 'GK1',
    aannemer: 'Combivo',
    kwaliteitsborger: 'Borger BV',
    instrument: 'KOMO',
    gereedmeldingDatum: '2026-07-01',
  },
  controlepunten: [
    cp('a', 'fundering'),
    cp('b', 'ruwbouw'),
    cp('c', 'installaties'),
    cp('d', 'afbouw'),
    cp('e', 'oplevering'),
  ],
  afwijkingen: [{ opgelost: true }, { opgelost: false, openReden: 'wacht op onderdeel' }],
};

describe('KwaliteitssamenvattingService — cijfers', () => {
  it('telt controlepunten, foto, tijdstempel+locatie en % afgerond', () => {
    const s = bouwKwaliteitssamenvatting(volledig);
    expect(s.controlepunten.totaal).toBe(5);
    expect(s.controlepunten.metFoto).toBe(5);
    expect(s.controlepunten.metTijdstempelLocatie).toBe(5);
    expect(s.controlepunten.procentAfgerond).toBe(100);
  });

  it('tijdstempel+locatie vereist beide', () => {
    const s = bouwKwaliteitssamenvatting({
      project: { naam: 'X' },
      controlepunten: [
        cp('a', 'fundering', { heeftLocatie: false }),
        cp('b', 'ruwbouw'),
      ],
    });
    expect(s.controlepunten.metTijdstempelLocatie).toBe(1);
  });

  it('telt afwijkingen: geconstateerd/opgelost/open met reden', () => {
    const s = bouwKwaliteitssamenvatting(volledig);
    expect(s.afwijkingen).toMatchObject({ geconstateerd: 2, opgelost: 1, open: 1 });
    expect(s.afwijkingen.openRedenen).toEqual(['wacht op onderdeel']);
  });
});

describe('KwaliteitssamenvattingService — fasedekking', () => {
  it('geeft alle bouwfasen in vaste volgorde', () => {
    const s = bouwKwaliteitssamenvatting(volledig);
    expect(s.fasedekking.map((f) => f.fase)).toEqual([...BOUWFASEN]);
    expect(s.fasedekking.every((f) => f.aantal === 1)).toBe(true);
  });

  it('voegt "overig" toe bij onbekende fase', () => {
    const s = bouwKwaliteitssamenvatting({
      project: { naam: 'X' },
      controlepunten: [cp('a', 'sloop')],
    });
    expect(s.fasedekking.find((f) => f.fase === 'overig')?.aantal).toBe(1);
  });
});

describe('KwaliteitssamenvattingService — eerlijke gaten', () => {
  it('benoemt ontbrekende foto, tijdstempel/locatie, lege fasen en open afwijkingen', () => {
    const s = bouwKwaliteitssamenvatting({
      project: { naam: 'X' },
      controlepunten: [cp('a', 'fundering', { heeftFoto: false, heeftLocatie: false })],
      afwijkingen: [{ opgelost: false }],
    });
    const tekst = s.ontbrekend.join(' | ');
    expect(tekst).toContain('Geen foto bij 1');
    expect(tekst).toContain('tijdstempel/locatie bij 1');
    expect(tekst).toContain('fase "ruwbouw"');
    expect(tekst).toContain('1 afwijking(en) nog open');
  });

  it('geen gaten bij een volledig project zonder open afwijkingen', () => {
    const s = bouwKwaliteitssamenvatting({
      ...volledig,
      afwijkingen: [{ opgelost: true }],
    });
    expect(s.ontbrekend).toEqual([]);
  });
});

describe('KwaliteitssamenvattingService — formatSamenvatting', () => {
  it('produceert leesbare tekst met kop en secties', () => {
    const txt = formatSamenvatting(bouwKwaliteitssamenvatting(volledig));
    expect(txt).toContain('KWALITEITSSAMENVATTING');
    expect(txt).toContain('Woning 12');
    expect(txt).toContain('Afgerond: 100%');
    expect(txt).toContain('Bewijs-integriteit');
  });
});
