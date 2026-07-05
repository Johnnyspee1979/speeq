/**
 * Tests voor de nachtelijke dossier-refresh-cronjob (jobs/dossierRefreshCron.ts).
 *
 * startDossierRefreshJob bepaalt OF de cron draait (feature-flag + Adobe-config);
 * runDossierRefreshJob haalt actieve project-id's op en herbouwt per project het
 * PDF-dossier. Een fout hier laat een uitgezette job draaien, of stopt de hele
 * batch zodra één project faalt.
 *
 * We borgen het feitelijke gedrag:
 *  - startDossierRefreshJob registreert NIETS als de flag uit staat of Adobe-
 *    credentials ontbreken, en registreert precies één keer (caching);
 *  - runDossierRefreshJob doet niets zonder Supabase-config;
 *  - met projecten trimt/filtert het lege id's en roept buildDossier per
 *    project aan, ongeacht ok/skipped/mislukt.
 *
 * node-cron, supabase, config en dossierService zijn gemockt → geen echte cron/IO.
 */

const mockSchedule = jest.fn((_schedule?: string, _fn?: () => void) => ({ stop: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: mockSchedule }));

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

const mockHasSupabaseConfig = jest.fn();
const mockHasAdobeConfig = jest.fn();
const mockBackendConfig: Record<string, unknown> = {};
jest.mock('../../config', () => ({
  backendConfig: mockBackendConfig,
  hasSupabaseConfig: mockHasSupabaseConfig,
  hasAdobeConfig: mockHasAdobeConfig,
}));

const mockBuildDossier = jest.fn();
jest.mock('../../services/dossierService', () => ({ buildDossier: mockBuildDossier }));

const setConfig = (over: Record<string, unknown> = {}) => {
  for (const k of Object.keys(mockBackendConfig)) delete mockBackendConfig[k];
  Object.assign(
    mockBackendConfig,
    {
      dossierRefreshEnabled: true,
      dossierRefreshSchedule: '0 3 * * *',
      supabaseUrl: 'su',
      supabaseServiceKey: 'sk',
    },
    over
  );
};

const loadJob = () => {
  jest.resetModules();
  return require('../dossierRefreshCron');
};

beforeEach(() => {
  setConfig();
  mockHasSupabaseConfig.mockReturnValue(false);
  mockHasAdobeConfig.mockReturnValue(true);
});

describe('startDossierRefreshJob — registratie-gating', () => {
  it('registreert niets als de feature-flag uit staat', () => {
    setConfig({ dossierRefreshEnabled: false });
    expect(loadJob().startDossierRefreshJob()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('registreert niets als de Adobe-credentials ontbreken', () => {
    mockHasAdobeConfig.mockReturnValue(false);
    expect(loadJob().startDossierRefreshJob()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('registreert de cron met het ingestelde schema en cachet de task', () => {
    const job = loadJob();
    const task = job.startDossierRefreshJob();
    expect(task).not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0]?.[0]).toBe('0 3 * * *');

    const again = job.startDossierRefreshJob();
    expect(again).toBe(task);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe('runDossierRefreshJob — verwerking', () => {
  it('doet niets zonder Supabase-config', async () => {
    mockHasSupabaseConfig.mockReturnValue(false);
    await loadJob().runDossierRefreshJob();
    expect(mockBuildDossier).not.toHaveBeenCalled();
  });

  it('trimt/filtert lege id\'s en bouwt het dossier per geldig project', async () => {
    mockHasSupabaseConfig.mockReturnValue(true);

    const select = jest.fn().mockResolvedValue({
      data: [{ id: 'P1' }, { id: '   ' }, { id: 'P2' }, { id: null }],
      error: null,
    });
    const from = jest.fn(() => ({ select }));
    mockCreateClient.mockReturnValue({ from });

    mockBuildDossier
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, skipped: true, reason: 'geen bewijs' });

    await loadJob().runDossierRefreshJob();

    expect(from).toHaveBeenCalledWith('projects');
    expect(select).toHaveBeenCalledWith('id');
    expect(mockBuildDossier).toHaveBeenCalledTimes(2);
    expect(mockBuildDossier).toHaveBeenNthCalledWith(1, 'P1');
    expect(mockBuildDossier).toHaveBeenNthCalledWith(2, 'P2');
  });

  it('laat een mislukt project de batch niet stoppen', async () => {
    mockHasSupabaseConfig.mockReturnValue(true);

    const select = jest.fn().mockResolvedValue({
      data: [{ id: 'A' }, { id: 'B' }],
      error: null,
    });
    mockCreateClient.mockReturnValue({ from: jest.fn(() => ({ select })) });

    mockBuildDossier
      .mockResolvedValueOnce({ ok: false, reason: 'Adobe down' })
      .mockResolvedValueOnce({ ok: true });

    await loadJob().runDossierRefreshJob();
    expect(mockBuildDossier).toHaveBeenCalledTimes(2);
    expect(mockBuildDossier).toHaveBeenNthCalledWith(2, 'B');
  });
});
