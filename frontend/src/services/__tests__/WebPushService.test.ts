/**
 * @jest-environment jsdom
 *
 * Unit-tests voor WebPushService — Web Push subscribe/unsubscribe voor de PWA.
 * Alleen web; native push loopt via NotificationService.
 *
 * We draaien in jsdom en zetten zelf de browser-globals neer (navigator.service-
 * Worker, window.PushManager, Notification, fetch). De module leest VAPID/SUPABASE
 * uit env op import-tijd, dus laden we 'm vers per test (`isolateModulesAsync`) en
 * zetten env vooraf. We borgen:
 *   - de support-guards: no_vapid (lege VAPID), denied (geen toestemming);
 *   - de happy path: requestPermission → subscribe → POST naar Supabase → subscribed;
 *   - save_failed bij een !ok-respons van de upsert;
 *   - unsubscribe: opzeggen + PATCH is_active=false;
 *   - isPushSupported / getPushPermission.
 */

const mockFetch = jest.fn();
const mockRequestPermission = jest.fn(() => Promise.resolve('granted' as NotificationPermission));
const mockSubscription: any = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256', auth: 'auth' } }),
  unsubscribe: jest.fn(() => Promise.resolve(true)),
};
const mockPushManager: any = {
  getSubscription: jest.fn(() => Promise.resolve(null)),
  subscribe: jest.fn(() => Promise.resolve(mockSubscription)),
};

type Mod = typeof import('../WebPushService');
async function loadFresh(): Promise<Mod> {
  let m!: Mod;
  await jest.isolateModulesAsync(async () => {
    m = await import('../WebPushService');
  });
  return m;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY = 'AAAA';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://sb.test';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-1';

  mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
  mockRequestPermission.mockResolvedValue('granted');
  mockPushManager.getSubscription.mockResolvedValue(null);
  mockPushManager.subscribe.mockResolvedValue(mockSubscription);

  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager: mockPushManager }) },
    configurable: true,
  });
  (window as any).PushManager = function () {};
  (globalThis as any).Notification = {
    permission: 'granted' as NotificationPermission,
    requestPermission: mockRequestPermission,
  };
  (global as any).fetch = (...a: unknown[]) => mockFetch(...a);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('subscribeToWebPush', () => {
  it('geeft no_vapid zonder VAPID-key', async () => {
    delete process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    const m = await loadFresh();
    const res = await m.subscribeToWebPush('p-1', 'u-1', 'tok');
    expect(res).toEqual({ subscribed: false, reason: 'no_vapid' });
  });

  it('geeft denied wanneer toestemming niet granted is', async () => {
    mockRequestPermission.mockResolvedValue('default');
    const m = await loadFresh();
    const res = await m.subscribeToWebPush('p-1', 'u-1', 'tok');
    expect(res).toEqual({ subscribed: false, reason: 'denied' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('subscribet en upsert naar Supabase, geeft subscribed:true', async () => {
    const m = await loadFresh();
    const res = await m.subscribeToWebPush('p-1', 'u-1', 'tok-9');
    expect(res).toEqual({ subscribed: true });

    expect(mockPushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('https://sb.test/rest/v1/push_subscriptions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-9');
    expect(init.headers.apikey).toBe('anon-1');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      user_id: 'u-1',
      project_id: 'p-1',
      endpoint: 'https://push.example/abc',
      keys_p256dh: 'p256',
      keys_auth: 'auth',
      is_active: true,
    });
  });

  it('hergebruikt een bestaande subscription (geen nieuwe subscribe)', async () => {
    mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
    const m = await loadFresh();
    await m.subscribeToWebPush('p-1', 'u-1', 'tok');
    expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('geeft save_failed bij een !ok-respons', async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('rls') });
    const m = await loadFresh();
    const res = await m.subscribeToWebPush('p-1', 'u-1', 'tok');
    expect(res).toEqual({ subscribed: false, reason: 'save_failed', message: 'rls' });
  });
});

describe('unsubscribeFromWebPush', () => {
  it('zegt op en deactiveert in Supabase via PATCH', async () => {
    mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
    const m = await loadFresh();
    await m.unsubscribeFromWebPush('tok-7');

    expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toContain('/rest/v1/push_subscriptions?endpoint=eq.');
    expect(url).toContain(encodeURIComponent('https://push.example/abc'));
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ is_active: false });
  });

  it('doet niets zonder bestaande subscription', async () => {
    mockPushManager.getSubscription.mockResolvedValue(null);
    const m = await loadFresh();
    await m.unsubscribeFromWebPush('tok');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('isPushSupported / getPushPermission', () => {
  it('isPushSupported is true met alle globals aanwezig', async () => {
    const m = await loadFresh();
    expect(m.isPushSupported()).toBe(true);
  });

  it('getPushPermission geeft de huidige Notification.permission', async () => {
    (globalThis as any).Notification.permission = 'granted';
    const m = await loadFresh();
    expect(m.getPushPermission()).toBe('granted');
  });
});
