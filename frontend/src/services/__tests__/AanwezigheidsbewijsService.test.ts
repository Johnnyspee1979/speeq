import {
  type AanwezigheidsInput,
  KLOK_AFWIJKING_DREMPEL_SEC,
  beoordeelAanwezigheid,
  detecteerKlokafwijking,
  formatAanwezigheidsBadge,
} from '../AanwezigheidsbewijsService';

const basis = (over: Partial<AanwezigheidsInput> = {}): AanwezigheidsInput => ({
  toestemming: true,
  lat: 52.08,
  lng: 4.31,
  accuracyM: 8,
  deviceTime: '2026-06-08T10:14:00.000Z',
  serverTime: '2026-06-08T10:14:30.000Z',
  ...over,
});

describe('AanwezigheidsbewijsService — detecteerKlokafwijking', () => {
  it('kleine afwijking is niet significant', () => {
    const k = detecteerKlokafwijking('2026-06-08T10:14:00.000Z', '2026-06-08T10:14:30.000Z');
    expect(k.afwijkingSec).toBe(30);
    expect(k.significant).toBe(false);
    expect(k.bekend).toBe(true);
  });

  it('afwijking boven de drempel is significant', () => {
    const k = detecteerKlokafwijking('2026-06-08T10:14:00.000Z', '2026-06-08T10:25:00.000Z');
    expect(k.afwijkingSec).toBeGreaterThan(KLOK_AFWIJKING_DREMPEL_SEC);
    expect(k.significant).toBe(true);
  });

  it('zonder server-tijd is de afwijking onbekend', () => {
    const k = detecteerKlokafwijking('2026-06-08T10:14:00.000Z', null);
    expect(k.bekend).toBe(false);
    expect(k.significant).toBe(false);
  });
});

describe('AanwezigheidsbewijsService — beoordeelAanwezigheid', () => {
  it('met locatie + goede nauwkeurigheid + kleine klok → groen, op locatie', () => {
    const b = beoordeelAanwezigheid(basis());
    expect(b.status).toBe('OP_LOCATIE');
    expect(b.kleur).toBe('groen');
    expect(b.nauwkeurigheid).toBe('goed');
    expect(b.nuance).toContain('geen juridisch bewijs');
  });

  it('zonder toestemming → zonder locatiebewijs, grijs, niet blokkeren', () => {
    const b = beoordeelAanwezigheid(basis({ toestemming: false }));
    expect(b.status).toBe('ZONDER_LOCATIE');
    expect(b.kleur).toBe('grijs');
  });

  it('toestemming maar geen GPS → zonder locatiebewijs', () => {
    const b = beoordeelAanwezigheid(basis({ lat: null, lng: null }));
    expect(b.status).toBe('ZONDER_LOCATIE');
  });

  it('lage nauwkeurigheid → oranje met nuance', () => {
    const b = beoordeelAanwezigheid(basis({ accuracyM: 120 }));
    expect(b.nauwkeurigheid).toBe('laag');
    expect(b.kleur).toBe('oranje');
    expect(b.nuance).toContain('nauwkeurigheid is laag');
  });

  it('grote klok-afwijking → oranje met tijd onder voorbehoud', () => {
    const b = beoordeelAanwezigheid(basis({ serverTime: '2026-06-08T10:30:00.000Z' }));
    expect(b.klok.significant).toBe(true);
    expect(b.kleur).toBe('oranje');
    expect(b.nuance).toContain('onder voorbehoud');
  });
});

describe('AanwezigheidsbewijsService — formatAanwezigheidsBadge', () => {
  it('toont datum/tijd + nauwkeurigheid bij locatie', () => {
    expect(formatAanwezigheidsBadge(basis())).toBe(
      'op locatie vastgelegd · 8 juni 2026 10:14 · ±8 m'
    );
  });

  it('toont tijd onder voorbehoud bij grote klok-afwijking', () => {
    const badge = formatAanwezigheidsBadge(basis({ serverTime: '2026-06-08T10:30:00.000Z' }));
    expect(badge).toContain('tijd onder voorbehoud');
  });

  it('toont "zonder locatiebewijs" als locatie ontbreekt', () => {
    expect(formatAanwezigheidsBadge(basis({ toestemming: false }))).toBe(
      'zonder locatiebewijs · 8 juni 2026 10:14'
    );
  });

  it('rondt nauwkeurigheid af op hele meters', () => {
    expect(formatAanwezigheidsBadge(basis({ accuracyM: 7.6 }))).toContain('±8 m');
  });
});
