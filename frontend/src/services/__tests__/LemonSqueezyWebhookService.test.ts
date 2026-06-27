import {
  type LemonSqueezyWebhook,
  isAbonnementEvent,
  parseAbonnementWebhook,
} from '../LemonSqueezyWebhookService';

const maakPayload = (over: Partial<LemonSqueezyWebhook> = {}): LemonSqueezyWebhook => ({
  meta: {
    event_name: 'subscription_created',
    custom_data: { tenant_id: 'combivo' },
  },
  data: {
    id: 'sub_123',
    attributes: {
      status: 'active',
      variant_name: 'Team',
      customer_id: 4567,
      renews_at: '2026-07-27T12:00:00Z',
      ends_at: null,
      trial_ends_at: null,
    },
  },
  ...over,
});

describe('LemonSqueezyWebhookService — isAbonnementEvent', () => {
  it('herkent abonnement-events', () => {
    expect(isAbonnementEvent(maakPayload())).toBe(true);
    expect(
      isAbonnementEvent({ meta: { event_name: 'subscription_cancelled' } })
    ).toBe(true);
  });

  it('negeert niet-relevante events', () => {
    expect(isAbonnementEvent({ meta: { event_name: 'order_created' } })).toBe(false);
    expect(isAbonnementEvent({})).toBe(false);
    expect(isAbonnementEvent({ meta: { event_name: null } })).toBe(false);
  });
});

describe('LemonSqueezyWebhookService — parseAbonnementWebhook', () => {
  it('parset een actief abonnement met renews_at als geldigTot', () => {
    const u = parseAbonnementWebhook(maakPayload());
    expect(u).toEqual({
      tenantId: 'combivo',
      status: 'actief',
      plan: 'Team',
      geldigTot: '2026-07-27T12:00:00Z',
      proefEindigtAt: null,
      lsCustomerId: '4567',
      lsSubscriptionId: 'sub_123',
    });
  });

  it('gebruikt ends_at boven renews_at bij opzegging', () => {
    const u = parseAbonnementWebhook(
      maakPayload({
        meta: { event_name: 'subscription_cancelled', custom_data: { tenant_id: 'combivo' } },
        data: {
          id: 'sub_123',
          attributes: {
            status: 'cancelled',
            renews_at: '2026-07-27T12:00:00Z',
            ends_at: '2026-07-10T12:00:00Z',
          },
        },
      })
    );
    expect(u.status).toBe('opgezegd');
    expect(u.geldigTot).toBe('2026-07-10T12:00:00Z');
  });

  it('neemt trial_ends_at over bij een proef', () => {
    const u = parseAbonnementWebhook(
      maakPayload({
        data: {
          id: 'sub_9',
          attributes: { status: 'on_trial', trial_ends_at: '2026-07-04T12:00:00Z' },
        },
      })
    );
    expect(u.status).toBe('op_proef');
    expect(u.proefEindigtAt).toBe('2026-07-04T12:00:00Z');
  });

  it('fail-closed: onbekende status → "geen"', () => {
    const u = parseAbonnementWebhook(
      maakPayload({ data: { id: 'x', attributes: { status: 'wat_dan_ook' } } })
    );
    expect(u.status).toBe('geen');
  });

  it('lege/ontbrekende velden worden null', () => {
    const u = parseAbonnementWebhook({});
    expect(u).toEqual({
      tenantId: null,
      status: 'geen',
      plan: null,
      geldigTot: null,
      proefEindigtAt: null,
      lsCustomerId: null,
      lsSubscriptionId: null,
    });
  });

  it('lege strings worden genormaliseerd naar null', () => {
    const u = parseAbonnementWebhook(
      maakPayload({
        meta: { event_name: 'subscription_updated', custom_data: { tenant_id: '  ' } },
        data: { id: '', attributes: { status: 'active', variant_name: '', renews_at: '' } },
      })
    );
    expect(u.tenantId).toBeNull();
    expect(u.lsSubscriptionId).toBeNull();
    expect(u.plan).toBeNull();
    expect(u.geldigTot).toBeNull();
  });
});
