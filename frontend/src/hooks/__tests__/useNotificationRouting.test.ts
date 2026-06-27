/**
 * Unit-tests voor useNotificationRouting (native) — routeert vanuit drie bronnen
 * naar een InspectionRouteIntent: (1) deep links (initiële URL + live url-events),
 * (2) de laatste notificatie-respons bij koude start (useLastNotificationResponse),
 * en (3) live notificatie-taps (addNotificationResponseReceivedListener). Alles
 * met dedup op key, en de notificatie-takken zijn no-ops op web.
 *
 * We mocken `expo-linking` (getInitialURL async + addEventListener capture),
 * `expo-notifications` (useLastNotificationResponse mutabel + listener capture),
 * `../../lib/platform` (isWeb via getter zodat we web/native kunnen wisselen) en
 * `../../services/deepLinking` (twee parsers). We borgen elke bron, dedup, de
 * web-no-op en subscription-cleanup bij unmount.
 */

let mockIsWeb = false;
jest.mock('../../lib/platform', () => ({
  get isWeb() {
    return mockIsWeb;
  },
}));

const mockGetInitialURL = jest.fn<Promise<string | null>, unknown[]>(() =>
  Promise.resolve(null),
);
const mockUrlRemove = jest.fn();
let urlEventCb: ((e: { url: string }) => void) | undefined;
const mockAddUrlListener = jest.fn<{ remove: () => void }, unknown[]>((_e: any, cb: any) => {
  urlEventCb = cb;
  return { remove: mockUrlRemove };
});
jest.mock('expo-linking', () => ({
  getInitialURL: (...a: unknown[]) => mockGetInitialURL(...a),
  addEventListener: (...a: unknown[]) => mockAddUrlListener(...a),
}));

let mockLastResponse: any = null;
const mockNotifRemove = jest.fn();
let notifResponseCb: ((r: any) => void) | undefined;
const mockAddNotifListener = jest.fn<{ remove: () => void }, unknown[]>((cb: any) => {
  notifResponseCb = cb;
  return { remove: mockNotifRemove };
});
jest.mock('expo-notifications', () => ({
  useLastNotificationResponse: () => mockLastResponse,
  addNotificationResponseReceivedListener: (...a: unknown[]) => mockAddNotifListener(...a),
}));

const mockParseDeepLink = jest.fn<any, unknown[]>(() => null);
const mockParseNotif = jest.fn<any, unknown[]>(() => null);
jest.mock('../../services/deepLinking', () => ({
  parseInspectionCameraDeepLink: (...a: unknown[]) => mockParseDeepLink(...a),
  parseInspectionRouteFromNotificationData: (...a: unknown[]) => mockParseNotif(...a),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationRouting } from '../useNotificationRouting';

const notifResponse = (identifier: string, data: unknown) => ({
  notification: { request: { identifier, content: { data } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsWeb = false;
  urlEventCb = undefined;
  notifResponseCb = undefined;
  mockLastResponse = null;
  mockGetInitialURL.mockResolvedValue(null);
  mockAddUrlListener.mockImplementation((_e: any, cb: any) => {
    urlEventCb = cb;
    return { remove: mockUrlRemove };
  });
  mockAddNotifListener.mockImplementation((cb: any) => {
    notifResponseCb = cb;
    return { remove: mockNotifRemove };
  });
  mockParseDeepLink.mockReturnValue(null);
  mockParseNotif.mockReturnValue(null);
});

describe('useNotificationRouting (native)', () => {
  it('routeert vanaf de initiële deep-link-URL', async () => {
    const intent = { projectId: 'p1' };
    mockGetInitialURL.mockResolvedValue('speeq://camera/p1');
    mockParseDeepLink.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith(intent));
  });

  it('routeert vanaf een live url-event', () => {
    const intent = { projectId: 'p2' };
    mockParseDeepLink.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    act(() => urlEventCb?.({ url: 'speeq://camera/p2' }));
    expect(onRoute).toHaveBeenCalledWith(intent);
  });

  it('routeert vanaf de laatste notificatie-respons (koude start)', () => {
    const intent = { projectId: 'p3' };
    mockLastResponse = notifResponse('n3', { foo: 1 });
    mockParseNotif.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    expect(onRoute).toHaveBeenCalledWith(intent);
  });

  it('routeert vanaf een live notificatie-tap en dedupliceert dezelfde id', () => {
    const intent = { projectId: 'p4' };
    mockParseNotif.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    act(() => {
      notifResponseCb?.(notifResponse('n4', { x: 1 }));
      notifResponseCb?.(notifResponse('n4', { x: 1 }));
    });
    expect(onRoute).toHaveBeenCalledTimes(1);
    expect(onRoute).toHaveBeenCalledWith(intent);
  });

  it('negeert notificaties op web (no-op), deep links blijven werken', () => {
    mockIsWeb = true;
    mockLastResponse = notifResponse('n5', { y: 1 });
    mockParseNotif.mockReturnValue({ projectId: 'p5' });
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    // notificatie-listener wordt op web niet geregistreerd
    expect(mockAddNotifListener).not.toHaveBeenCalled();
    // en de laatste-respons-tak routeert niet
    expect(onRoute).not.toHaveBeenCalled();
  });

  it('verwijdert beide subscriptions bij unmount', () => {
    const { unmount } = renderHook(() => useNotificationRouting(jest.fn()));
    unmount();
    expect(mockUrlRemove).toHaveBeenCalledTimes(1);
    expect(mockNotifRemove).toHaveBeenCalledTimes(1);
  });
});
