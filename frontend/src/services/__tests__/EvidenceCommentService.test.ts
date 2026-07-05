/**
 * Unit-tests voor EvidenceCommentService — opmerkingen per bewijsstuk (WV-feedback
 * op afgekeurde foto's, reactie van de vakman).
 *
 * We mocken de Supabase-client (chainbare thenable builder + single + auth) en
 * borgen:
 *   - rowToComment-mapping incl. role-default 'WV' en null-defaults;
 *   - getComments/getProjectComments filteren op evidence_id resp. project_id en
 *     geven [] bij een fout;
 *   - addComment trimt de body, zet author_name = authorName ?? user.email,
 *     role-default 'WV', en geeft null bij een fout;
 *   - deleteComment geeft true/false op basis van de fout;
 *   - buildCommentCountMap telt opmerkingen per evidence_id (pure helper).
 */

let mockResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockSingle: { data: unknown; error: unknown } = { data: null, error: null };
const calls: Record<string, any> = {};

const builder: any = {
  select: (...a: unknown[]) => { calls.select = a; return builder; },
  insert: (p: unknown) => { calls.insert = p; return builder; },
  delete: () => { calls.delete = true; return builder; },
  eq: (...a: unknown[]) => { (calls.eq ||= []).push(a); return builder; },
  order: (...a: unknown[]) => { (calls.order ||= []).push(a); return builder; },
  limit: (...a: unknown[]) => { (calls.limit ||= []).push(a); return builder; },
  single: () => Promise.resolve(mockSingle),
  then: (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej),
};

const mockGetUser = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ data: { user: { id: 'u1', email: 'wv@spee.nl' } } })
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => builder,
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  type EvidenceComment,
  getComments,
  getProjectComments,
  addComment,
  deleteComment,
  buildCommentCountMap,
} from '../EvidenceCommentService';

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

describe('getComments', () => {
  it('mapt rijen met role-default WV en filtert op evidence_id', async () => {
    mockResult = {
      data: [
        { id: 'c1', evidence_id: 'e1', project_id: 'p1', user_id: 'u9', author_name: 'WV Piet', role: 'WV', body: 'opnieuw maken', created_at: 'c' },
        { id: 'c2', evidence_id: 'e1', body: 'ok', created_at: 'd' }, // defaults
      ],
      error: null,
    };
    const res = await getComments('e1');
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ id: 'c1', evidenceId: 'e1', authorName: 'WV Piet', role: 'WV' });
    expect(res[1]).toMatchObject({ role: 'WV', projectId: null, authorName: null });
    expect(calls.eq[0]).toEqual(['evidence_id', 'e1']);
  });

  it('geeft een lege lijst bij een fout', async () => {
    mockResult = { data: null, error: { message: 'boom' } };
    await expect(getComments('e1')).resolves.toEqual([]);
  });
});

describe('getProjectComments', () => {
  it('filtert op project_id', async () => {
    mockResult = { data: [], error: null };
    await getProjectComments('p-7');
    expect(calls.eq[0]).toEqual(['project_id', 'p-7']);
  });
});

describe('addComment', () => {
  it('trimt de body en zet author_name op authorName of het e-mailadres', async () => {
    mockSingle = { data: { id: 'c9', evidence_id: 'e1', body: 'klaar', created_at: 'c' }, error: null };
    const res = await addComment({ evidenceId: 'e1', body: '  klaar  ' });
    expect(res?.id).toBe('c9');
    expect(calls.insert).toMatchObject({
      evidence_id: 'e1',
      user_id: 'u1',
      author_name: 'wv@spee.nl', // fallback naar user.email
      role: 'WV',
      body: 'klaar',            // getrimd
    });
  });

  it('respecteert een expliciete authorName en role', async () => {
    mockSingle = { data: { id: 'c10', evidence_id: 'e1', body: 'x', created_at: 'c' }, error: null };
    await addComment({ evidenceId: 'e1', body: 'x', authorName: 'Vakman Jan', role: 'VAKMAN' });
    expect(calls.insert).toMatchObject({ author_name: 'Vakman Jan', role: 'VAKMAN' });
  });

  it('geeft null bij een insert-fout', async () => {
    mockSingle = { data: null, error: { message: 'denied' } };
    await expect(addComment({ evidenceId: 'e1', body: 'x' })).resolves.toBeNull();
  });
});

describe('deleteComment', () => {
  it('geeft true zonder fout en false met fout', async () => {
    mockResult = { data: null, error: null };
    await expect(deleteComment('c1')).resolves.toBe(true);
    mockResult = { data: null, error: { message: 'rls' } };
    await expect(deleteComment('c1')).resolves.toBe(false);
  });
});

describe('buildCommentCountMap', () => {
  it('telt opmerkingen per evidence_id', () => {
    const mk = (evidenceId: string): EvidenceComment => ({
      id: Math.random().toString(), evidenceId, projectId: null, userId: null,
      authorName: null, role: 'WV', body: 'x', createdAt: 'c',
    });
    const map = buildCommentCountMap([mk('e1'), mk('e1'), mk('e2')]);
    expect(map.get('e1')).toBe(2);
    expect(map.get('e2')).toBe(1);
    expect(map.get('e3')).toBeUndefined();
  });
});
