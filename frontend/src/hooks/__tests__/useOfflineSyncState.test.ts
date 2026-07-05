/**
 * Unit-tests voor useOfflineSyncState — abonneert op de OfflineSyncEngine en
 * geeft de actuele sync-status aan UI-componenten.
 *
 * We mocken `../../services/OfflineSyncEngine` (getOfflineSyncState voor de
 * initiële waarde; subscribeOfflineSync dat de setter vangt en een
 * unsubscribe teruggeeft). We borgen: de initiële status, een reactieve update
 * via de subscribe-callback, en dat unsubscribe bij unmount wordt aangeroepen.
 */

const idleState = { status: 'idle', pending: 0 };
const mockGetState = jest.fn<any, unknown[]>(() => idleState);
let subCb: ((s: unknown) => void) | undefined;
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn<() => void, unknown[]>((cb: any) => {
  subCb = cb;
  return mockUnsubscribe;
});

jest.mock('../../services/OfflineSyncEngine', () => ({
  getOfflineSyncState: (...a: unknown[]) => mockGetState(...a),
  subscribeOfflineSync: (...a: unknown[]) => mockSubscribe(...a),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useOfflineSyncState } from '../useOfflineSyncState';

beforeEach(() => {
  jest.clearAllMocks();
  subCb = undefined;
  mockGetState.mockReturnValue(idleState);
  mockSubscribe.mockImplementation((cb: any) => {
    subCb = cb;
    return mockUnsubscribe;
  });
});

describe('useOfflineSyncState', () => {
  it('geeft de initiële status terug en abonneert', () => {
    const { result } = renderHook(() => useOfflineSyncState());
    expect(result.current).toEqual(idleState);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('werkt reactief bij via de subscribe-callback', () => {
    const { result } = renderHook(() => useOfflineSyncState());
    const syncing = { status: 'syncing', pending: 3 };
    act(() => {
      subCb?.(syncing);
    });
    expect(result.current).toEqual(syncing);
  });

  it('zegt het abonnement op bij unmount', () => {
    const { unmount } = renderHook(() => useOfflineSyncState());
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
