/**
 * Unit-tests voor useActiveTenantId — leest het actieve tenant_id uit
 * `profiles.tenant_id WHERE id = auth.uid()` en reageert op login/logout +
 * tenant-switches via onAuthStateChange.
 *
 * We mocken `../../lib/supabase` (isSupabaseConfigured mutabel; auth.getSession
 * en auth.onAuthStateChange; een chainbare from().select().eq().maybeSingle()).
 * We borgen: niets doen zonder config, null zonder sessie-user, het tenant_id
 * bij een profiel, null bij een fout/leeg/exception, en dat een
 * auth-state-change opnieuw laadt (tenant-switch).
 */

let mockConfigured = true;
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
  isSupabaseConfigured: () => mockConfigured,
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

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTenantId } from '../useActiveTenantId';

const sessionWith = (id: string | null) => ({
  data: { session: id ? { user: { id } } : null },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = true;
  authChangeCb = undefined;
  mockGetSession.mockResolvedValue(sessionWith('user-1'));
  mockMaybeSingle.mockResolvedValue({ data: { tenant_id: 'tenant-abc' }, error: null });
});

describe('useActiveTenantId', () => {
  it('doet niets en blijft null zonder Supabase-config', () => {
    mockConfigured = false;
    const { result } = renderHook(() => useActiveTenantId());
    expect(result.current).toBeNull();
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('null wanneer er geen sessie-gebruiker is', async () => {
    mockGetSession.mockResolvedValue(sessionWith(null));
    const { result } = renderHook(() => useActiveTenantId());
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('geeft het tenant_id uit het profiel', async () => {
    const { result } = renderHook(() => useActiveTenantId());
    await waitFor(() => expect(result.current).toBe('tenant-abc'));
  });

  it('null bij een query-fout', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boem' } });
    const { result } = renderHook(() => useActiveTenantId());
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('null wanneer getSession gooit (catch)', async () => {
    mockGetSession.mockRejectedValue(new Error('netwerk'));
    const { result } = renderHook(() => useActiveTenantId());
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('herlaadt bij een auth-state-change (tenant-switch)', async () => {
    const { result } = renderHook(() => useActiveTenantId());
    await waitFor(() => expect(result.current).toBe('tenant-abc'));

    mockMaybeSingle.mockResolvedValue({ data: { tenant_id: 'tenant-xyz' }, error: null });
    await act(async () => {
      authChangeCb?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current).toBe('tenant-xyz'));
  });

  it('zegt het auth-abonnement op bij unmount', () => {
    const { unmount } = renderHook(() => useActiveTenantId());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
