const { mapLemonSqueezyStatus, bepaalToegang } = require('../entitlementService');

const nu = new Date('2026-06-27T12:00:00Z');
const toekomst = '2026-06-29T12:00:00Z';
const verleden = '2026-06-26T12:00:00Z';

describe('entitlementService (backend) — mapLemonSqueezyStatus', () => {
  it('mapt bekende statussen', () => {
    expect(mapLemonSqueezyStatus('on_trial')).toBe('op_proef');
    expect(mapLemonSqueezyStatus('active')).toBe('actief');
    expect(mapLemonSqueezyStatus('past_due')).toBe('betaling_te_laat');
    expect(mapLemonSqueezyStatus('unpaid')).toBe('betaling_te_laat');
    expect(mapLemonSqueezyStatus('paused')).toBe('gepauzeerd');
    expect(mapLemonSqueezyStatus('cancelled')).toBe('opgezegd');
    expect(mapLemonSqueezyStatus('expired')).toBe('verlopen');
  });

  it('fail-closed bij onbekend/leeg/null', () => {
    expect(mapLemonSqueezyStatus('raar')).toBe('geen');
    expect(mapLemonSqueezyStatus('')).toBe('geen');
    expect(mapLemonSqueezyStatus(null)).toBe('geen');
    expect(mapLemonSqueezyStatus(undefined)).toBe('geen');
  });
});

describe('entitlementService (backend) — bepaalToegang', () => {
  it('actief → toegang', () => {
    expect(bepaalToegang({ status: 'actief' }, nu).toegang).toBe(true);
  });

  it('proef met toekomstige einddatum → toegang + dagen', () => {
    const b = bepaalToegang({ status: 'op_proef', geldigTot: toekomst }, nu);
    expect(b.toegang).toBe(true);
    expect(b.inProefperiode).toBe(true);
    expect(b.dagenResterend).toBe(2);
  });

  it('verlopen proef → geen toegang', () => {
    expect(bepaalToegang({ status: 'op_proef', geldigTot: verleden }, nu).toegang).toBe(false);
  });

  it('opgezegd/betaling-te-laat → toegang tot einde periode', () => {
    expect(bepaalToegang({ status: 'opgezegd', geldigTot: toekomst }, nu).toegang).toBe(true);
    expect(bepaalToegang({ status: 'opgezegd', geldigTot: verleden }, nu).toegang).toBe(false);
    expect(bepaalToegang({ status: 'betaling_te_laat', geldigTot: toekomst }, nu).toegang).toBe(true);
    expect(bepaalToegang({ status: 'betaling_te_laat', geldigTot: verleden }, nu).toegang).toBe(false);
  });

  it('gepauzeerd/verlopen/geen → geen toegang', () => {
    expect(bepaalToegang({ status: 'gepauzeerd' }, nu).toegang).toBe(false);
    expect(bepaalToegang({ status: 'verlopen' }, nu).toegang).toBe(false);
    expect(bepaalToegang({ status: 'geen' }, nu).toegang).toBe(false);
  });

  it('fail-closed bij null/undefined', () => {
    expect(bepaalToegang(null, nu).toegang).toBe(false);
    expect(bepaalToegang(undefined, nu).toegang).toBe(false);
  });
});
