const { requireActiveSubscription } = require('../requireActiveSubscription');

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

const maakReq = (over: any = {}) => ({
  header: (name: string) => over.headers?.[name.toLowerCase()] ?? undefined,
  user: over.user,
});

describe('requireActiveSubscription', () => {
  const oud = process.env.ENFORCE_SUBSCRIPTION;
  afterEach(() => {
    process.env.ENFORCE_SUBSCRIPTION = oud;
  });

  it('no-op (next) als ENFORCE_SUBSCRIPTION uit staat', async () => {
    delete process.env.ENFORCE_SUBSCRIPTION;
    const req = maakReq({ headers: {} });
    const res = maakRes();
    let nexted = false;
    await requireActiveSubscription(req, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('402 als de muur aanstaat en er geen tenant te bepalen is', async () => {
    process.env.ENFORCE_SUBSCRIPTION = 'true';
    const req = maakReq({ headers: {} });
    const res = maakRes();
    let nexted = false;
    await requireActiveSubscription(req, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toContain('abonnement');
  });

  it('geeft toegang aan de demo-tenant (geldt als actief)', async () => {
    process.env.ENFORCE_SUBSCRIPTION = 'true';
    const req = maakReq({ headers: { 'x-company-id': 'demo' } });
    const res = maakRes();
    let nexted = false;
    await requireActiveSubscription(req, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it('402 voor een onbekende tenant zonder abonnement', async () => {
    process.env.ENFORCE_SUBSCRIPTION = 'true';
    const req = maakReq({ headers: { 'x-company-id': 'onbekend-bedrijf' } });
    const res = maakRes();
    let nexted = false;
    await requireActiveSubscription(req, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(402);
  });
});
