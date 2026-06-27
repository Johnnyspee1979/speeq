import {
  type TenantAbonnement,
  bepaalToegang,
  formatToegangsRegel,
  mapLemonSqueezyStatus,
} from '../EntitlementService';

const nu = new Date('2026-06-27T12:00:00Z');
const overMorgen = '2026-06-29T12:00:00Z';
const gisteren = '2026-06-26T12:00:00Z';

describe('EntitlementService — mapLemonSqueezyStatus', () => {
  it('mapt bekende Lemon-Squeezy-statussen naar de interne status', () => {
    expect(mapLemonSqueezyStatus('on_trial')).toBe('op_proef');
    expect(mapLemonSqueezyStatus('active')).toBe('actief');
    expect(mapLemonSqueezyStatus('past_due')).toBe('betaling_te_laat');
    expect(mapLemonSqueezyStatus('unpaid')).toBe('betaling_te_laat');
    expect(mapLemonSqueezyStatus('paused')).toBe('gepauzeerd');
    expect(mapLemonSqueezyStatus('cancelled')).toBe('opgezegd');
    expect(mapLemonSqueezyStatus('expired')).toBe('verlopen');
  });

  it('is hoofdletter-ongevoelig', () => {
    expect(mapLemonSqueezyStatus('ACTIVE')).toBe('actief');
    expect(mapLemonSqueezyStatus('On_Trial')).toBe('op_proef');
  });

  it('valt fail-closed terug op "geen" bij onbekend, leeg of null', () => {
    expect(mapLemonSqueezyStatus('iets_raars')).toBe('geen');
    expect(mapLemonSqueezyStatus('')).toBe('geen');
    expect(mapLemonSqueezyStatus(null)).toBe('geen');
    expect(mapLemonSqueezyStatus(undefined)).toBe('geen');
  });
});

describe('EntitlementService — bepaalToegang', () => {
  it('geeft toegang bij een actief abonnement', () => {
    const b = bepaalToegang({ status: 'actief' }, nu);
    expect(b.toegang).toBe(true);
    expect(b.inProefperiode).toBe(false);
  });

  it('proef met toekomstige einddatum geeft toegang en telt dagen', () => {
    const b = bepaalToegang({ status: 'op_proef', geldigTot: overMorgen }, nu);
    expect(b.toegang).toBe(true);
    expect(b.inProefperiode).toBe(true);
    expect(b.dagenResterend).toBe(2);
  });

  it('proef zonder einddatum geeft toegang', () => {
    const b = bepaalToegang({ status: 'op_proef' }, nu);
    expect(b.toegang).toBe(true);
    expect(b.inProefperiode).toBe(true);
  });

  it('verlopen proef geeft geen toegang', () => {
    const b = bepaalToegang({ status: 'op_proef', geldigTot: gisteren }, nu);
    expect(b.toegang).toBe(false);
    expect(b.inProefperiode).toBe(false);
    expect(b.dagenResterend).toBe(0);
  });

  it('opgezegd: toegang loopt door tot einde betaalde periode', () => {
    const nog = bepaalToegang({ status: 'opgezegd', geldigTot: overMorgen }, nu);
    expect(nog.toegang).toBe(true);
    expect(nog.inProefperiode).toBe(false);

    const op = bepaalToegang({ status: 'opgezegd', geldigTot: gisteren }, nu);
    expect(op.toegang).toBe(false);
  });

  it('betaling te laat: toegang tijdelijk behouden tot einde periode', () => {
    const nog = bepaalToegang({ status: 'betaling_te_laat', geldigTot: overMorgen }, nu);
    expect(nog.toegang).toBe(true);

    const op = bepaalToegang({ status: 'betaling_te_laat', geldigTot: gisteren }, nu);
    expect(op.toegang).toBe(false);
  });

  it('opgezegd zonder einddatum geeft geen toegang', () => {
    expect(bepaalToegang({ status: 'opgezegd' }, nu).toegang).toBe(false);
  });

  it('gepauzeerd en verlopen geven geen toegang', () => {
    expect(bepaalToegang({ status: 'gepauzeerd' }, nu).toegang).toBe(false);
    expect(bepaalToegang({ status: 'verlopen' }, nu).toegang).toBe(false);
  });

  it('fail-closed: null, undefined en "geen" geven geen toegang', () => {
    expect(bepaalToegang(null, nu).toegang).toBe(false);
    expect(bepaalToegang(undefined, nu).toegang).toBe(false);
    expect(bepaalToegang({ status: 'geen' }, nu).toegang).toBe(false);
  });

  it('ongeldige datum telt als verlopen (0 dagen, geen toegang bij grace-status)', () => {
    const b = bepaalToegang({ status: 'betaling_te_laat', geldigTot: 'geen-datum' }, nu);
    expect(b.dagenResterend).toBe(0);
    expect(b.toegang).toBe(false);
  });
});

describe('EntitlementService — formatToegangsRegel', () => {
  it('toont proef-regel met resterende dagen', () => {
    const b = bepaalToegang({ status: 'op_proef', geldigTot: overMorgen }, nu);
    expect(formatToegangsRegel(b)).toContain('Proef actief');
    expect(formatToegangsRegel(b)).toContain('2 dag');
  });

  it('toont actief-regel', () => {
    const b = bepaalToegang({ status: 'actief' }, nu);
    expect(formatToegangsRegel(b)).toBe('Abonnement actief.');
  });

  it('toont geen-toegang-regel met reden', () => {
    const b = bepaalToegang({ status: 'verlopen' }, nu);
    const regel = formatToegangsRegel(b);
    expect(regel).toContain('Geen toegang');
    expect(regel).toContain('verlopen');
  });
});
