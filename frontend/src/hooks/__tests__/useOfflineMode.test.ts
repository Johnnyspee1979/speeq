/**
 * Unit-tests voor useOfflineMode — convenience-wrapper rond
 * useTenantFeature('offline_mode'). De hook geeft de boolean van de
 * onderliggende feature-flag onveranderd door en roept die met de juiste
 * feature-key aan.
 *
 * We mocken `../useTenantFeature` (mutabele return) en borgen: de aan-tak,
 * de uit-tak, de doorgegeven feature-key, en dat een wijziging bij rerender
 * volgt.
 */

const mockUseTenantFeature = jest.fn<boolean, unknown[]>(() => true);
jest.mock('../useTenantFeature', () => ({
  useTenantFeature: (...a: unknown[]) => mockUseTenantFeature(...a),
}));

import { renderHook } from '@testing-library/react-native';
import { useOfflineMode } from '../useOfflineMode';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTenantFeature.mockReturnValue(true);
});

describe('useOfflineMode', () => {
  it('geeft true door wanneer offline_mode aanstaat', () => {
    const { result } = renderHook(() => useOfflineMode());
    expect(result.current).toBe(true);
  });

  it('geeft false door wanneer offline_mode uitstaat', () => {
    mockUseTenantFeature.mockReturnValue(false);
    const { result } = renderHook(() => useOfflineMode());
    expect(result.current).toBe(false);
  });

  it('vraagt de feature-key offline_mode op', () => {
    renderHook(() => useOfflineMode());
    expect(mockUseTenantFeature).toHaveBeenCalledWith('offline_mode');
  });

  it('volgt een wijziging bij rerender', () => {
    const { result, rerender } = renderHook(() => useOfflineMode());
    expect(result.current).toBe(true);
    mockUseTenantFeature.mockReturnValue(false);
    rerender(undefined);
    expect(result.current).toBe(false);
  });
});
