/**
 * Unit-tests voor ProjectService — CRUD op de `projects`-tabel via Supabase.
 *
 * We mocken de Supabase-client (chainbare thenable query-builder) en
 * getActiveTenantId, en borgen:
 *   - rowToProject-mapping incl. snake_case → camelCase, naam-fallback
 *     (name → project_id → 'Naamloos project') en status-default 'ACTIEF';
 *   - getProjects filtert op tenant_id wanneer er een actieve tenant is, en
 *     geeft een lege lijst bij een query-fout;
 *   - createProject zet een PRJ-<ts> project_id, owner_id uit de auth-user en
 *     status ACTIEF; null bij een insert-fout;
 *   - updateProject neemt alleen expliciet meegegeven velden mee
 *     (initiatorName → initiator_name, kadastrale → kadastrale_aanduiding) en
 *     geeft true/false op basis van de fout.
 */

let mockResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockSingle: { data: unknown; error: unknown } = { data: null, error: null };
const calls: Record<string, any> = {};

const builder: any = {
  select: (...a: unknown[]) => { calls.select = a; return builder; },
  insert: (p: unknown) => { calls.insert = p; return builder; },
  update: (p: unknown) => { calls.update = p; return builder; },
  eq: (...a: unknown[]) => { (calls.eq ||= []).push(a); return builder; },
  order: (...a: unknown[]) => { (calls.order ||= []).push(a); return builder; },
  limit: (...a: unknown[]) => { (calls.limit ||= []).push(a); return builder; },
  single: () => Promise.resolve(mockSingle),
  then: (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej),
};

const mockGetUser = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ data: { user: { id: 'owner-9' } } })
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => builder,
    auth: { getUser: () => mockGetUser() },
  },
}));

const mockGetActiveTenantId = jest.fn<string | null, []>(() => 't-1');
jest.mock('../../config/tenant', () => ({
  getActiveTenantId: () => mockGetActiveTenantId(),
}));

import {
  getProjects,
  getProject,
  createProject,
  updateProject,
} from '../ProjectService';

beforeEach(() => {
  jest.clearAllMocks();
  mockResult = { data: [], error: null };
  mockSingle = { data: null, error: null };
  mockGetActiveTenantId.mockReturnValue('t-1');
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getProjects', () => {
  it('mapt rijen en filtert op tenant_id wanneer er een actieve tenant is', async () => {
    mockResult = {
      data: [
        {
          id: 'p1', name: 'Woning Spee', address: 'Straat 1', initiator_name: 'Bouw BV',
          kadastrale_aanduiding: 'ABC123', latitude: 52.1, longitude: 4.3,
          owner_id: 'o1', created_at: 'c', status: 'OPGELEVERD',
        },
        { id: 'p2', project_id: 'PRJ-2' }, // kale rij → fallbacks
      ],
      error: null,
    };
    const res = await getProjects();
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      id: 'p1', name: 'Woning Spee', address: 'Straat 1', initiatorName: 'Bouw BV',
      kadastrale: 'ABC123', latitude: 52.1, status: 'OPGELEVERD',
    });
    // fallback naam = project_id, status default ACTIEF
    expect(res[1]).toMatchObject({ name: 'PRJ-2', status: 'ACTIEF', address: null });
    expect(calls.eq[0]).toEqual(['tenant_id', 't-1']);
  });

  it('laat de tenant-filter weg zonder actieve tenant', async () => {
    mockGetActiveTenantId.mockReturnValue(null);
    mockResult = { data: [], error: null };
    await getProjects();
    expect(calls.eq).toBeUndefined();
  });

  it('geeft een lege lijst bij een query-fout', async () => {
    mockResult = { data: null, error: { message: 'boom' } };
    await expect(getProjects()).resolves.toEqual([]);
  });
});

describe('getProject', () => {
  it('mapt een enkele rij', async () => {
    mockSingle = { data: { id: 'p9', name: 'X' }, error: null };
    const res = await getProject('p9');
    expect(res).toMatchObject({ id: 'p9', name: 'X', status: 'ACTIEF' });
  });

  it('geeft null bij een fout', async () => {
    mockSingle = { data: null, error: { message: 'not found' } };
    await expect(getProject('p9')).resolves.toBeNull();
  });
});

describe('createProject', () => {
  it('zet een PRJ-id, owner_id uit de auth-user en status ACTIEF', async () => {
    mockSingle = { data: { id: 'p-new', name: 'Nieuw' }, error: null };
    const res = await createProject({ name: 'Nieuw', address: 'Laan 2' });
    expect(res?.id).toBe('p-new');
    expect(calls.insert).toMatchObject({
      name: 'Nieuw',
      address: 'Laan 2',
      owner_id: 'owner-9',
      status: 'ACTIEF',
    });
    expect(String(calls.insert.project_id)).toMatch(/^PRJ-\d+$/);
  });

  it('geeft null bij een insert-fout', async () => {
    mockSingle = { data: null, error: { message: 'denied' } };
    await expect(createProject({ name: 'Nieuw' })).resolves.toBeNull();
  });
});

describe('updateProject', () => {
  it('neemt alleen expliciet meegegeven velden mee', async () => {
    mockResult = { data: null, error: null };
    const ok = await updateProject('p1', { initiatorName: 'Aannemer X', status: 'GEPAUZEERD' });
    expect(ok).toBe(true);
    expect(calls.update).toEqual({ initiator_name: 'Aannemer X', status: 'GEPAUZEERD' });
    expect(calls.update).not.toHaveProperty('name');
  });

  it('geeft false bij een update-fout', async () => {
    mockResult = { data: null, error: { message: 'nope' } };
    await expect(updateProject('p1', { name: 'Y' })).resolves.toBe(false);
  });
});
