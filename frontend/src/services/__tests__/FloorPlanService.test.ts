/**
 * Unit-tests voor FloorPlanService — upload/ophalen/verwijderen van
 * bouwtekeningen (Supabase Storage `floor-plans` + tabel `floor_plans`).
 *
 * We mocken de Supabase-client (storage-upload + chainbare thenable builder)
 * en storageUrl (pad → signed URL), en borgen:
 *   - uploadFloorPlan: leidt fileType af uit de extensie (pdf→PDF, anders PNG),
 *     bewaart het PAD als file_url, mapt de rij + tekent een signed URL; geeft
 *     null bij een upload- of insert-fout (en inserteert niet na upload-fout);
 *   - getFloorPlansForProject: filtert op project_id, sorteert nieuwste eerst,
 *     batcht signed URLs en geeft [] terug bij een fout;
 *   - deleteFloorPlan: verwijdert de rij op id.
 */

let mockUpload: { error: unknown } = { error: null };
let mockInsertSingle: { data: unknown; error: unknown } = { data: null, error: null };
let mockListResult: { data: unknown; error: unknown } = { data: [], error: null };
const calls: Record<string, any> = {};

const mockBuilder: any = {
  insert: (p: unknown) => {
    calls.insert = p;
    return mockBuilder;
  },
  select: (...a: unknown[]) => {
    calls.select = a;
    return mockBuilder;
  },
  single: () => Promise.resolve(mockInsertSingle),
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return mockBuilder;
  },
  order: (...a: unknown[]) => {
    calls.order = a;
    return mockBuilder;
  },
  delete: () => {
    calls.delete = true;
    return mockBuilder;
  },
  then: (res: any, rej: any) => Promise.resolve(mockListResult).then(res, rej),
};

const mockStorageBuilder: any = {
  upload: (...a: unknown[]) => {
    calls.upload = a;
    return Promise.resolve(mockUpload);
  },
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      calls.from = a;
      return mockBuilder;
    },
    storage: {
      from: (...a: unknown[]) => {
        calls.storageFrom = a;
        return mockStorageBuilder;
      },
    },
  },
}));

jest.mock('../../lib/storageUrl', () => ({
  resolveStorageUrl: (..._a: unknown[]) => Promise.resolve('signed://one'),
  resolveStorageUrls: (_b: unknown, paths: string[]) =>
    Promise.resolve(paths.map((p) => `signed://${p}`)),
}));

import {
  uploadFloorPlan,
  getFloorPlansForProject,
  deleteFloorPlan,
} from '../FloorPlanService';

const fakeFile = (name: string, type: string): File =>
  ({ name, type } as unknown as File);

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload = { error: null };
  mockInsertSingle = { data: null, error: null };
  mockListResult = { data: [], error: null };
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('uploadFloorPlan', () => {
  it('leidt PDF af, bewaart het pad en mapt de rij met signed URL', async () => {
    mockInsertSingle = {
      data: {
        id: 'fp1',
        project_id: 'p-1',
        name: 'Begane grond',
        file_url: 'p-1/123_plan.PDF',
        file_type: 'PDF',
        created_at: '2026-01-15T09:30:00Z',
      },
      error: null,
    };
    const res = await uploadFloorPlan('p-1', fakeFile('plan.PDF', 'application/pdf'), 'Begane grond');

    expect(calls.storageFrom).toEqual(['floor-plans']);
    expect(calls.insert).toMatchObject({
      project_id: 'p-1',
      name: 'Begane grond',
      file_type: 'PDF',
    });
    // file_url is een PAD onder het project, niet een publieke URL
    expect((calls.insert as any).file_url).toMatch(/^p-1\//);
    expect(res).toMatchObject({ id: 'fp1', fileType: 'PDF', fileUrl: 'signed://one' });
  });

  it('leidt PNG af bij een niet-pdf-extensie', async () => {
    mockInsertSingle = {
      data: { id: 'fp2', project_id: 'p-1', name: 'x', file_url: 'p-1/x.png', file_type: 'PNG', created_at: 't' },
      error: null,
    };
    await uploadFloorPlan('p-1', fakeFile('x.png', 'image/png'), 'x');
    expect((calls.insert as any).file_type).toBe('PNG');
  });

  it('geeft null bij een upload-fout en inserteert niet', async () => {
    mockUpload = { error: { message: 'bestaat al' } };
    const res = await uploadFloorPlan('p-1', fakeFile('x.png', 'image/png'), 'x');
    expect(res).toBeNull();
    expect(calls.insert).toBeUndefined();
  });

  it('geeft null bij een insert-fout', async () => {
    mockInsertSingle = { data: null, error: { message: 'rls' } };
    const res = await uploadFloorPlan('p-1', fakeFile('x.png', 'image/png'), 'x');
    expect(res).toBeNull();
  });
});

describe('getFloorPlansForProject', () => {
  it('filtert op project_id, sorteert desc en tekent signed URLs', async () => {
    mockListResult = {
      data: [
        { id: 'a', project_id: 'p-1', name: 'A', file_url: 'p-1/a.png', file_type: 'PNG', created_at: 't1' },
        { id: 'b', project_id: 'p-1', name: 'B', file_url: 'p-1/b.pdf', file_type: 'PDF', created_at: 't2' },
      ],
      error: null,
    };
    const list = await getFloorPlansForProject('p-1');
    expect(calls.eq[0]).toEqual(['project_id', 'p-1']);
    expect(calls.order).toEqual(['created_at', { ascending: false }]);
    expect(list).toHaveLength(2);
    expect(list[0].fileUrl).toBe('signed://p-1/a.png');
    expect(list[1].fileType).toBe('PDF');
  });

  it('geeft [] terug bij een fout', async () => {
    mockListResult = { data: null, error: { message: 'down' } };
    await expect(getFloorPlansForProject('p-1')).resolves.toEqual([]);
  });
});

describe('deleteFloorPlan', () => {
  it('verwijdert de rij op id', async () => {
    await deleteFloorPlan('fp1');
    expect(calls.from).toEqual(['floor_plans']);
    expect(calls.delete).toBe(true);
    expect(calls.eq[0]).toEqual(['id', 'fp1']);
  });
});
