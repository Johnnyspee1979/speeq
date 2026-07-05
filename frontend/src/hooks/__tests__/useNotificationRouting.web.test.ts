/**
 * Unit-tests voor useNotificationRouting (web) — vangt deep links (initiële URL
 * + live 'url'-events) op, parseert ze tot een InspectionRouteIntent en routeert
 * éénmalig per unieke key (geen dubbele afhandeling).
 *
 * We mocken `expo-linking` (getInitialURL async; addEventListener vangt de
 * callback en geeft een verwijderbare subscription) en `../../services/deepLinking`
 * (parseInspectionCameraDeepLink → gecontroleerde intent of null). We borgen:
 * routering vanaf de initiële URL, vanaf een live event, dedup op key, dat een
 * null-intent niet routeert, en dat de subscription bij unmount wordt verwijderd.
 */

const mockGetInitialURL = jest.fn<Promise<string | null>, unknown[]>(() =>
  Promise.resolve(null),
);
const mockRemove = jest.fn();
let urlEventCb: ((e: { url: string }) => void) | undefined;
const mockAddEventListener = jest.fn<{ remove: () => void }, unknown[]>(
  (_event: any, cb: any) => {
    urlEventCb = cb;
    return { remove: mockRemove };
  },
);
jest.mock('expo-linking', () => ({
  getInitialURL: (...a: unknown[]) => mockGetInitialURL(...a),
  addEventListener: (...a: unknown[]) => mockAddEventListener(...a),
}));

const mockParse = jest.fn<any, unknown[]>(() => null);
jest.mock('../../services/deepLinking', () => ({
  parseInspectionCameraDeepLink: (...a: unknown[]) => mockParse(...a),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationRouting } from '../useNotificationRouting.web';

beforeEach(() => {
  jest.clearAllMocks();
  urlEventCb = undefined;
  mockGetInitialURL.mockResolvedValue(null);
  mockAddEventListener.mockImplementation((_e: any, cb: any) => {
    urlEventCb = cb;
    return { remove: mockRemove };
  });
  mockParse.mockReturnValue(null);
});

describe('useNotificationRouting.web', () => {
  it('routeert vanaf de initiële URL', async () => {
    const intent = { projectId: 'p1', screen: 'camera' };
    mockGetInitialURL.mockResolvedValue('speeq://camera/p1');
    mockParse.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith(intent));
    expect(onRoute).toHaveBeenCalledTimes(1);
  });

  it('routeert vanaf een live url-event', () => {
    const intent = { projectId: 'p2', screen: 'camera' };
    mockParse.mockReturnValue(intent);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    act(() => {
      urlEventCb?.({ url: 'speeq://camera/p2' });
    });
    expect(onRoute).toHaveBeenCalledWith(intent);
  });

  it('handelt dezelfde key maar één keer af (dedup)', () => {
    mockParse.mockReturnValue({ projectId: 'p3', screen: 'camera' });
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    act(() => {
      urlEventCb?.({ url: 'speeq://camera/p3' });
      urlEventCb?.({ url: 'speeq://camera/p3' });
    });
    expect(onRoute).toHaveBeenCalledTimes(1);
  });

  it('routeert niet bij een null-intent', () => {
    mockParse.mockReturnValue(null);
    const onRoute = jest.fn();
    renderHook(() => useNotificationRouting(onRoute));
    act(() => {
      urlEventCb?.({ url: 'speeq://onbekend' });
    });
    expect(onRoute).not.toHaveBeenCalled();
  });

  it('verwijdert de subscription bij unmount', () => {
    const { unmount } = renderHook(() => useNotificationRouting(jest.fn()));
    expect(mockRemove).not.toHaveBeenCalled();
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
