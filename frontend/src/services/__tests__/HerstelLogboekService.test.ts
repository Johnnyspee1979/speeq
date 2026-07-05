import {
  type HerstelRecord,
  buildHerstelTijdlijn,
  buildVolledigeHerstelTijdlijn,
  formatHerstelRegel,
  heeftHerstel,
  koppelEersteKeerGoed,
} from '../HerstelLogboekService';
import { berekenEersteKeerGoed, isEersteKeerGoed } from '../EersteKeerGoedService';

const volledigRecord: HerstelRecord = {
  afwijking: 'Kitnaad los bij dorpel',
  afgekeurdAt: '2026-06-10T09:00:00.000Z',
  herstelactie: 'Kitnaad verwijderd en opnieuw aangebracht',
  hersteldAt: '2026-06-11T14:00:00.000Z',
  hercontroleAt: '2026-06-12T08:30:00.000Z',
  hercontrolePlaats: 'Badkamer 1e verdieping',
  fotoPath: 'herstel/abc.jpg',
};

describe('HerstelLogboekService — buildHerstelTijdlijn', () => {
  it('bouwt een drietraps-tijdlijn met eigen tijdstempels, chronologisch', () => {
    const stappen = buildHerstelTijdlijn(volledigRecord);
    expect(stappen.map((s) => s.fase)).toEqual(['AFGEKEURD', 'HERSTELD', 'AKKOORD']);
    expect(stappen[0].tijdstip).toBe('2026-06-10T09:00:00.000Z');
    expect(stappen[1].tijdstip).toBe('2026-06-11T14:00:00.000Z');
    expect(stappen[2].tijdstip).toBe('2026-06-12T08:30:00.000Z');
    // Elk tijdstip ligt later dan het vorige.
    const t = stappen.map((s) => new Date(s.tijdstip).getTime());
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
  });

  it('laat plaats + foto alleen op de akkoord-stap landen', () => {
    const stappen = buildHerstelTijdlijn(volledigRecord);
    const akkoord = stappen.find((s) => s.fase === 'AKKOORD')!;
    expect(akkoord.plaats).toBe('Badkamer 1e verdieping');
    expect(akkoord.fotoPath).toBe('herstel/abc.jpg');
    expect(stappen[0].plaats).toBeUndefined();
  });

  it('valt terug op twee stappen als hersteldAt ontbreekt', () => {
    const zonderHerstelStap: HerstelRecord = {
      afwijking: 'Scheur in stucwerk',
      afgekeurdAt: '2026-06-10T09:00:00.000Z',
      herstelactie: 'Scheur uitgehaald en opnieuw gestuukt',
      hercontroleAt: '2026-06-12T08:30:00.000Z',
    };
    const stappen = buildHerstelTijdlijn(zonderHerstelStap);
    expect(stappen.map((s) => s.fase)).toEqual(['AFGEKEURD', 'AKKOORD']);
    // De herstelactie reist mee op de akkoord-stap.
    expect(stappen[1].omschrijving).toContain('Scheur uitgehaald en opnieuw gestuukt');
  });
});

describe('HerstelLogboekService — meerdere records', () => {
  it('voegt records samen tot één chronologische tijdlijn', () => {
    const tweede: HerstelRecord = {
      afwijking: 'Verfgebrek plint',
      afgekeurdAt: '2026-06-13T09:00:00.000Z',
      herstelactie: 'Geschuurd en overgeschilderd',
      hersteldAt: '2026-06-14T09:00:00.000Z',
      hercontroleAt: '2026-06-15T09:00:00.000Z',
    };
    const stappen = buildVolledigeHerstelTijdlijn([tweede, volledigRecord]);
    // Ondanks omgekeerde invoervolgorde staat de oudste stap vooraan.
    expect(stappen[0].tijdstip).toBe('2026-06-10T09:00:00.000Z');
    expect(stappen[stappen.length - 1].tijdstip).toBe('2026-06-15T09:00:00.000Z');
  });
});

describe('HerstelLogboekService — koppeling met eerste-keer-goed', () => {
  it('een punt met herstel-record telt nooit als eerste keer goed', () => {
    const review = koppelEersteKeerGoed(
      { reviewStatus: 'APPROVED', everRejected: false },
      [volledigRecord]
    );
    expect(review.everRejected).toBe(true);
    expect(isEersteKeerGoed(review)).toBe(false);
  });

  it('laat een punt zonder herstel-record ongemoeid (blijft eerste keer goed)', () => {
    const review = koppelEersteKeerGoed(
      { reviewStatus: 'APPROVED', everRejected: false },
      []
    );
    expect(review.everRejected).toBe(false);
    expect(isEersteKeerGoed(review)).toBe(true);
  });

  it('narekenbaar: 1 hersteld + 1 schoon → 50% eerste keer goed', () => {
    const hersteld = koppelEersteKeerGoed(
      { reviewStatus: 'APPROVED', everRejected: false },
      [volledigRecord]
    );
    const schoon = koppelEersteKeerGoed(
      { reviewStatus: 'APPROVED', everRejected: false },
      []
    );
    const r = berekenEersteKeerGoed([hersteld, schoon]);
    expect(r.afgerond).toBe(2);
    expect(r.eersteKeerGoed).toBe(1);
    expect(r.percentage).toBe(50);
  });

  it('heeftHerstel reageert op aanwezigheid van records', () => {
    expect(heeftHerstel([])).toBe(false);
    expect(heeftHerstel([volledigRecord])).toBe(true);
  });
});

describe('HerstelLogboekService — formatHerstelRegel', () => {
  it('bouwt een dossierregel met afwijking, herstel en hercontrole', () => {
    const regel = formatHerstelRegel(volledigRecord);
    expect(regel).toContain('Kitnaad los bij dorpel');
    expect(regel).toContain('Kitnaad verwijderd en opnieuw aangebracht');
    expect(regel).toContain('Badkamer 1e verdieping');
    expect(regel).toContain('akkoord');
  });
});
