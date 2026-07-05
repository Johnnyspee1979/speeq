/**
 * Unit-tests voor useSimpleMode — convenience-wrapper rond
 * useTenantFeature('simple_mode'). De hook geeft de boolean van de
 * onderliggende feature-flag onveranderd door en roept die met de juiste
 * feature-key aan.
 *
 * We mocken `../useTenantFeature` (mutabele return) en borgen: de aan-tak,
 * de uit-tak, de doorgegeven feature-key, en dat een wijziging bij rerender
 * volgt.
 */

const mockUseTenantFeature = jest.fn<boolean, unknown[]>(() => false);
jest.mock('../useTenantFeature', () => ({
  useTenantFeature: (...a: unknown[]) => mockUseTenantFeature(...a),
}));

import { renderHook } from '@testing-library/react-native';
import { useSimpleMode } from '../useSimpleMode';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTenantFeature.mockReturnValue(false);
});

describe('useSimpleMode', () => {
  it('geeft false door wanneer simple_mode uitstaat (default)', () => {
    const { result } = renderHook(() => useSimpleMode());
    expect(result.current).toBe(false);
  });

  it('geeft true door wanneer simple_mode aanstaat', () => {
    mockUseTenantFeature.mockReturnValue(true);
    const { result } = renderHook(() => useSimpleMode());
    expect(result.current).toBe(true);
  });

  it('vraagt de feature-key simple_mode op', () => {
    renderHook(() => useSimpleMode());
    expect(mockUseTenantFeature).toHaveBeenCalledWith('simple_mode');
  });

  it('volgt een wijziging bij rerender', () => {
    const { result, rerender } = renderHook(() => useSimpleMode());
    expect(result.current).toBe(false);
    mockUseTenantFeature.mockReturnValue(true);
    rerender(undefined);
    expect(result.current).toBe(true);
  });
});
