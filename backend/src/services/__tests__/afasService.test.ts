/**
 * Unit-tests voor afasService — de tenant-aware AFAS-Profit-koppeling (projecten
 * ophalen + uren boeken per aannemer).
 *
 * Borgt:
 *   - createAfasClient: juiste base-URL per environment, AfasToken-auth
 *     (base64) en timeout uit config;
 *   - fetchAfasProjects: veld-fallbacks (ProjectId/Project, Description/
 *     Omschrijving) met veilige defaults, lege lijst bij ontbrekende rows,
 *     expliciete env/token boven config, en een generieke sync-fout;
 *   - bookAfasHours: payload + true bij 200/201, en fail-safe false bij een
 *     niet-2xx-status of een fout (uren-boeken mag de flow niet breken).
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockCreate = jest.fn((..._a: unknown[]) => ({
  get: (..._a: unknown[]) => mockGet(..._a),
  post: (..._a: unknown[]) => mockPost(..._a),
}));
jest.mock('axios', () => ({ create: (..._a: unknown[]) => mockCreate(..._a) }));

const mockConfig: {
  afasEnvironmentId: string;
  afasToken: string;
  afasTimeoutMs: number;
} = { afasEnvironmentId: 'env-default', afasToken: 'tok-default', afasTimeoutMs: 9000 };
jest.mock('../../config', () => ({ backendConfig: mockConfig }));

const { createAfasClient, fetchAfasProjects, bookAfasHours } = require('../afasService');

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.afasEnvironmentId = 'env-default';
  mockConfig.afasToken = 'tok-default';
  mockConfig.afasTimeoutMs = 9000;
  mockGet.mockResolvedValue({ data: { rows: [] } });
  mockPost.mockResolvedValue({ status: 201 });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createAfasClient', () => {
  it('bouwt base-URL, AfasToken-auth (base64) en timeout', () => {
    createAfasClient('env123', 'geheim');
    const cfg = mockCreate.mock.calls[0]![0] as any;
    expect(cfg.baseURL).toBe('https://env123.restapi.afas.online/profitrestservices/v1');
    expect(cfg.headers.Authorization).toBe(`AfasToken ${Buffer.from('geheim').toString('base64')}`);
    expect(cfg.timeout).toBe(9000);
  });
});

describe('fetchAfasProjects', () => {
  it('mapt rijen met de primaire velden en roept de juiste endpoint aan', async () => {
    mockGet.mockResolvedValue({ data: { rows: [{ ProjectId: 'P1', Description: 'D1' }] } });
    const res = await fetchAfasProjects('e', 't');
    expect(res).toEqual([{ projectId: 'P1', description: 'D1' }]);
    expect(mockGet).toHaveBeenCalledWith('/get/Wkb_Projecten', { params: { skip: 0, take: 100 } });
  });

  it('valt terug op Project/Omschrijving en veilige defaults', async () => {
    mockGet.mockResolvedValue({ data: { rows: [{ Project: 'P2', Omschrijving: 'O2' }, {}] } });
    const res = await fetchAfasProjects('e', 't');
    expect(res).toEqual([
      { projectId: 'P2', description: 'O2' },
      { projectId: 'onbekend-project', description: 'Zonder omschrijving' },
    ]);
  });

  it('geeft een lege lijst bij ontbrekende rows', async () => {
    mockGet.mockResolvedValue({ data: {} });
    await expect(fetchAfasProjects('e', 't')).resolves.toEqual([]);
  });

  it('gebruikt expliciete env/token boven config', async () => {
    mockConfig.afasEnvironmentId = '';
    mockConfig.afasToken = '';
    await fetchAfasProjects('myenv', 'mytok');
    expect((mockCreate.mock.calls[0]![0] as any).baseURL).toContain('myenv');
  });

  it('gooit een generieke sync-fout zonder config', async () => {
    mockConfig.afasEnvironmentId = '';
    mockConfig.afasToken = '';
    await expect(fetchAfasProjects()).rejects.toThrow(/Kon projecten niet synchroniseren/);
  });

  it('gooit een generieke sync-fout bij een AFAS-fout', async () => {
    mockGet.mockRejectedValue(new Error('502 bad gateway'));
    await expect(fetchAfasProjects('e', 't')).rejects.toThrow(/Kon projecten niet synchroniseren/);
  });
});

describe('bookAfasHours', () => {
  it('boekt uren en geeft true bij 201, met de juiste payload', async () => {
    mockPost.mockResolvedValue({ status: 201 });
    const ok = await bookAfasHours('e', 't', 'P-1', 'EMP-9', 8, '2026-01-15');
    expect(ok).toBe(true);
    const [url, payload] = mockPost.mock.calls[0]! as any[];
    expect(url).toBe('/connectors/PtRealization');
    expect(payload.PtRealization.Element.Fields).toMatchObject({
      Project: 'P-1',
      Employee: 'EMP-9',
      Hours: 8,
      Date: '2026-01-15',
    });
  });

  it('geeft false bij een niet-2xx-status', async () => {
    mockPost.mockResolvedValue({ status: 500 });
    await expect(bookAfasHours('e', 't', 'P', 'E', 1, 'd')).resolves.toBe(false);
  });

  it('geeft fail-safe false bij een fout (breekt de flow niet)', async () => {
    mockPost.mockRejectedValue(new Error('timeout'));
    await expect(bookAfasHours('e', 't', 'P', 'E', 1, 'd')).resolves.toBe(false);
  });
});
