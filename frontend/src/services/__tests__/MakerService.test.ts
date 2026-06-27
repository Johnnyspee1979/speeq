/**
 * Unit-tests voor MakerService — CRUD op de master-`tenants`-registry plus de
 * maker-only auth-helpers. Alles loopt via `masterSupabase()`.
 *
 * We mocken de master-client (chainbare thenable builder + auth) en borgen:
 *   - isMakerEmail: case-insensitive + trim, null/undefined → false;
 *   - createTenant: leidt een nette slug/company_id af, trimt velden, zet
 *     status 'active' en mapt de DB-rij terug naar camelCase;
 *   - updateTenant: bouwt alleen patch-velden die zijn meegegeven (name vult
 *     ook display_name) en filtert op company_id;
 *   - listTenants/deleteTenant/getTenantBySlug: order desc, throw bij fout,
 *     en getTenantBySlug geeft null (niet throw) bij een fout;
 *   - signInMaker weigert een niet-maker (signOut + throw); getMakerSessionEmail
 *     geeft alleen een maker-mail terug.
 */

let mockResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockSingle: { data: unknown; error: unknown } = { data: null, error: null };
let mockMaybe: { data: unknown; error: unknown } = { data: null, error: null };
let mockSignIn: { data: unknown; error: unknown } = {
  data: { user: { email: 'johnny@speesolutions.com' } },
  error: null,
};
let mockSession: { data: { session: unknown } } = {
  data: { session: { user: { email: 'johnny@speesolutions.com' } } },
};
const calls: Record<string, any> = {};

const mockBuilder: any = {
  select: (...a: unknown[]) => {
    calls.select = a;
    return mockBuilder;
  },
  order: (...a: unknown[]) => {
    calls.order = a;
    return mockBuilder;
  },
  insert: (p: unknown) => {
    calls.insert = p;
    return mockBuilder;
  },
  update: (p: unknown) => {
    calls.update = p;
    return mockBuilder;
  },
  delete: () => {
    calls.delete = true;
    return mockBuilder;
  },
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return mockBuilder;
  },
  single: () => Promise.resolve(mockSingle),
  maybeSingle: () => Promise.resolve(mockMaybe),
  then: (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej),
};

const mockClient: any = {
  from: (...a: unknown[]) => {
    calls.from = a;
    return mockBuilder;
  },
  auth: {
    signInWithPassword: (...a: unknown[]) => {
      calls.signIn = a;
      return Promise.resolve(mockSignIn);
    },
    signOut: () => {
      calls.signOut = (calls.signOut || 0) + 1;
      return Promise.resolve();
    },
    getSession: () => Promise.resolve(mockSession),
  },
};

jest.mock('../MasterSupabase', () => ({ masterSupabase: () => mockClient }));

import {
  isMakerEmail,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantBySlug,
  listTenants,
  signInMaker,
  signOutMaker,
  getMakerSessionEmail,
} from '../MakerService';

const dbRow = {
  company_id: 'bouw-bv',
  name: 'Bouw BV',
  display_name: 'Bouw BV',
  slug: 'bouw-bv',
  status: 'active',
  supabase_url: 'https://x.supabase.co',
  supabase_anon_key: 'anon-1',
  custom_domain: 'app.bouw.nl',
  admin_email: 'admin@bouw.nl',
  contact_phone: '0612345678',
  logo_url: null,
  primary_color: '#112233',
  pdf_footer_text: null,
  users: 3,
  notes: 'vip',
  created_at: '2026-01-15T09:30:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResult = { data: [], error: null };
  mockSingle = { data: null, error: null };
  mockMaybe = { data: null, error: null };
  mockSignIn = { data: { user: { email: 'johnny@speesolutions.com' } }, error: null };
  mockSession = { data: { session: { user: { email: 'johnny@speesolutions.com' } } } };
  for (const k of Object.keys(calls)) delete calls[k];
});

describe('isMakerEmail', () => {
  it('herkent de maker case-insensitive en met spaties', () => {
    expect(isMakerEmail('  Johnny@SpeeSolutions.com ')).toBe(true);
  });
  it('weigert andere mails en null/undefined', () => {
    expect(isMakerEmail('iemand@anders.nl')).toBe(false);
    expect(isMakerEmail(null)).toBe(false);
    expect(isMakerEmail(undefined)).toBe(false);
  });
});

describe('createTenant', () => {
  it('leidt slug/company_id af, trimt velden en mapt de rij terug', async () => {
    mockSingle = { data: dbRow, error: null };
    const t = await createTenant({
      name: '  Bouw & Co B.V.!  ',
      supabaseUrl: ' https://x.supabase.co ',
      supabaseAnonKey: ' anon-1 ',
    });

    expect(calls.from).toEqual(['tenants']);
    const p = calls.insert as any;
    expect(p.slug).toBe('bouw-co-b-v');
    expect(p.company_id).toBe('bouw-co-b-v');
    expect(p.name).toBe('Bouw & Co B.V.!');
    expect(p.display_name).toBe('Bouw & Co B.V.!');
    expect(p.status).toBe('active');
    expect(p.supabase_url).toBe('https://x.supabase.co');
    expect(p.supabase_anon_key).toBe('anon-1');
    expect(typeof p.created_at).toBe('string');

    // teruggemapt naar camelCase
    expect(t).toMatchObject({ companyId: 'bouw-bv', primaryColor: '#112233', users: 3 });
  });

  it('gooit met de DB-foutmelding', async () => {
    mockSingle = { data: null, error: { message: 'duplicate key' } };
    await expect(
      createTenant({ name: 'X', supabaseUrl: 'u', supabaseAnonKey: 'a' }),
    ).rejects.toThrow('duplicate key');
  });
});

describe('updateTenant', () => {
  it('patcht alleen meegegeven velden (name vult ook display_name) en filtert op company_id', async () => {
    mockSingle = { data: dbRow, error: null };
    await updateTenant('bouw-bv', { name: '  Nieuw  ', status: 'disabled' });

    const patch = calls.update as any;
    expect(patch).toEqual({ name: 'Nieuw', display_name: 'Nieuw', status: 'disabled' });
    expect('supabase_url' in patch).toBe(false);
    expect(calls.eq[0]).toEqual(['company_id', 'bouw-bv']);
  });
});

describe('deleteTenant', () => {
  it('verwijdert op company_id', async () => {
    mockResult = { data: null, error: null };
    await expect(deleteTenant('bouw-bv')).resolves.toBeUndefined();
    expect(calls.delete).toBe(true);
    expect(calls.eq[0]).toEqual(['company_id', 'bouw-bv']);
  });
  it('gooit bij een delete-fout', async () => {
    mockResult = { data: null, error: { message: 'rls' } };
    await expect(deleteTenant('bouw-bv')).rejects.toThrow('rls');
  });
});

describe('getTenantBySlug', () => {
  it('mapt de rij bij een treffer', async () => {
    mockMaybe = { data: dbRow, error: null };
    const t = await getTenantBySlug('bouw-bv');
    expect(t?.companyId).toBe('bouw-bv');
    expect(calls.eq[0]).toEqual(['slug', 'bouw-bv']);
  });
  it('geeft null (niet throw) bij een fout', async () => {
    mockMaybe = { data: null, error: { message: 'boom' } };
    await expect(getTenantBySlug('weg')).resolves.toBeNull();
  });
});

describe('listTenants', () => {
  it('sorteert aflopend op created_at en mapt de rijen', async () => {
    mockResult = { data: [dbRow], error: null };
    const list = await listTenants();
    expect(calls.order).toEqual(['created_at', { ascending: false }]);
    expect(list).toHaveLength(1);
    expect(list[0].companyId).toBe('bouw-bv');
  });
  it('gooit bij een fout', async () => {
    mockResult = { data: null, error: { message: 'down' } };
    await expect(listTenants()).rejects.toThrow('down');
  });
});

describe('auth-helpers', () => {
  it('signInMaker geeft de user terug bij een maker-mail', async () => {
    const u = (await signInMaker('johnny@speesolutions.com', 'pw')) as any;
    expect(u.email).toBe('johnny@speesolutions.com');
    expect(calls.signOut).toBeUndefined();
  });

  it('signInMaker weigert een niet-maker (signOut + throw)', async () => {
    mockSignIn = { data: { user: { email: 'fake@x.nl' } }, error: null };
    await expect(signInMaker('fake@x.nl', 'pw')).rejects.toThrow('alleen voor de maker');
    expect(calls.signOut).toBe(1);
  });

  it('signInMaker gooit bij een auth-fout', async () => {
    mockSignIn = { data: null, error: { message: 'invalid login' } };
    await expect(signInMaker('a', 'b')).rejects.toThrow('invalid login');
  });

  it('getMakerSessionEmail geeft de maker-mail, anders null', async () => {
    await expect(getMakerSessionEmail()).resolves.toBe('johnny@speesolutions.com');
    mockSession = { data: { session: { user: { email: 'ander@x.nl' } } } };
    await expect(getMakerSessionEmail()).resolves.toBeNull();
  });

  it('signOutMaker roept de client-signOut aan', async () => {
    await signOutMaker();
    expect(calls.signOut).toBe(1);
  });
});
