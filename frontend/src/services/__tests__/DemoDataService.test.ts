/**
 * Unit-tests voor DemoDataService — vult een project met demo-bewijzen voor
 * verkoopgesprekken en ruimt ze daarna weer op (gemarkeerd via exif_hash).
 *
 * We mocken de Supabase-client (insert-/delete-builder + auth.getSession) en
 * borgen:
 *   - populateDemoData zet 4 rijen met user_id (sessie-uid), tenant_id, beide
 *     foto-velden en DEMO_MARKER_n; geeft false zonder sessie en bij een
 *     insert-fout, en vangt excepties af;
 *   - clearDemoData filtert op project_id + exif_hash LIKE 'DEMO_MARKER%' en
 *     geeft true/false op basis van de fout.
 */

let mockSession: { data: { session: unknown } } = {
  data: { session: { user: { id: 'u1' } } },
};
let mockInsertResult: { error: unknown } = { error: null };
let mockDeleteResult: { error: unknown } = { error: null };
const calls: Record<string, any> = {};

const mockBuilder: any = {
  insert: (rows: unknown) => {
    calls.insert = rows;
    return Promise.resolve(mockInsertResult);
  },
  delete: () => {
    calls.delete = true;
    return mockBuilder;
  },
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return mockBuilder;
  },
  like: (...a: unknown[]) => {
    calls.like = a;
    return Promise.resolve(mockDeleteResult);
  },
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      calls.from = a;
      return mockBuilder;
    },
    auth: { getSession: () => Promise.resolve(mockSession) },
  },
}));

import { populateDemoData, clearDemoData } from '../DemoDataService';

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { data: { session: { user: { id: 'u1' } } } };
  mockInsertResult = { error: null };
  mockDeleteResult = { error: null };
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('populateDemoData', () => {
  it('zet 4 rijen met sessie-uid, tenant_id en DEMO_MARKERs', async () => {
    const ok = await populateDemoData('p-1', 't-9');
    expect(ok).toBe(true);
    expect(calls.from).toEqual(['evidence']);

    const rows = calls.insert as any[];
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.project_id).toBe('p-1');
      expect(r.tenant_id).toBe('t-9');
      expect(r.user_id).toBe('u1');
      // beide foto-velden gevuld (passthrough http-URL's)
      expect(r.photo_uri).toBe(r.media_uri);
      expect(typeof r.photo_uri).toBe('string');
      expect(r.review_status).toBe('PENDING_REVIEW');
    }
    const markers = rows.map((r) => r.exif_hash);
    expect(markers).toEqual([
      'DEMO_MARKER_1',
      'DEMO_MARKER_2',
      'DEMO_MARKER_3',
      'DEMO_MARKER_4',
    ]);
    // tijdlijn loopt aflopend (elke rij verder terug in de tijd)
    const times = rows.map((r) => new Date(r.timestamp).getTime());
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
  });

  it('geeft false zonder actieve sessie en inserteert niet', async () => {
    mockSession = { data: { session: null } };
    const ok = await populateDemoData('p-1', 't-9');
    expect(ok).toBe(false);
    expect(calls.insert).toBeUndefined();
  });

  it('geeft false bij een insert-fout', async () => {
    mockInsertResult = { error: { message: 'rls denied' } };
    await expect(populateDemoData('p-1', 't-9')).resolves.toBe(false);
  });
});

describe('clearDemoData', () => {
  it('filtert op project_id + exif_hash LIKE DEMO_MARKER% en geeft true', async () => {
    const ok = await clearDemoData('p-1');
    expect(ok).toBe(true);
    expect(calls.delete).toBe(true);
    expect(calls.eq[0]).toEqual(['project_id', 'p-1']);
    expect(calls.like).toEqual(['exif_hash', 'DEMO_MARKER%']);
  });

  it('geeft false bij een delete-fout', async () => {
    mockDeleteResult = { error: { message: 'boom' } };
    await expect(clearDemoData('p-1')).resolves.toBe(false);
  });
});
