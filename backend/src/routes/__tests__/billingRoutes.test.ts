/**
 * Route-tests voor billingRoutes — het Lemon-Squeezy-webhook-endpoint.
 *
 * Dit is het pad waar betaal-events binnenkomen en de tenant-status wordt
 * bijgewerkt; de HMAC-verificatie en parsing zelf zijn elders getest
 * (lemonSqueezyWebhook.test.ts). Hier borgen we de ROUTE-bedrading:
 *   - 503 zonder signing secret (fail-closed);
 *   - 401 bij ongeldige handtekening (geen tenant-mutatie);
 *   - 400 bij onleesbare payload;
 *   - 200 + ignored voor niet-abonnement-events (geen LS-retry);
 *   - 200 + updateAbonnement aangeroepen voor een abonnement-event;
 *   - 500 als updateAbonnement faalt (LS retryt later).
 *
 * Mock-stijl volgt requireActiveSubscription.test.ts: fake req/res, handler
 * direct uit de router-stack gehaald (geen supertest in deze repo).
 */

const mockVerifySignature = jest.fn();
const mockIsAbonnementEvent = jest.fn();
const mockParseWebhook = jest.fn();
jest.mock('../../services/lemonSqueezyWebhook', () => ({
  verifySignature: (...a: unknown[]) => mockVerifySignature(...a),
  isAbonnementEvent: (...a: unknown[]) => mockIsAbonnementEvent(...a),
  parseWebhook: (...a: unknown[]) => mockParseWebhook(...a),
}));

const mockUpdateAbonnement = jest.fn();
jest.mock('../../services/TenantService', () => ({
  TenantService: { updateAbonnement: (...a: unknown[]) => mockUpdateAbonnement(...a) },
}));

const router = require('../billingRoutes');

// Haal de async POST-handler uit de router-stack.
const handler = router.stack[0].route.stack[0].handle;

const maakRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
};

const maakReq = (over: { signature?: string; body?: unknown } = {}) => ({
  header: (name: string) =>
    name.toLowerCase() === 'x-signature' ? over.signature : undefined,
  body: over.body,
});

describe('billingRoutes — lemon-squeezy/webhook', () => {
  const oudSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'test_secret';
  });

  afterEach(() => {
    if (oudSecret === undefined) delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMONSQUEEZY_WEBHOOK_SECRET = oudSecret;
  });

  it('503 zonder signing secret (fail-closed)', async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const req = maakReq();
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(503);
    expect(mockVerifySignature).not.toHaveBeenCalled();
  });

  it('401 bij ongeldige handtekening, zonder tenant-mutatie', async () => {
    mockVerifySignature.mockReturnValue(false);
    const req = maakReq({ signature: 'fout', body: Buffer.from('{}') });
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(mockUpdateAbonnement).not.toHaveBeenCalled();
  });

  it('400 bij onleesbare payload', async () => {
    mockVerifySignature.mockReturnValue(true);
    const req = maakReq({ signature: 'ok', body: Buffer.from('geen-json{') });
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(mockUpdateAbonnement).not.toHaveBeenCalled();
  });

  it('200 + ignored voor niet-abonnement-events', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockIsAbonnementEvent.mockReturnValue(false);
    const req = maakReq({
      signature: 'ok',
      body: Buffer.from(JSON.stringify({ meta: { event_name: 'order_created' } })),
    });
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, ignored: true });
    expect(mockUpdateAbonnement).not.toHaveBeenCalled();
  });

  it('200 + werkt het abonnement bij voor een abonnement-event', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockIsAbonnementEvent.mockReturnValue(true);
    const update = { tenantId: 'combivo', status: 'actief' };
    mockParseWebhook.mockReturnValue(update);
    mockUpdateAbonnement.mockResolvedValue(undefined);
    const req = maakReq({
      signature: 'ok',
      body: Buffer.from(JSON.stringify({ meta: { event_name: 'subscription_created' } })),
    });
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockUpdateAbonnement).toHaveBeenCalledWith('combivo', update);
  });

  it('500 als updateAbonnement faalt (LS retryt later)', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockIsAbonnementEvent.mockReturnValue(true);
    mockParseWebhook.mockReturnValue({ tenantId: 'x', status: 'actief' });
    mockUpdateAbonnement.mockRejectedValue(new Error('tenant nog niet geprovisioneerd'));
    const req = maakReq({
      signature: 'ok',
      body: Buffer.from(JSON.stringify({ meta: { event_name: 'subscription_updated' } })),
    });
    const res = maakRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
