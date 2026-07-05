import {
  type ControlepuntReview,
  TLOKB_REFERENTIE,
  berekenEersteKeerGoed,
  formatEersteKeerGoedRegel,
  isEersteKeerGoed,
} from '../EersteKeerGoedService';

describe('EersteKeerGoedService — isEersteKeerGoed', () => {
  it('telt APPROVED zonder afkeuring als eerste keer goed', () => {
    expect(isEersteKeerGoed({ reviewStatus: 'APPROVED', everRejected: false })).toBe(true);
  });

  it('telt FINALIZED zonder afkeuring als eerste keer goed', () => {
    expect(isEersteKeerGoed({ reviewStatus: 'FINALIZED', everRejected: false })).toBe(true);
  });

  it('telt APPROVED-na-afkeuring als NIET eerste keer goed', () => {
    expect(isEersteKeerGoed({ reviewStatus: 'APPROVED', everRejected: true })).toBe(false);
  });

  it('behandelt een ontbrekende everRejected-vlag als niet-afgekeurd', () => {
    expect(isEersteKeerGoed({ reviewStatus: 'APPROVED' })).toBe(true);
  });

  it('telt nog-niet-afgeronde punten niet mee (null)', () => {
    expect(isEersteKeerGoed({ reviewStatus: 'PENDING_REVIEW' })).toBeNull();
    expect(isEersteKeerGoed({ reviewStatus: 'REJECTED', everRejected: true })).toBeNull();
    expect(isEersteKeerGoed({ reviewStatus: null })).toBeNull();
  });
});

describe('EersteKeerGoedService — berekenEersteKeerGoed', () => {
  it('rekent een narekenbare projectset correct uit', () => {
    // 5 afgerond: 3 eerste keer goed, 2 na herstel → 60%.
    // 2 niet-afgerond (pending/rejected) tellen niet mee in de noemer.
    const rows: ControlepuntReview[] = [
      { reviewStatus: 'APPROVED', everRejected: false }, // ekg
      { reviewStatus: 'APPROVED', everRejected: false }, // ekg
      { reviewStatus: 'FINALIZED', everRejected: false }, // ekg
      { reviewStatus: 'APPROVED', everRejected: true }, // hersteld
      { reviewStatus: 'FINALIZED', everRejected: true }, // hersteld
      { reviewStatus: 'PENDING_REVIEW' }, // telt niet
      { reviewStatus: 'REJECTED', everRejected: true }, // telt niet
    ];
    const r = berekenEersteKeerGoed(rows);
    expect(r.afgerond).toBe(5);
    expect(r.eersteKeerGoed).toBe(3);
    expect(r.percentage).toBe(60);
  });

  it('rondt af op een heel getal (1/3 → 33%)', () => {
    const rows: ControlepuntReview[] = [
      { reviewStatus: 'APPROVED', everRejected: false },
      { reviewStatus: 'APPROVED', everRejected: true },
      { reviewStatus: 'APPROVED', everRejected: true },
    ];
    expect(berekenEersteKeerGoed(rows).percentage).toBe(33);
  });

  it('geeft percentage null als er nog niets is afgerond', () => {
    const rows: ControlepuntReview[] = [
      { reviewStatus: 'PENDING_REVIEW' },
      { reviewStatus: 'REJECTED', everRejected: true },
    ];
    const r = berekenEersteKeerGoed(rows);
    expect(r.afgerond).toBe(0);
    expect(r.percentage).toBeNull();
  });

  it('geeft 100% als alles in één keer goed ging', () => {
    const rows: ControlepuntReview[] = [
      { reviewStatus: 'APPROVED', everRejected: false },
      { reviewStatus: 'FINALIZED', everRejected: false },
    ];
    expect(berekenEersteKeerGoed(rows).percentage).toBe(100);
  });

  it('aggregeert over meerdere projecten (tenant-cijfer) door rijen samen te voegen', () => {
    const projectA: ControlepuntReview[] = [
      { reviewStatus: 'APPROVED', everRejected: false },
      { reviewStatus: 'APPROVED', everRejected: true },
    ];
    const projectB: ControlepuntReview[] = [
      { reviewStatus: 'FINALIZED', everRejected: false },
      { reviewStatus: 'FINALIZED', everRejected: false },
    ];
    const tenant = berekenEersteKeerGoed([...projectA, ...projectB]);
    expect(tenant.afgerond).toBe(4);
    expect(tenant.eersteKeerGoed).toBe(3);
    expect(tenant.percentage).toBe(75);
  });
});

describe('EersteKeerGoedService — formatEersteKeerGoedRegel', () => {
  it('bouwt een dossierregel met cijfer + landelijke referentie + bron', () => {
    const regel = formatEersteKeerGoedRegel(berekenEersteKeerGoed([
      { reviewStatus: 'APPROVED', everRejected: false },
      { reviewStatus: 'APPROVED', everRejected: true },
    ]));
    expect(regel).toContain('50%');
    expect(regel).toContain(`${TLOKB_REFERENTIE.zonderBorgerPct}%`);
    expect(regel).toContain(`${TLOKB_REFERENTIE.metBorgerPct}%`);
    expect(regel).toContain(TLOKB_REFERENTIE.bron);
  });

  it('geeft null als er geen cijfer is (niets afgerond)', () => {
    expect(
      formatEersteKeerGoedRegel(berekenEersteKeerGoed([{ reviewStatus: 'PENDING_REVIEW' }]))
    ).toBeNull();
  });
});
