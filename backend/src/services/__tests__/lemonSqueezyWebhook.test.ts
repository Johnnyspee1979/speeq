const crypto = require('crypto');
const {
  verifySignature,
  isAbonnementEvent,
  parseWebhook,
} = require('../lemonSqueezyWebhook');

const SECRET = 'test_signing_secret';
const ondertekend = (body: string): string =>
  crypto.createHmac('sha256', SECRET).update(body).digest('hex');

describe('lemonSqueezyWebhook — verifySignature', () => {
  it('accepteert een correct ondertekende body', () => {
    const body = JSON.stringify({ meta: { event_name: 'subscription_created' } });
    expect(verifySignature(body, ondertekend(body), SECRET)).toBe(true);
  });

  it('werkt met een Buffer-body (zoals express.raw geeft)', () => {
    const body = Buffer.from('{"hoi":true}');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifySignature(body, sig, SECRET)).toBe(true);
  });

  it('weigert een verkeerde handtekening', () => {
    const body = '{"a":1}';
    expect(verifySignature(body, 'deadbeef', SECRET)).toBe(false);
    expect(verifySignature(body, ondertekend(body), 'ander_secret')).toBe(false);
  });

  it('weigert bij ontbrekende handtekening of secret', () => {
    expect(verifySignature('{}', null, SECRET)).toBe(false);
    expect(verifySignature('{}', 'x', null)).toBe(false);
    expect(verifySignature('{}', undefined, undefined)).toBe(false);
  });
});

describe('lemonSqueezyWebhook — isAbonnementEvent', () => {
  it('herkent relevante events en negeert de rest', () => {
    expect(isAbonnementEvent({ meta: { event_name: 'subscription_updated' } })).toBe(true);
    expect(isAbonnementEvent({ meta: { event_name: 'order_created' } })).toBe(false);
    expect(isAbonnementEvent({})).toBe(false);
  });
});

describe('lemonSqueezyWebhook — parseWebhook', () => {
  it('parset status, plan, datums en ids', () => {
    const u = parseWebhook({
      meta: { event_name: 'subscription_created', custom_data: { tenant_id: 'combivo' } },
      data: {
        id: 'sub_1',
        attributes: {
          status: 'active',
          variant_name: 'Professional (maandelijks)',
          customer_id: 42,
          renews_at: '2026-07-27T12:00:00Z',
          ends_at: null,
          trial_ends_at: null,
        },
      },
    });
    expect(u).toEqual({
      tenantId: 'combivo',
      status: 'actief',
      plan: 'Professional (maandelijks)',
      geldigTot: '2026-07-27T12:00:00Z',
      proefEindigtAt: null,
      lsCustomerId: '42',
      lsSubscriptionId: 'sub_1',
    });
  });

  it('gebruikt ends_at boven renews_at bij opzegging, fail-closed status', () => {
    const u = parseWebhook({
      meta: { event_name: 'subscription_cancelled', custom_data: { tenant_id: 'x' } },
      data: {
        id: 's',
        attributes: { status: 'cancelled', renews_at: '2026-08-01T00:00:00Z', ends_at: '2026-07-10T00:00:00Z' },
      },
    });
    expect(u.status).toBe('opgezegd');
    expect(u.geldigTot).toBe('2026-07-10T00:00:00Z');
  });

  it('lege payload → alles null en status geen', () => {
    expect(parseWebhook({})).toEqual({
      tenantId: null,
      status: 'geen',
      plan: null,
      geldigTot: null,
      proefEindigtAt: null,
      lsCustomerId: null,
      lsSubscriptionId: null,
    });
  });
});
