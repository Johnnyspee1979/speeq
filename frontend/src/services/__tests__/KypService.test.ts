/**
 * Unit-tests voor KypService.
 * Mockt global.fetch (KYP-REST) en de supabase-client (tenant-DB).
 */

// ── supabase-mock ────────────────────────────────────────────────────────────
const fromMock = jest.fn();
const getUserMock = jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import {
  computeMilestoneStatus,
  getKypConfig,
  pingApi,
  getProjects,
  getProjectMilestones,
  getProjectMapping,
  syncProjectPlanning,
  getCachedPlanning,
  saveKypConfig,
  saveProjectMapping,
  buildWritebackPayload,
  mapAction,
  pushStatus,
  getWritebackLog,
} from '../KypService';

// Helper: bouw een fetch-Response-achtig object.
function mockFetchResponse(
  status: number,
  body: unknown,
): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── computeMilestoneStatus ───────────────────────────────────────────────────
describe('computeMilestoneStatus', () => {
  const today = new Date('2026-06-10');

  it('afgerond zodra dateFinished gevuld is — ongeacht de einddatum', () => {
    expect(
      computeMilestoneStatus(
        { endDate: '2026-01-01', dateFinished: '2026-01-05' },
        today,
      ),
    ).toBe('afgerond');
  });

  it('te_laat als endDate in het verleden ligt en niet afgerond', () => {
    expect(
      computeMilestoneStatus({ endDate: '2026-06-09', dateFinished: null }, today),
    ).toBe('te_laat');
  });

  it('gepland als endDate vandaag of in de toekomst is', () => {
    expect(
      computeMilestoneStatus({ endDate: '2026-06-10', dateFinished: null }, today),
    ).toBe('gepland');
    expect(
      computeMilestoneStatus({ endDate: '2026-12-31', dateFinished: null }, today),
    ).toBe('gepland');
  });

  it('gepland als er geen endDate is', () => {
    expect(
      computeMilestoneStatus({ endDate: undefined, dateFinished: null }, today),
    ).toBe('gepland');
  });

  it('negeert een onleesbare endDate (geen crash, valt terug op gepland)', () => {
    expect(
      computeMilestoneStatus({ endDate: 'geen-datum', dateFinished: null }, today),
    ).toBe('gepland');
  });
});

// ── getKypConfig ─────────────────────────────────────────────────────────────
describe('getKypConfig', () => {
  function setConfigQuery(result: { data: unknown; error: unknown }) {
    const maybeSingle = jest.fn().mockResolvedValue(result);
    const limit = jest.fn().mockReturnValue({ maybeSingle });
    const order = jest.fn().mockReturnValue({ limit });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });
    return { select, eq, order, limit, maybeSingle };
  }

  it('geeft token + base-url terug bij een actieve config', async () => {
    setConfigQuery({
      data: { kyp_token: 'tok-123', base_url: 'https://kyp.nl/rest', is_active: true },
      error: null,
    });
    const cfg = await getKypConfig();
    expect(cfg).toEqual({
      token: 'tok-123',
      baseUrl: 'https://kyp.nl/rest',
      isActive: true,
    });
  });

  it('valt terug op de default base-url als die leeg is', async () => {
    setConfigQuery({
      data: { kyp_token: 'tok-123', base_url: '', is_active: true },
      error: null,
    });
    const cfg = await getKypConfig();
    expect(cfg?.baseUrl).toBe('https://kyp.nl/rest');
  });

  it('geeft null als er geen token is', async () => {
    setConfigQuery({
      data: { kyp_token: null, base_url: 'https://kyp.nl/rest', is_active: true },
      error: null,
    });
    expect(await getKypConfig()).toBeNull();
  });

  it('geeft null bij een query-error', async () => {
    setConfigQuery({ data: null, error: { message: 'boom' } });
    expect(await getKypConfig()).toBeNull();
  });
});

// ── pingApi / getProjects ────────────────────────────────────────────────────
describe('pingApi', () => {
  it('telt de projecten bij een 200', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]),
    );
    const res = await pingApi('tok', 'https://kyp.nl/rest');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.projectCount).toBe(2);

    // Juiste URL + Bearer-header.
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kyp.nl/rest/projects');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('geeft een nette fout bij 401', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(401, { message: 'nope' }));
    const res = await pingApi('bad-tok');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/geweigerd/i);
  });

  it('vangt netwerkfouten op zonder te gooien', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await pingApi('tok');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/onbereikbaar/i);
  });

  it('strip een dubbele slash in de base-url', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(200, []));
    await getProjects('tok', 'https://kyp.nl/rest/');
    expect(fetchMock.mock.calls[0][0]).toBe('https://kyp.nl/rest/projects');
  });
});

// ── getProjectMilestones ─────────────────────────────────────────────────────
describe('getProjectMilestones', () => {
  const today = new Date('2026-06-10');

  it('slaat fases→activiteiten plat en bepaalt statussen', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, [
        {
          id: 10,
          name: 'Ruwbouw',
          activities: [
            { id: 100, name: 'Fundering', startDate: '2026-05-01', endDate: '2026-05-10', dateFinished: '2026-05-09', responsible: 'Jan' },
            { id: 101, name: 'Wapening', startDate: '2026-06-01', endDate: '2026-06-05', dateFinished: null, responsible: 'Piet' },
          ],
        },
        {
          id: 11,
          name: 'Afbouw',
          activities: [
            { id: 102, name: 'Stucwerk', startDate: '2026-07-01', endDate: '2026-07-10', dateFinished: null, responsible: 'Kees' },
          ],
        },
      ]),
    );

    const res = await getProjectMilestones('tok', 42, 'https://kyp.nl/rest', today);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data).toHaveLength(3);
    expect(res.data[0]).toMatchObject({ activityName: 'Fundering', phaseName: 'Ruwbouw', status: 'afgerond' });
    expect(res.data[1]).toMatchObject({ activityName: 'Wapening', status: 'te_laat' });
    expect(res.data[2]).toMatchObject({ activityName: 'Stucwerk', phaseName: 'Afbouw', status: 'gepland' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://kyp.nl/rest/projects/42/phases');
  });

  it('gaat goed om met fases zonder activiteiten', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, [{ id: 10, name: 'Leeg', activities: [] }, { id: 11, name: 'GeenVeld' }]),
    );
    const res = await getProjectMilestones('tok', 42, undefined, today);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toHaveLength(0);
  });

  it('propageert een API-fout', async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(500, {}));
    const res = await getProjectMilestones('tok', 42);
    expect(res.ok).toBe(false);
  });
});

// ── getProjectMapping ────────────────────────────────────────────────────────
describe('getProjectMapping', () => {
  function setMappingQuery(result: { data: unknown; error: unknown }) {
    const maybeSingle = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });
  }

  it('geeft de koppeling terug', async () => {
    setMappingQuery({
      data: { kyp_project_id: 42, kyp_project_name: 'Nieuwbouw X', writeback_enabled: true },
      error: null,
    });
    expect(await getProjectMapping('speeq-1')).toEqual({
      kypProjectId: 42,
      kypProjectName: 'Nieuwbouw X',
      writebackEnabled: true,
    });
  });

  it('writeback staat default uit als de kolom leeg is', async () => {
    setMappingQuery({ data: { kyp_project_id: 42, kyp_project_name: 'X' }, error: null });
    const m = await getProjectMapping('speeq-1');
    expect(m?.writebackEnabled).toBe(false);
  });

  it('geeft null als er geen koppeling is', async () => {
    setMappingQuery({ data: null, error: null });
    expect(await getProjectMapping('speeq-1')).toBeNull();
  });
});

// ── syncProjectPlanning ──────────────────────────────────────────────────────
describe('syncProjectPlanning', () => {
  // Bouwt een from()-mock die per tabel het juiste gedrag teruggeeft.
  function wireSupabase(opts: {
    config: unknown;
    mapping: unknown;
    deleteError?: unknown;
    insertError?: unknown;
    insertSpy?: jest.Mock;
  }) {
    const configMaybeSingle = jest.fn().mockResolvedValue({ data: opts.config, error: null });
    const mappingMaybeSingle = jest.fn().mockResolvedValue({ data: opts.mapping, error: null });
    const insertSpy = opts.insertSpy ?? jest.fn().mockResolvedValue({ error: opts.insertError ?? null });
    const deleteEq = jest.fn().mockResolvedValue({ error: opts.deleteError ?? null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'kyp_integration_config') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: configMaybeSingle }) }) }),
          }),
        };
      }
      if (table === 'kyp_project_mapping') {
        return { select: () => ({ eq: () => ({ maybeSingle: mappingMaybeSingle }) }) };
      }
      if (table === 'kyp_planning_cache') {
        return {
          delete: () => ({ eq: deleteEq }),
          insert: insertSpy,
        };
      }
      return {};
    });
    return { insertSpy, deleteEq };
  }

  it('fout als er geen actief token is', async () => {
    wireSupabase({ config: null, mapping: { kyp_project_id: 42 } });
    const res = await syncProjectPlanning('speeq-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/token/i);
  });

  it('fout als het project niet gekoppeld is', async () => {
    wireSupabase({
      config: { kyp_token: 'tok', base_url: 'https://kyp.nl/rest', is_active: true },
      mapping: null,
    });
    const res = await syncProjectPlanning('speeq-1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/gekoppeld/i);
  });

  it('haalt, berekent en schrijft de planning naar de cache', async () => {
    const { insertSpy, deleteEq } = wireSupabase({
      config: { kyp_token: 'tok', base_url: 'https://kyp.nl/rest', is_active: true },
      mapping: { kyp_project_id: 42, kyp_project_name: 'X' },
    });
    fetchMock.mockResolvedValue(
      mockFetchResponse(200, [
        {
          id: 10,
          name: 'Ruwbouw',
          activities: [
            { id: 100, name: 'Fundering', startDate: '2026-05-01', endDate: '2026-05-10', dateFinished: '2026-05-09' },
          ],
        },
      ]),
    );

    const res = await syncProjectPlanning('speeq-1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.count).toBe(1);

    // Cache eerst geleegd voor dit project, daarna inserted.
    expect(deleteEq).toHaveBeenCalledWith('speeq_project_id', 'speeq-1');
    const insertedRows = insertSpy.mock.calls[0][0];
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      speeq_project_id: 'speeq-1',
      kyp_project_id: 42,
      activity_name: 'Fundering',
      status: 'afgerond',
    });
  });

  it('insert wordt overgeslagen als er geen mijlpalen zijn', async () => {
    const { insertSpy } = wireSupabase({
      config: { kyp_token: 'tok', base_url: 'https://kyp.nl/rest', is_active: true },
      mapping: { kyp_project_id: 42 },
    });
    fetchMock.mockResolvedValue(mockFetchResponse(200, []));

    const res = await syncProjectPlanning('speeq-1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.count).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

// ── getCachedPlanning ────────────────────────────────────────────────────────
describe('getCachedPlanning', () => {
  function setCacheQuery(result: { data: unknown; error: unknown }) {
    const order = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });
  }

  it('mapt de rijen naar KypMilestone-objecten', async () => {
    setCacheQuery({
      data: [
        {
          kyp_project_id: 42,
          phase_name: 'Ruwbouw',
          activity_id: 100,
          activity_name: 'Fundering',
          start_date: '2026-05-01',
          end_date: '2026-05-10',
          date_finished: '2026-05-09',
          responsible: 'Jan',
          status: 'afgerond',
        },
      ],
      error: null,
    });

    const rows = await getCachedPlanning('speeq-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      kypProjectId: 42,
      phaseName: 'Ruwbouw',
      activityId: 100,
      activityName: 'Fundering',
      startDate: '2026-05-01',
      endDate: '2026-05-10',
      dateFinished: '2026-05-09',
      responsible: 'Jan',
      status: 'afgerond',
    });
  });

  it('geeft een lege array bij een error', async () => {
    setCacheQuery({ data: null, error: { message: 'boom' } });
    expect(await getCachedPlanning('speeq-1')).toEqual([]);
  });
});

// ── saveKypConfig ────────────────────────────────────────────────────────────
describe('saveKypConfig', () => {
  it('weigert een leeg token', async () => {
    const res = await saveKypConfig('   ');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/leeg/i);
  });

  it('insert wanneer er nog geen config bestaat', async () => {
    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const existingMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue({
      select: () => ({ order: () => ({ limit: () => ({ maybeSingle: existingMaybeSingle }) }) }),
      insert: insertSpy,
    });

    const res = await saveKypConfig('tok-xyz');
    expect(res.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toMatchObject({ kyp_token: 'tok-xyz', is_active: true });
  });

  it('update wanneer er al een config-rij is', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const updateSpy = jest.fn().mockReturnValue({ eq: updateEq });
    const existingMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'cfg-1' }, error: null });
    fromMock.mockReturnValue({
      select: () => ({ order: () => ({ limit: () => ({ maybeSingle: existingMaybeSingle }) }) }),
      update: updateSpy,
    });

    const res = await saveKypConfig('nieuw-token');
    expect(res.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith('id', 'cfg-1');
  });
});

// ── saveProjectMapping ───────────────────────────────────────────────────────
describe('saveProjectMapping', () => {
  it('upsert de koppeling met onConflict op speeq_project_id', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertSpy });

    const res = await saveProjectMapping('speeq-1', 42, 'Nieuwbouw X');
    expect(res.ok).toBe(true);
    expect(upsertSpy.mock.calls[0][0]).toMatchObject({
      speeq_project_id: 'speeq-1',
      kyp_project_id: 42,
      kyp_project_name: 'Nieuwbouw X',
    });
    expect(upsertSpy.mock.calls[0][1]).toEqual({ onConflict: 'speeq_project_id' });
  });

  it('geeft de DB-fout door', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: { message: 'rls denied' } });
    fromMock.mockReturnValue({ upsert: upsertSpy });

    const res = await saveProjectMapping('speeq-1', 42);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('rls denied');
  });
});

// ── V2: buildWritebackPayload ────────────────────────────────────────────────
describe('buildWritebackPayload', () => {
  const nu = new Date('2026-06-14T09:00:00.000Z');

  it('gereed_melden vult dateFinished met de tijd', () => {
    expect(buildWritebackPayload('gereed_melden', nu)).toEqual({
      dateFinished: '2026-06-14T09:00:00.000Z',
    });
  });

  it('heropenen zet dateFinished op null', () => {
    expect(buildWritebackPayload('heropenen', nu)).toEqual({ dateFinished: null });
  });

  it('schrijft uitsluitend het statusveld (geen planning/documenten)', () => {
    expect(Object.keys(buildWritebackPayload('gereed_melden', nu))).toEqual(['dateFinished']);
  });
});

// ── V2: mapAction ────────────────────────────────────────────────────────────
describe('mapAction', () => {
  it('upsert de statusmapping met onConflict op project+controlepunt', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertSpy });

    const res = await mapAction({
      speeqProjectId: 'speeq-1',
      speeqControlepuntId: 'cp-7',
      kypProjectId: 42,
      kypActivityId: 101,
    });
    expect(res.ok).toBe(true);
    expect(upsertSpy.mock.calls[0][0]).toMatchObject({
      speeq_project_id: 'speeq-1',
      speeq_controlepunt_id: 'cp-7',
      kyp_project_id: 42,
      kyp_activity_id: 101,
    });
    expect(upsertSpy.mock.calls[0][1]).toEqual({
      onConflict: 'speeq_project_id,speeq_controlepunt_id',
    });
  });
});

// ── V2: pushStatus ───────────────────────────────────────────────────────────
describe('pushStatus', () => {
  // Wire config + mapping + statusmapping + writeback-log per tabel.
  function wire(opts: {
    config: unknown;
    mapping: unknown;
    statusMap: unknown;
    logInsertSpy?: jest.Mock;
  }) {
    const configMaybeSingle = jest.fn().mockResolvedValue({ data: opts.config, error: null });
    const mappingMaybeSingle = jest.fn().mockResolvedValue({ data: opts.mapping, error: null });
    const statusMaybeSingle = jest.fn().mockResolvedValue({ data: opts.statusMap, error: null });
    const logInsertSpy = opts.logInsertSpy ?? jest.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'kyp_integration_config') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: configMaybeSingle }) }) }),
          }),
        };
      }
      if (table === 'kyp_project_mapping') {
        return { select: () => ({ eq: () => ({ maybeSingle: mappingMaybeSingle }) }) };
      }
      if (table === 'kyp_status_mapping') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: statusMaybeSingle }) }) }) };
      }
      if (table === 'kyp_writeback_log') {
        return { insert: logInsertSpy };
      }
      return {};
    });
    return { logInsertSpy };
  }

  const activeConfig = { kyp_token: 'tok', base_url: 'https://kyp.nl/rest', is_active: true };

  it('weigert zonder actief token', async () => {
    wire({ config: null, mapping: null, statusMap: null });
    const res = await pushStatus({ speeqProjectId: 'p1', speeqControlepuntId: 'cp1', actie: 'gereed_melden' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/token/i);
  });

  it('weigert als write-back uit staat (opt-in)', async () => {
    wire({
      config: activeConfig,
      mapping: { kyp_project_id: 42, writeback_enabled: false },
      statusMap: { kyp_project_id: 42, kyp_activity_id: 101 },
    });
    const res = await pushStatus({ speeqProjectId: 'p1', speeqControlepuntId: 'cp1', actie: 'gereed_melden' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/staat uit/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('weigert als het controlepunt geen KYP-actie heeft', async () => {
    wire({
      config: activeConfig,
      mapping: { kyp_project_id: 42, writeback_enabled: true },
      statusMap: null,
    });
    const res = await pushStatus({ speeqProjectId: 'p1', speeqControlepuntId: 'cp1', actie: 'gereed_melden' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/geen kyp-actie/i);
  });

  it('PUT naar de juiste activiteit + log "gelukt" bij 200', async () => {
    const { logInsertSpy } = wire({
      config: activeConfig,
      mapping: { kyp_project_id: 42, writeback_enabled: true },
      statusMap: { kyp_project_id: 42, kyp_activity_id: 101 },
    });
    fetchMock.mockResolvedValue(mockFetchResponse(200, { id: 101 }));

    const res = await pushStatus({
      speeqProjectId: 'p1',
      speeqControlepuntId: 'cp1',
      actie: 'gereed_melden',
      nu: new Date('2026-06-14T09:00:00.000Z'),
    });
    expect(res.ok).toBe(true);

    const [url, optsArg] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kyp.nl/rest/projects/42/activities/101');
    expect(optsArg.method).toBe('PUT');
    expect(JSON.parse(optsArg.body)).toEqual({ dateFinished: '2026-06-14T09:00:00.000Z' });

    expect(logInsertSpy).toHaveBeenCalledTimes(1);
    expect(logInsertSpy.mock.calls[0][0]).toMatchObject({ status: 'gelukt', http_status: 200 });
  });

  it('log "mislukt" en blokkeert de workflow niet bij een fout', async () => {
    const { logInsertSpy } = wire({
      config: activeConfig,
      mapping: { kyp_project_id: 42, writeback_enabled: true },
      statusMap: { kyp_project_id: 42, kyp_activity_id: 101 },
    });
    fetchMock.mockResolvedValue(mockFetchResponse(500, {}));

    const res = await pushStatus({ speeqProjectId: 'p1', speeqControlepuntId: 'cp1', actie: 'gereed_melden' });
    expect(res.ok).toBe(false);
    expect(logInsertSpy.mock.calls[0][0]).toMatchObject({ status: 'mislukt' });
  });
});

// ── V2: getWritebackLog ──────────────────────────────────────────────────────
describe('getWritebackLog', () => {
  function setLogQuery(result: { data: unknown; error: unknown }) {
    const order = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });
  }

  it('mapt de logrijen', async () => {
    setLogQuery({
      data: [
        {
          speeq_controlepunt_id: 'cp1',
          kyp_activity_id: 101,
          actie: 'gereed_melden',
          status: 'gelukt',
          http_status: 200,
          foutmelding: null,
          uitgevoerd_at: '2026-06-14T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const rows = await getWritebackLog('p1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kypActivityId: 101, status: 'gelukt', httpStatus: 200 });
  });

  it('lege array bij error', async () => {
    setLogQuery({ data: null, error: { message: 'boom' } });
    expect(await getWritebackLog('p1')).toEqual([]);
  });
});
