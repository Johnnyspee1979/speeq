/**
 * Unit-tests voor DrawingChangeRequestService — wijzigingsverzoeken op
 * bouwtekeningen met een publieke goedkeuringslink (akkoord/afwijzen door klant).
 *
 * We mocken de Supabase-client (chainbare thenable builder + auth.getUser) en
 * borgen:
 *   - createChangeRequest: trimt beschrijving, vult requested_by/requester_name
 *     uit de sessie, mapt de rij en geeft null bij een fout;
 *   - getChangeRequestByToken: filtert op approval_token en geeft null bij fout;
 *   - approve/reject: schrijven de juiste status + getrimde velden + leggen het
 *     PENDING-filter aan en geven true/false op basis van error;
 *   - getChangeRequestsForProject: filtert/sorteert/limiteert en geeft [] bij fout;
 *   - buildApprovalUrl: valt terug op de vaste URL buiten een browser (node-env).
 */

let mockSingle: { data: unknown; error: unknown } = { data: null, error: null };
let mockThenResult: { data: unknown; error: unknown } = { data: [], error: null };
let mockUser: { data: { user: unknown } } = {
  data: { user: { id: 'u-1', email: 'wv@speeq.nl' } },
};
const calls: Record<string, any> = {};

const mockBuilder: any = {
  insert: (p: unknown) => {
    calls.insert = p;
    return mockBuilder;
  },
  update: (p: unknown) => {
    calls.update = p;
    return mockBuilder;
  },
  select: (...a: unknown[]) => {
    calls.select = a;
    return mockBuilder;
  },
  eq: (...a: unknown[]) => {
    (calls.eq ||= []).push(a);
    return mockBuilder;
  },
  order: (...a: unknown[]) => {
    calls.order = a;
    return mockBuilder;
  },
  limit: (...a: unknown[]) => {
    calls.limit = a;
    return mockBuilder;
  },
  single: () => Promise.resolve(mockSingle),
  then: (res: any, rej: any) => Promise.resolve(mockThenResult).then(res, rej),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      calls.from = a;
      return mockBuilder;
    },
    auth: {
      getUser: () => Promise.resolve(mockUser),
    },
  },
}));

import {
  createChangeRequest,
  getChangeRequestByToken,
  approveChangeRequest,
  rejectChangeRequest,
  getChangeRequestsForProject,
  buildApprovalUrl,
} from '../DrawingChangeRequestService';

const fullRow = {
  id: 'cr-1',
  project_id: 'p-1',
  floor_plan_id: 'fp-1',
  change_type: 'AANPASSING',
  change_description: 'Muur verplaatst',
  requested_by: 'u-1',
  requester_name: 'WV',
  requested_at: 't1',
  approval_token: 'tok-abc',
  status: 'PENDING',
  client_name: null,
  client_email: null,
  approved_at: null,
  rejection_reason: null,
  legal_statement: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle = { data: null, error: null };
  mockThenResult = { data: [], error: null };
  mockUser = { data: { user: { id: 'u-1', email: 'wv@speeq.nl' } } };
  for (const k of Object.keys(calls)) delete calls[k];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('createChangeRequest', () => {
  it('trimt, vult sessie-velden, mapt de rij naar camelCase', async () => {
    mockSingle = { data: fullRow, error: null };
    const res = await createChangeRequest({
      projectId: 'p-1',
      floorPlanId: 'fp-1',
      changeDescription: '  Muur verplaatst  ',
    });

    expect(calls.from).toEqual(['drawing_change_requests']);
    expect(calls.insert).toMatchObject({
      project_id: 'p-1',
      floor_plan_id: 'fp-1',
      change_type: 'AANPASSING',
      change_description: 'Muur verplaatst',
      requested_by: 'u-1',
      requester_name: 'wv@speeq.nl', // valt terug op user.email
    });
    expect(res).toMatchObject({ id: 'cr-1', projectId: 'p-1', approvalToken: 'tok-abc', status: 'PENDING' });
  });

  it('geeft null bij een insert-fout', async () => {
    mockSingle = { data: null, error: { message: 'rls' } };
    const res = await createChangeRequest({ projectId: 'p-1', changeDescription: 'x' });
    expect(res).toBeNull();
  });
});

describe('getChangeRequestByToken', () => {
  it('filtert op approval_token en mapt de rij', async () => {
    mockSingle = { data: fullRow, error: null };
    const res = await getChangeRequestByToken('tok-abc');
    expect(calls.eq[0]).toEqual(['approval_token', 'tok-abc']);
    expect(res).toMatchObject({ id: 'cr-1', changeDescription: 'Muur verplaatst' });
  });

  it('geeft null bij een fout', async () => {
    mockSingle = { data: null, error: { message: 'not found' } };
    await expect(getChangeRequestByToken('x')).resolves.toBeNull();
  });
});

describe('approveChangeRequest', () => {
  it('schrijft APPROVED + getrimde velden + PENDING-filter, geeft true', async () => {
    mockThenResult = { data: null, error: null };
    const ok = await approveChangeRequest('tok-abc', '  Jan Klant ', '  jan@x.nl ');
    expect(ok).toBe(true);
    expect(calls.update).toMatchObject({
      status: 'APPROVED',
      client_name: 'Jan Klant',
      client_email: 'jan@x.nl',
    });
    expect(calls.update.legal_statement).toContain('Jan Klant');
    expect(calls.eq).toEqual([['approval_token', 'tok-abc'], ['status', 'PENDING']]);
  });

  it('geeft false bij een error', async () => {
    mockThenResult = { data: null, error: { message: 'conflict' } };
    await expect(approveChangeRequest('t', 'A', 'a@x.nl')).resolves.toBe(false);
  });
});

describe('rejectChangeRequest', () => {
  it('schrijft REJECTED + getrimde reden, geeft true', async () => {
    mockThenResult = { data: null, error: null };
    const ok = await rejectChangeRequest('tok-abc', ' Jan ', '  past niet  ');
    expect(ok).toBe(true);
    expect(calls.update).toMatchObject({
      status: 'REJECTED',
      client_name: 'Jan',
      rejection_reason: 'past niet',
    });
    expect(calls.eq).toEqual([['approval_token', 'tok-abc'], ['status', 'PENDING']]);
  });
});

describe('getChangeRequestsForProject', () => {
  it('filtert/sorteert/limiteert en mapt de rijen', async () => {
    mockThenResult = { data: [fullRow, { ...fullRow, id: 'cr-2' }], error: null };
    const list = await getChangeRequestsForProject('p-1');
    expect(calls.eq[0]).toEqual(['project_id', 'p-1']);
    expect(calls.order).toEqual(['requested_at', { ascending: false }]);
    expect(calls.limit).toEqual([100]);
    expect(list).toHaveLength(2);
    expect(list[1].id).toBe('cr-2');
  });

  it('geeft [] bij een fout', async () => {
    mockThenResult = { data: null, error: { message: 'down' } };
    await expect(getChangeRequestsForProject('p-1')).resolves.toEqual([]);
  });
});

describe('buildApprovalUrl', () => {
  it('bouwt de link op window.location.origin in een browser', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.speesolutions.com' },
      configurable: true,
    });
    expect(buildApprovalUrl('tok-xyz')).toBe(
      'https://app.speesolutions.com/?approve=tok-xyz',
    );
  });
});
