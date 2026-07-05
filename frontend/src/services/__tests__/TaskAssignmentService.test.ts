/**
 * Unit-tests voor TaskAssignmentService — borgingspunten toewijzen aan vakmannen
 * (CRUD op de task_assignments-tabel via Supabase).
 *
 * We mocken de Supabase-client met een chainbare, thenable query-builder en
 * borgen:
 *   - rowToAssignment-mapping incl. defaults (priority NORMAAL, status OPEN) en
 *     de display_name uit de gejoinde profiles-relatie;
 *   - lege lijst bij een query-fout;
 *   - createTaskAssignment: payload met assigned_by uit de auth-user + defaults,
 *     en null bij een fout;
 *   - updateTaskAssignment: alleen expliciet meegegeven velden in de payload
 *     (assignedTo → assigned_to), en true/false op basis van de fout;
 *   - deleteTaskAssignment: true/false op basis van de fout.
 */

let mockResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockSingle: { data: unknown; error: unknown } = { data: null, error: null };
const calls: Record<string, any> = {};

const builder: any = {
  select: (...a: unknown[]) => { calls.select = a; return builder; },
  insert: (p: unknown) => { calls.insert = p; return builder; },
  update: (p: unknown) => { calls.update = p; return builder; },
  delete: () => { calls.delete = true; return builder; },
  eq: (...a: unknown[]) => { (calls.eq ||= []).push(a); return builder; },
  neq: (...a: unknown[]) => { (calls.neq ||= []).push(a); return builder; },
  order: (...a: unknown[]) => { (calls.order ||= []).push(a); return builder; },
  single: () => Promise.resolve(mockSingle),
  then: (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej),
};

const mockGetUser = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ data: { user: { id: 'admin-1' } } })
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => builder,
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  getTaskAssignments,
  createTaskAssignment,
  updateTaskAssignment,
  deleteTaskAssignment,
} from '../TaskAssignmentService';

beforeEach(() => {
  jest.clearAllMocks();
  mockResult = { data: [], error: null };
  mockSingle = { data: null, error: null };
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getTaskAssignments', () => {
  it('mapt rijen met defaults en de display_name uit profiles', async () => {
    mockResult = {
      data: [
        {
          id: 't1', project_id: 'p1', inspection_point_id: 'A',
          assigned_to: 'u1', assigned_by: 'admin', profiles: { display_name: 'Jan' },
          priority: 'HOOG', deadline: '2026-02-01', notes: 'x', status: 'IN_PROGRESS',
          created_at: 'c', updated_at: 'u',
        },
        { id: 't2', project_id: 'p1', inspection_point_id: 'B', created_at: 'c', updated_at: 'u' },
      ],
      error: null,
    };

    const res = await getTaskAssignments('p1');
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      id: 't1', inspectionPointId: 'A', assignedToName: 'Jan',
      priority: 'HOOG', status: 'IN_PROGRESS',
    });
    // defaults voor een kale rij
    expect(res[1]).toMatchObject({ priority: 'NORMAAL', status: 'OPEN', assignedToName: null });
  });

  it('geeft een lege lijst bij een query-fout', async () => {
    mockResult = { data: null, error: { message: 'boom' } };
    await expect(getTaskAssignments('p1')).resolves.toEqual([]);
  });
});

describe('createTaskAssignment', () => {
  it('zet assigned_by uit de auth-user en defaults in de payload', async () => {
    mockSingle = {
      data: {
        id: 't9', project_id: 'p1', inspection_point_id: 'A',
        priority: 'NORMAAL', status: 'OPEN', created_at: 'c', updated_at: 'u',
      },
      error: null,
    };

    const res = await createTaskAssignment({ projectId: 'p1', inspectionPointId: 'A' });
    expect(res?.id).toBe('t9');
    expect(calls.insert).toMatchObject({
      project_id: 'p1',
      inspection_point_id: 'A',
      assigned_by: 'admin-1',
      priority: 'NORMAAL',
      status: 'OPEN',
    });
  });

  it('geeft null bij een insert-fout', async () => {
    mockSingle = { data: null, error: { message: 'denied' } };
    await expect(
      createTaskAssignment({ projectId: 'p1', inspectionPointId: 'A' })
    ).resolves.toBeNull();
  });
});

describe('updateTaskAssignment', () => {
  it('neemt alleen expliciet meegegeven velden mee (assignedTo → assigned_to)', async () => {
    mockResult = { data: null, error: null };
    const ok = await updateTaskAssignment('t1', { status: 'DONE', assignedTo: 'u2' });
    expect(ok).toBe(true);
    expect(calls.update).toEqual({ status: 'DONE', assigned_to: 'u2' });
    expect(calls.update).not.toHaveProperty('priority');
  });

  it('geeft false bij een update-fout', async () => {
    mockResult = { data: null, error: { message: 'nope' } };
    await expect(updateTaskAssignment('t1', { notes: 'x' })).resolves.toBe(false);
  });
});

describe('deleteTaskAssignment', () => {
  it('geeft true zonder fout en false met fout', async () => {
    mockResult = { data: null, error: null };
    await expect(deleteTaskAssignment('t1')).resolves.toBe(true);

    mockResult = { data: null, error: { message: 'fk' } };
    await expect(deleteTaskAssignment('t1')).resolves.toBe(false);
  });
});
