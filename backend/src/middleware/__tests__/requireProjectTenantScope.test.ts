/**
 * Tests voor requireProjectTenantScope (middleware/requireProjectTenantScope.ts).
 *
 * Dit hek dwingt af dat een ingelogde gebruiker alleen kan schrijven naar
 * projecten binnen zijn eigen tenant (audit 17 jul '26: daarvoor kon elke
 * ingelogde gebruiker bewijs uploaden of KiK-syncs doen voor élk project_id).
 * Een fout hier betekent óf een tenant-lek (bewijs van klant A in dossier van
 * klant B) óf een gebroken upload-flow voor legitieme vakmensen — beide fataal.
 *
 * We borgen het contract:
 *  - 401 zonder user; dev-bypass-user slaat de check over (lokale dev);
 *  - 400 zonder projectId (params, body én evidenceData-JSON worden gelezen);
 *  - 404 bij onbekend project of ongeldig id-formaat (22P02) — zelfde melding,
 *    geen bestaan-lek;
 *  - 403 bij tenant-mismatch, óók als één van de twee tenant-loos is;
 *  - next() + req.projectTenantScope bij match, en bij de legacy-uitzondering
 *    (beide tenant-loos, pre-tenant-installatie);
 *  - 500 bij databasefouten.
 *
 * Geen supertest: middleware direct aangeroepen met mock req/res/next;
 * supabaseAdmin gemockt.
 */

import type { Response } from 'express';

const mockProfileMaybeSingle = jest.fn();
const mockProjectMaybeSingle = jest.fn();

const mockFrom = jest.fn((table: string) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      maybeSingle:
        table === 'profiles' ? mockProfileMaybeSingle : mockProjectMaybeSingle,
    })),
  })),
}));

jest.mock('../../services/supabaseAdmin', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

const {
  requireProjectTenantScope,
  extractProjectId,
} = require('../requireProjectTenantScope');

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as Response & { status: jest.Mock; json: jest.Mock };
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1' },
  params: {},
  body: {},
  ...overrides,
});

const profielMetTenant = (tenantId: string | null) =>
  mockProfileMaybeSingle.mockResolvedValue({
    data: { tenant_id: tenantId },
    error: null,
  });

const projectMetTenant = (tenantId: string | null) =>
  mockProjectMaybeSingle.mockResolvedValue({
    data: { id: 'P-1', tenant_id: tenantId },
    error: null,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('extractProjectId — projectId uit params, body of evidenceData', () => {
  it('leest de route-param', () => {
    expect(extractProjectId(makeReq({ params: { projectId: ' P-1 ' } }))).toBe('P-1');
  });

  it('leest body.projectId en body.project_id', () => {
    expect(extractProjectId(makeReq({ body: { projectId: 'P-2' } }))).toBe('P-2');
    expect(extractProjectId(makeReq({ body: { project_id: 'P-3' } }))).toBe('P-3');
  });

  it('leest projectId uit een evidenceData-JSON-string (multipart-upload)', () => {
    const req = makeReq({
      body: { evidenceData: JSON.stringify({ project_id: 'P-4' }) },
    });
    expect(extractProjectId(req)).toBe('P-4');
  });

  it('geeft leeg terug bij kapotte JSON — de handler geeft daar zijn eigen 400 op', () => {
    expect(extractProjectId(makeReq({ body: { evidenceData: '{niet-json' } }))).toBe('');
  });
});

describe('requireProjectTenantScope — auth-randen', () => {
  it('weigert met 401 zonder user', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(makeReq({ user: undefined }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('laat de dev-bypass-user door zonder databasecontrole', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ user: { id: 'dev-bypass-user' } }),
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('weigert met 400 zonder projectId', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireProjectTenantScope — project-bestaan', () => {
  it('weigert met 404 als het project niet bestaat', async () => {
    profielMetTenant('tenant-a');
    mockProjectMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'P-onbekend' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toMatch(/niet gevonden of geen toegang/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('mapt een ongeldig id-formaat (22P02) op 404, niet op 500', async () => {
    profielMetTenant('tenant-a');
    mockProjectMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '22P02', message: 'invalid input syntax for type uuid' },
    });

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'geen-uuid' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireProjectTenantScope — tenant-grens', () => {
  it('weigert met 403 bij tenant-mismatch', async () => {
    profielMetTenant('tenant-a');
    projectMetTenant('tenant-b');

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'P-1' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('weigert met 403 als de gebruiker tenant-loos is maar het project niet', async () => {
    profielMetTenant(null);
    projectMetTenant('tenant-b');

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'P-1' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('laat door bij tenant-match en zet req.projectTenantScope', async () => {
    profielMetTenant('tenant-a');
    projectMetTenant('tenant-a');

    const req: any = makeReq({ params: { projectId: 'P-1' } });
    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.projectTenantScope).toEqual({ projectId: 'P-1', tenantId: 'tenant-a' });
  });

  it('laat de legacy-uitzondering door: user én project beide tenant-loos', async () => {
    profielMetTenant(null);
    projectMetTenant(null);

    const req: any = makeReq({ params: { projectId: 'P-1' } });
    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.projectTenantScope).toEqual({ projectId: 'P-1', tenantId: null });
  });
});

describe('requireProjectTenantScope — databasefouten', () => {
  it('mapt een profielfout op 500', async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db stuk' },
    });

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'P-1' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('mapt een niet-22P02-projectfout op 500', async () => {
    profielMetTenant('tenant-a');
    mockProjectMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '57014', message: 'timeout' },
    });

    const res = mockRes();
    const next = jest.fn();
    await requireProjectTenantScope(
      makeReq({ params: { projectId: 'P-1' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
