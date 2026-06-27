/**
 * Unit-tests voor useWkbAuth — laadt de actieve gebruiker (Supabase-sessie +
 * profielrij), mapt die naar een WkbUser met defaults, biedt rol-helpers
 * (canApproveEvidence/isSubcontractor), een dev-bypass, en herlaadt bij
 * auth-state-changes. Bij een geldige sessie wordt de JWT fire-and-forget in de
 * OfflineAuthCache gezet.
 *
 * We mocken `../../lib/supabase` (auth.getSession + chainbare
 * from().select().eq().maybeSingle() + onAuthStateChange capture) en
 * `../../services/OfflineAuthCache` (cacheSession). We borgen: null zonder
 * sessie, de profiel-mapping, de defaults bij een leeg profiel, de fout-catch,
 * de rol-helpers, de dev-bypass, het cachen van de sessie, de auth-change-reload
 * en unsubscribe bij unmount.
 */

const mockGetSession = jest.fn<Promise<any>, unknown[]>();
const mockMaybeSingle = jest.fn<Promise<any>, unknown[]>();
let authChangeCb: (() => void) | undefined;
const mockUnsubscribe = jest.fn();

const builder: any = {
  select: (..._a: unknown[]) => builder,
  eq: (..._a: unknown[]) => builder,
  maybeSingle: (...a: unknown[]) => mockMaybeSingle(...a),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (..._a: unknown[]) => builder,
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      onAuthStateChange: (cb: () => void) => {
        authChangeCb = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

const mockCacheSession = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());
jest.mock('../../services/OfflineAuthCache', () => ({
  cacheSession: (...a: unknown[]) => mockCacheSession(...a),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWkbAuth } from '../useWkbAuth';

const sessionWith = (user: any) => ({
  data: {
    session: user
      ? {
          user,
          access_token: 'at',
          refresh_token: 'rt',
          expires_at: 1000,
        }
      : null,
  },
  error: null,
});

const authUser = { id: 'user-1', email: 'jan@bouw.nl' };

beforeEach(() => {
  jest.clearAllMocks();
  authChangeCb = undefined;
  mockGetSession.mockResolvedValue(sessionWith(authUser));
  mockMaybeSingle.mockResolvedValue({
    data: {
      role: 'AANNEMER',
      company_name: 'Bouw BV',
      display_name: 'Jan',
      disciplines: ['metsel'],
      project_ids: ['p1'],
    },
    error: null,
  });
});

describe('useWkbAuth', () => {
  it('user null en loading false wanneer er geen sessie is', async () => {
    mockGetSession.mockResolvedValue(sessionWith(null));
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('mapt de profielrij naar een WkbUser', async () => {
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user).toMatchObject({
      id: 'user-1',
      email: 'jan@bouw.nl',
      role: 'AANNEMER',
      displayName: 'Jan',
      companyName: 'Bouw BV',
      disciplines: ['metsel'],
      projectIds: ['p1'],
    });
  });

  it('valt terug op defaults bij een leeg profiel', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user).toMatchObject({
      role: 'ONDERAANNEMER',
      companyName: 'Onbekend bedrijf',
      disciplines: [],
      projectIds: [],
    });
  });

  it('zet user op null bij een sessie-fout (catch)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: { message: 'boem' } });
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('canApproveEvidence true voor reviewers, isSubcontractor false', async () => {
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.canApproveEvidence()).toBe(true); // AANNEMER
    expect(result.current.isSubcontractor()).toBe(false);
  });

  it('isSubcontractor true voor een ONDERAANNEMER', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'ONDERAANNEMER' }, error: null });
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.isSubcontractor()).toBe(true);
    expect(result.current.canApproveEvidence()).toBe(false);
  });

  it('enableDevBypass zet een ADMIN dev-gebruiker actief', async () => {
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.enableDevBypass();
    });
    expect(result.current.user).toMatchObject({ role: 'ADMIN', companyName: 'Combivo' });
  });

  it('cachet de sessie in de OfflineAuthCache bij een geldige sessie', async () => {
    renderHook(() => useWkbAuth());
    await waitFor(() => expect(mockCacheSession).toHaveBeenCalled());
    expect(mockCacheSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 1000 * 1000,
        userId: 'user-1',
        email: 'jan@bouw.nl',
      }),
    );
  });

  it('herlaadt bij een auth-state-change', async () => {
    const { result } = renderHook(() => useWkbAuth());
    await waitFor(() => expect(result.current.user?.role).toBe('AANNEMER'));

    mockMaybeSingle.mockResolvedValue({ data: { role: 'KWALITEITSBORGER' }, error: null });
    await act(async () => {
      authChangeCb?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.user?.role).toBe('KWALITEITSBORGER'));
  });

  it('zegt het auth-abonnement op bij unmount', () => {
    const { unmount } = renderHook(() => useWkbAuth());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
