/**
 * Unit-tests voor OfflineServiceWorkerBridge.
 *
 * Gedekt:
 *   - registerOfflineSyncTag: succes, geen SW, geen SyncManager
 *   - attach + BG_SYNC_REQUESTED message → syncOfflineQueueNow aangeroepen
 *   - attach idempotent
 *   - detach: removeEventListener
 */

const mockSyncOfflineQueueNow = jest.fn();
jest.mock('../OfflineSyncEngine', () => ({
  syncOfflineQueueNow: () => mockSyncOfflineQueueNow(),
}));

// react-native Platform mock — moet 'web' returnen
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  registerOfflineSyncTag,
  attachOfflineServiceWorkerBridge,
  detachOfflineServiceWorkerBridge,
  __resetOfflineServiceWorkerBridgeForTests,
} from '../OfflineServiceWorkerBridge';

// ─── Browser-globals stub ───────────────────────────────────────────────────

interface FakeSwRegistration {
  sync: { register: jest.Mock };
}

interface FakeSwContainer {
  ready: Promise<FakeSwRegistration>;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

let fakeSw: FakeSwContainer;
let fakeSyncRegister: jest.Mock;

function installSwAndSyncManager() {
  fakeSyncRegister = jest.fn().mockResolvedValue(undefined);
  fakeSw = {
    ready: Promise.resolve({
      sync: { register: fakeSyncRegister },
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { serviceWorker: fakeSw },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: { SyncManager: function SyncManager() {} },
    configurable: true,
  });
}

function uninstallBrowserGlobals() {
  delete (globalThis as { navigator?: unknown }).navigator;
  delete (globalThis as { window?: unknown }).window;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncOfflineQueueNow.mockReset().mockResolvedValue(undefined);
  __resetOfflineServiceWorkerBridgeForTests();
});

afterEach(() => {
  uninstallBrowserGlobals();
});

// ─── registerOfflineSyncTag ─────────────────────────────────────────────────

describe('registerOfflineSyncTag', () => {
  it('registreert tag bij volledig browser-support', async () => {
    installSwAndSyncManager();
    const result = await registerOfflineSyncTag();
    expect(result).toBe(true);
    expect(fakeSyncRegister).toHaveBeenCalledWith('wkb-sync-evidence');
  });

  it('false zonder serviceWorker', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { SyncManager: function () {} },
      configurable: true,
    });
    expect(await registerOfflineSyncTag()).toBe(false);
  });

  it('false zonder SyncManager (Safari/Firefox)', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: {} },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    expect(await registerOfflineSyncTag()).toBe(false);
  });

  it('vangt sync.register-fout en returnt false', async () => {
    installSwAndSyncManager();
    fakeSyncRegister.mockRejectedValue(new Error('user denied'));
    expect(await registerOfflineSyncTag()).toBe(false);
  });
});

// ─── attach + message handler ───────────────────────────────────────────────

describe('attachOfflineServiceWorkerBridge', () => {
  it('triggert syncOfflineQueueNow op BG_SYNC_REQUESTED', () => {
    installSwAndSyncManager();
    attachOfflineServiceWorkerBridge();

    expect(fakeSw.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    const handler = fakeSw.addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;

    handler({ data: { type: 'BG_SYNC_REQUESTED' } } as MessageEvent);
    expect(mockSyncOfflineQueueNow).toHaveBeenCalledTimes(1);
  });

  it('negeert andere message-types', () => {
    installSwAndSyncManager();
    attachOfflineServiceWorkerBridge();
    const handler = fakeSw.addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;

    handler({ data: { type: 'SW_UPDATED' } } as MessageEvent);
    handler({ data: null } as unknown as MessageEvent);
    handler({ data: { type: 'PUSH_CLICK' } } as MessageEvent);

    expect(mockSyncOfflineQueueNow).not.toHaveBeenCalled();
  });

  it('is idempotent — twee aanroepen koppelen één listener', () => {
    installSwAndSyncManager();
    attachOfflineServiceWorkerBridge();
    attachOfflineServiceWorkerBridge();
    expect(fakeSw.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('no-op zonder serviceWorker', () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    expect(() => attachOfflineServiceWorkerBridge()).not.toThrow();
  });
});

// ─── detach ─────────────────────────────────────────────────────────────────

describe('detachOfflineServiceWorkerBridge', () => {
  it('haalt listener weg', () => {
    installSwAndSyncManager();
    attachOfflineServiceWorkerBridge();
    detachOfflineServiceWorkerBridge();

    expect(fakeSw.removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });

  it('no-op als nooit attached', () => {
    installSwAndSyncManager();
    detachOfflineServiceWorkerBridge();
    expect(fakeSw.removeEventListener).not.toHaveBeenCalled();
  });

  it('na detach: nieuwe attach werkt weer', () => {
    installSwAndSyncManager();
    attachOfflineServiceWorkerBridge();
    detachOfflineServiceWorkerBridge();
    attachOfflineServiceWorkerBridge();

    expect(fakeSw.addEventListener).toHaveBeenCalledTimes(2);
  });
});
