/**
 * @jest-environment jsdom
 *
 * Unit-tests voor autoSync — triggert de SyncEngine zodra het apparaat online
 * komt, met een in-flight-guard zodat er nooit twee syncs tegelijk lopen.
 *
 * We mocken de SyncEngine, react-native Platform (mutabel) en NetInfo, en laden
 * de module vers per test (`isolateModulesAsync`) zodat de module-level
 * `inFlight`-vlag niet lekt. We borgen:
 *   - triggerSyncIfOnline draait de engine één keer en de guard slikt een
 *     tweede gelijktijdige call (maar laat een latere call wél door);
 *   - registerAutoSync (web) hangt aan window 'online' en ruimt netjes op;
 *   - registerAutoSync (native) abonneert op NetInfo en geeft een unsubscribe.
 */

const mockPlatform = { OS: 'web' as string };
const mockRun = jest.fn(() => Promise.resolve());
const mockNetUnsub = jest.fn();
const mockAddEventListener = jest.fn((..._a: unknown[]) => mockNetUnsub);

jest.mock('react-native', () => ({ Platform: mockPlatform }));
jest.mock('../SyncEngine', () => ({ runSyncEngine: (..._a: unknown[]) => mockRun() }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (...a: unknown[]) => mockAddEventListener(...a) },
}));

type Mod = typeof import('../autoSync');
async function loadFresh(): Promise<Mod> {
  let m!: Mod;
  await jest.isolateModulesAsync(async () => {
    m = await import('../autoSync');
  });
  return m;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  mockRun.mockImplementation(() => Promise.resolve());
});

describe('triggerSyncIfOnline', () => {
  it('draait de SyncEngine één keer', async () => {
    const m = await loadFresh();
    await m.triggerSyncIfOnline();
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('slikt een tweede gelijktijdige call maar laat een latere call door', async () => {
    let resolveRun!: () => void;
    mockRun.mockImplementationOnce(
      () => new Promise<void>((r) => { resolveRun = () => r(); }),
    );
    const m = await loadFresh();

    const p1 = m.triggerSyncIfOnline(); // start; inFlight = true
    const p2 = m.triggerSyncIfOnline(); // guard → meteen klaar, geen 2e run
    await p2;
    expect(mockRun).toHaveBeenCalledTimes(1);

    resolveRun();
    await p1;

    await m.triggerSyncIfOnline(); // guard vrij → mag weer
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});

describe('registerAutoSync (web)', () => {
  it('hangt aan window online, triggert sync en ruimt op bij cleanup', async () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const m = await loadFresh();

    const off = m.registerAutoSync();
    const onlineCall = addSpy.mock.calls.find((c) => c[0] === 'online');
    expect(onlineCall).toBeDefined();

    const handler = onlineCall![1] as () => void;
    handler();
    await Promise.resolve();
    expect(mockRun).toHaveBeenCalledTimes(1);

    off();
    expect(removeSpy).toHaveBeenCalledWith('online', handler);
  });
});

describe('registerAutoSync (native)', () => {
  it('abonneert op NetInfo en geeft een werkende unsubscribe', async () => {
    mockPlatform.OS = 'ios';
    const m = await loadFresh();
    const off = m.registerAutoSync();
    expect(typeof off).toBe('function');

    // laat de dynamische import + .then() afronden
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    // verbonden-state → sync
    const cb = mockAddEventListener.mock.calls[0][0] as (s: { isConnected: boolean }) => void;
    cb({ isConnected: true });
    await Promise.resolve();
    expect(mockRun).toHaveBeenCalled();

    off();
    expect(mockNetUnsub).toHaveBeenCalledTimes(1);
  });
});
