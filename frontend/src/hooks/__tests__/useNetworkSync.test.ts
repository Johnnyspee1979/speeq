/**
 * @jest-environment jsdom
 *
 * Unit-tests voor useNetworkSync — web-only online/offline-detectie die de
 * upload-wachtrij synchroniseert. Luistert op window 'online'/'offline', telt
 * de openstaande (unsynced) bewijsitems, en triggert syncEvidenceQueue bij
 * online-worden.
 *
 * We draaien onder jsdom (echte window/navigator + events) en mocken
 * `react-native` (Platform mutabel: web vs. native), `../../services/sync`
 * (syncEvidenceQueue) en `../../database/database` (getUnsyncedEvidence). We
 * borgen: de initiële online-status + pending-count, dat een 'online'-event de
 * sync triggert en de teller bijwerkt, dat 'offline' de status omzet, dat de
 * hook op native niets doet, en dat de listeners bij unmount worden verwijderd.
 */

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

const mockSyncEvidenceQueue = jest.fn<Promise<any>, unknown[]>(() =>
  Promise.resolve({ status: 'idle', count: 0 }),
);
jest.mock('../../services/sync', () => ({
  syncEvidenceQueue: (...a: unknown[]) => mockSyncEvidenceQueue(...a),
}));

const mockGetUnsyncedEvidence = jest.fn<Promise<any[]>, unknown[]>(() => Promise.resolve([]));
jest.mock('../../database/database', () => ({
  getUnsyncedEvidence: (...a: unknown[]) => mockGetUnsyncedEvidence(...a),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNetworkSync } from '../useNetworkSync';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  mockSyncEvidenceQueue.mockResolvedValue({ status: 'idle', count: 0 });
  mockGetUnsyncedEvidence.mockResolvedValue([]);
});

describe('useNetworkSync', () => {
  it('start online (jsdom navigator.onLine) en leest de pending-count', async () => {
    mockGetUnsyncedEvidence.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { result } = renderHook(() => useNetworkSync());
    expect(result.current.isOnline).toBe(true);
    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    expect(mockGetUnsyncedEvidence).toHaveBeenCalled();
  });

  it('triggert sync bij een online-event en werkt de teller bij', async () => {
    mockSyncEvidenceQueue.mockResolvedValue({ status: 'synced', count: 3 });
    const { result } = renderHook(() => useNetworkSync());
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSyncEvidenceQueue).toHaveBeenCalled());
    await waitFor(() => expect(result.current.lastSyncedCount).toBe(3));
    expect(result.current.lastSyncAt).toBeInstanceOf(Date);
  });

  it('zet de status op offline bij een offline-event', async () => {
    const { result } = renderHook(() => useNetworkSync());
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      await Promise.resolve();
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('registreert geen online-listener en synct niet op native', async () => {
    mockPlatform.OS = 'ios';
    const addSpy = jest.spyOn(window, 'addEventListener');
    const { result } = renderHook(() => useNetworkSync());
    expect(result.current.isOnline).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    // de web-only effect-tak (online/offline + sync) draait niet op native
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).not.toContain('online');
    expect(mockSyncEvidenceQueue).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('verwijdert de window-listeners bij unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useNetworkSync());
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('online');
    expect(events).toContain('offline');
    removeSpy.mockRestore();
  });
});
