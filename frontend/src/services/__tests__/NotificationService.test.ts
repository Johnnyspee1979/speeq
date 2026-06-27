/**
 * Unit-tests voor NotificationService — Wkb-pushnotificaties (blurry-photo-alert
 * + registratie van reviewnotificaties via de backend).
 *
 * We mocken expo-notifications, react-native (mutabele Platform.OS), config/app,
 * de Supabase-sessie en global.fetch, en borgen:
 *   - web kort alles af (requestPermissions → false, register → reason 'web',
 *     triggerBlurryPhotoAlert plant geen notificatie);
 *   - op native plant triggerBlurryPhotoAlert wél een notificatie met de
 *     vaste Wkb-boodschap;
 *   - registerForReviewNotifications: happy path POST met Bearer + payload,
 *     'not_authenticated' zonder sessie, en gooit bij een !ok-response.
 */

const mockPlatform = { OS: 'web' as string };
let mockSession: { data: { session: unknown } } = {
  data: { session: { access_token: 'tok-123' } },
};
let mockPermStatus = 'granted';
const mockSchedule = jest.fn((..._a: unknown[]) => Promise.resolve());

jest.mock('react-native', () => ({ Platform: mockPlatform }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: (..._a: unknown[]) => Promise.resolve(),
  getPermissionsAsync: (..._a: unknown[]) => Promise.resolve({ status: mockPermStatus }),
  requestPermissionsAsync: (..._a: unknown[]) => Promise.resolve({ status: mockPermStatus }),
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
  getExpoPushTokenAsync: (..._a: unknown[]) => Promise.resolve({ data: 'ExpoToken[abc]' }),
  AndroidImportance: { MAX: 5 },
  AndroidNotificationPriority: { MAX: 'max' },
}));

jest.mock('../../config/app', () => ({
  BACKEND_URL: 'http://bk.test',
  EXPO_PROJECT_ID: 'proj-1',
}));

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve(mockSession) } },
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import {
  BLURRY_PHOTO_MESSAGE,
  requestNotificationPermissions,
  triggerBlurryPhotoAlert,
  registerForReviewNotifications,
} from '../NotificationService';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  mockSession = { data: { session: { access_token: 'tok-123' } } };
  mockPermStatus = 'granted';
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('web kort alles af', () => {
  it('exporteert de vaste Wkb-boodschap', () => {
    expect(BLURRY_PHOTO_MESSAGE).toContain('Wkb-dossier');
  });

  it('requestNotificationPermissions geeft false op web', async () => {
    await expect(requestNotificationPermissions()).resolves.toBe(false);
  });

  it('registerForReviewNotifications geeft reason web', async () => {
    await expect(registerForReviewNotifications('p-1')).resolves.toEqual({
      registered: false,
      reason: 'web',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('triggerBlurryPhotoAlert plant niets op web', async () => {
    await triggerBlurryPhotoAlert();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('native gedrag', () => {
  it('triggerBlurryPhotoAlert plant een notificatie met de Wkb-boodschap', async () => {
    mockPlatform.OS = 'ios';
    await triggerBlurryPhotoAlert();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const arg = mockSchedule.mock.calls[0][0] as any;
    expect(arg.content.title).toBe('Kwaliteitswaarschuwing');
    expect(arg.content.body).toBe(BLURRY_PHOTO_MESSAGE);
  });

  it('registerForReviewNotifications POST met Bearer + payload (happy path)', async () => {
    mockPlatform.OS = 'ios';
    const res = await registerForReviewNotifications('p-7', 'iPhone van Jan');
    expect(res).toEqual({ registered: true, reason: 'ok' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('http://bk.test/api/notifications/register');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      projectId: 'p-7',
      expoPushToken: 'ExpoToken[abc]',
      platform: 'ios',
      deviceLabel: 'iPhone van Jan',
    });
  });

  it('geeft not_authenticated zonder sessie-token', async () => {
    mockPlatform.OS = 'ios';
    mockSession = { data: { session: null } };
    await expect(registerForReviewNotifications('p-1')).resolves.toEqual({
      registered: false,
      reason: 'not_authenticated',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('gooit met de server-foutmelding bij een !ok-response', async () => {
    mockPlatform.OS = 'ios';
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'token al geregistreerd' }),
    });
    await expect(registerForReviewNotifications('p-1')).rejects.toThrow('token al geregistreerd');
  });

  it('geeft permissions_denied wanneer toestemming ontbreekt', async () => {
    mockPlatform.OS = 'ios';
    mockPermStatus = 'denied';
    await expect(registerForReviewNotifications('p-1')).resolves.toEqual({
      registered: false,
      reason: 'permissions_denied',
    });
  });
});
