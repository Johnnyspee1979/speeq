/**
 * Tests voor de KiK-retry-cronjob (jobs/kikRetryCron.ts).
 *
 * startKiKRetryJob bepaalt OF de cron geregistreerd wordt (feature-flag + config);
 * runKiKRetryJob haalt RETRY_PENDING-bewijs op en probeert het opnieuw naar KiK te
 * duwen. Een fout hier laat een uitgezette job tóch draaien, of markeert geldig
 * bewijs verkeerd als FAILED.
 *
 * We borgen het feitelijke gedrag:
 *  - startKiKRetryJob registreert NIETS als de flag uit staat of de KiK-config
 *    ontbreekt, en registreert precies één keer (caching) als alles klopt;
 *  - runKiKRetryJob doet niets zonder Supabase-config;
 *  - met data markeert het bewijs zónder payload als FAILED en duwt het bewijs
 *    mét payload naar KiK.
 *
 * node-cron, supabase, config en kikService zijn gemockt → geen echte cron/IO.
 */

const mockSchedule = jest.fn((_schedule?: string, _fn?: () => void) => ({ stop: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: mockSchedule }));

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

const mockHasSupabaseConfig = jest.fn();
const mockBackendConfig: Record<string, unknown> = {};
jest.mock('../../config', () => ({
  backendConfig: mockBackendConfig,
  hasSupabaseConfig: mockHasSupabaseConfig,
}));

const mockBuildPayload = jest.fn();
const mockIsMissingCol = jest.fn();
const mockPush = jest.fn();
const mockSafeUpdate = jest.fn();
jest.mock('../../services/kikService', () => ({
  buildKiKEvidencePayload: mockBuildPayload,
  isMissingKikStatusColumnError: mockIsMissingCol,
  pushEvidenceToKiK: mockPush,
  safeUpdateKikSyncStatus: mockSafeUpdate,
}));

const setConfig = (over: Record<string, unknown> = {}) => {
  for (const k of Object.keys(mockBackendConfig)) delete mockBackendConfig[k];
  Object.assign(
    mockBackendConfig,
    {
      kikRetryEnabled: true,
      kikApiUrl: 'https://kik.example',
      kikApiKey: 'key',
      kikRetrySchedule: '0 * * * *',
      supabaseUrl: 'su',
      supabaseServiceKey: 'sk',
    },
    over
  );
};

const loadJob = () => {
  jest.resetModules();
  return require('../kikRetryCron');
};

beforeEach(() => {
  setConfig();
  mockHasSupabaseConfig.mockReturnValue(false);
  mockIsMissingCol.mockReturnValue(false);
});

describe('startKiKRetryJob — registratie-gating', () => {
  it('registreert niets als de feature-flag uit staat', () => {
    setConfig({ kikRetryEnabled: false });
    expect(loadJob().startKiKRetryJob()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('registreert niets als de KiK-config ontbreekt', () => {
    setConfig({ kikApiUrl: '' });
    expect(loadJob().startKiKRetryJob()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('registreert de cron met het ingestelde schema en cachet de task', () => {
    const job = loadJob();
    const task = job.startKiKRetryJob();
    expect(task).not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0]?.[0]).toBe('0 * * * *');

    // Tweede aanroep gebruikt de gecachte task → geen tweede registratie.
    const again = job.startKiKRetryJob();
    expect(again).toBe(task);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe('runKiKRetryJob — verwerking', () => {
  it('doet niets zonder Supabase-config', async () => {
    mockHasSupabaseConfig.mockReturnValue(false);
    await loadJob().runKiKRetryJob();
    expect(mockBuildPayload).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('markeert bewijs zonder payload als FAILED en duwt geldig bewijs naar KiK', async () => {
    mockHasSupabaseConfig.mockReturnValue(true);

    const rows = [
      { id: 'bad' },
      { id: 'good', project_id: 'P-1' },
    ];
    const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    mockCreateClient.mockReturnValue({ from });

    mockBuildPayload.mockImplementation((_projectId: string, item: { id: string }) =>
      item.id === 'good' ? { evidenceId: 'good' } : null
    );
    mockPush.mockResolvedValue({ success: true });

    await loadJob().runKiKRetryJob();

    expect(from).toHaveBeenCalledWith('evidence');
    expect(eq).toHaveBeenCalledWith('kik_sync_status', 'RETRY_PENDING');
    expect(mockSafeUpdate).toHaveBeenCalledWith('bad', 'FAILED');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ evidenceId: 'good' });
  });
});
