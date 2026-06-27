/**
 * Unit-tests voor useIsAdmin — centrale RBAC-check voor het tonen van
 * dev/diagnostiek. True bij rol ADMIN of het master-account
 * johnny@speesolutions.com; voor alle andere rollen false.
 *
 * We mocken `../useWkbAuth` zodat we de `user` kunnen variëren en renderen de
 * hook met renderHook. We borgen: false zonder user, true bij ADMIN, true bij
 * het master-e-mailadres (ongeacht rol), en false bij een gewone rol/ander
 * e-mailadres.
 */

const mockUseWkbAuth = jest.fn<any, unknown[]>();
jest.mock('../useWkbAuth', () => ({
  useWkbAuth: (...a: unknown[]) => mockUseWkbAuth(...a),
}));

import { renderHook } from '@testing-library/react-native';
import { useIsAdmin } from '../useIsAdmin';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWkbAuth.mockReturnValue({ user: null });
});

describe('useIsAdmin', () => {
  it('false wanneer er geen user is', () => {
    mockUseWkbAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it('true bij rol ADMIN', () => {
    mockUseWkbAuth.mockReturnValue({ user: { role: 'ADMIN', email: 'iemand@x.nl' } });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  it('true bij het master-e-mailadres ongeacht rol', () => {
    mockUseWkbAuth.mockReturnValue({
      user: { role: 'VAKMAN', email: 'johnny@speesolutions.com' },
    });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  it('false bij een gewone rol en ander e-mailadres', () => {
    mockUseWkbAuth.mockReturnValue({
      user: { role: 'WERKVOORBEREIDER', email: 'jan@bouw.nl' },
    });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });
});
