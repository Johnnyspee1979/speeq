import {
  type Ekv,
  type MontageCheck,
  beoordeelEkv,
  formatEkvRegel,
  montageGereed,
  montageVoortgang,
  vatDossierbijdrageSamen,
} from '../EkvMontageService';

const NU = new Date('2026-06-14T12:00:00.000Z');

const ekvGeldig: Ekv = {
  nummer: 'KOMO-12345',
  uitgever: 'KOMO',
  geldigTot: '2027-01-01',
  bewijsPath: 'storage://ekv/12345.pdf',
};

const check = (status: MontageCheck['status'], id = 'm1'): MontageCheck => ({
  id,
  omschrijving: 'Aansluiting riolering',
  status,
});

describe('EkvMontageService — beoordeelEkv', () => {
  it('geldige EKV met bewijs → GELDIG', () => {
    const b = beoordeelEkv(ekvGeldig, NU);
    expect(b.status).toBe('GELDIG');
    expect(b.heeftBewijs).toBe(true);
  });

  it('geldige EKV zonder bewijs → GELDIG met nuance', () => {
    const b = beoordeelEkv({ ...ekvGeldig, bewijsPath: null }, NU);
    expect(b.status).toBe('GELDIG');
    expect(b.heeftBewijs).toBe(false);
    expect(b.uitleg).toContain('bewijsbestand');
  });

  it('verlopen geldigheid → VERLOPEN', () => {
    const b = beoordeelEkv({ ...ekvGeldig, geldigTot: '2026-01-01' }, NU);
    expect(b.status).toBe('VERLOPEN');
  });

  it('ontbrekend nummer/uitgever → ONVOLLEDIG', () => {
    expect(beoordeelEkv({ uitgever: 'KOMO', geldigTot: '2027-01-01' }, NU).status).toBe(
      'ONVOLLEDIG'
    );
    expect(beoordeelEkv({ nummer: 'X', geldigTot: '2027-01-01' }, NU).status).toBe(
      'ONVOLLEDIG'
    );
  });

  it('niets vastgelegd → GEEN', () => {
    expect(beoordeelEkv(null, NU).status).toBe('GEEN');
    expect(beoordeelEkv({}, NU).status).toBe('GEEN');
  });
});

describe('EkvMontageService — montage-voortgang', () => {
  it('telt akkoord/afgekeurd/open', () => {
    const v = montageVoortgang([check('AKKOORD', 'a'), check('OPEN', 'b'), check('AFGEKEURD', 'c')]);
    expect(v).toMatchObject({ totaal: 3, akkoord: 1, open: 1, afgekeurd: 1, gereed: false });
  });

  it('alle akkoord → gereed', () => {
    expect(montageGereed([check('AKKOORD', 'a'), check('AKKOORD', 'b')])).toBe(true);
  });

  it('lege lijst is niet gereed', () => {
    expect(montageGereed([])).toBe(false);
    expect(montageVoortgang([]).gereed).toBe(false);
  });
});

describe('EkvMontageService — format', () => {
  it('EKV-regel toont nummer + status', () => {
    expect(formatEkvRegel(ekvGeldig, NU)).toBe('EKV KOMO-12345: geldig');
    expect(formatEkvRegel(null)).toBe('EKV: niet vastgelegd');
  });

  it('dossierbijdrage combineert EKV + montage', () => {
    const regel = vatDossierbijdrageSamen(ekvGeldig, [check('AKKOORD', 'a'), check('OPEN', 'b')], NU);
    expect(regel).toBe('EKV KOMO-12345: geldig · montage: 1/2 akkoord');
  });

  it('dossierbijdrage markeert gereed montage-spoor', () => {
    const regel = vatDossierbijdrageSamen(ekvGeldig, [check('AKKOORD', 'a')], NU);
    expect(regel).toContain('(gereed)');
  });

  it('dossierbijdrage zonder checks', () => {
    expect(vatDossierbijdrageSamen(ekvGeldig, [], NU)).toContain('montage: geen checks');
  });
});
