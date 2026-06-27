/**
 * Unit-tests voor useTenantThemeFeatures — mapt TenantBranding naar de Warm
 * Minimal TenantFeaturesPayload en abonneert op branding-updates.
 *
 * We mocken `../../services/TenantBrandingService` (getBrandingSync voor de
 * initiële state, getBranding als fire-and-forget refresh, subscribeBranding
 * dat de setter teruggeeft) en renderen de hook met renderHook uit
 * @testing-library/react-native. We borgen de drie map-takken (volledige
 * brandingColors-JSONB → direct; alleen primaryColor → statusSuccess-accent;
 * niets → null), de throw-fallback in de initiële state, en dat een
 * subscribe-update de payload herberekent.
 */

const mockGetBrandingSync = jest.fn<any, unknown[]>(() => null);
const mockGetBranding = jest.fn<Promise<any>, unknown[]>(() => Promise.resolve(null));
const mockSubscribe = jest.fn<() => void, unknown[]>(() => () => {});

jest.mock('../../services/TenantBrandingService', () => ({
  getBrandingSync: (...a: unknown[]) => mockGetBrandingSync(...a),
  getBranding: (...a: unknown[]) => mockGetBranding(...a),
  subscribeBranding: (...a: unknown[]) => mockSubscribe(...a),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useTenantThemeFeatures } from '../useTenantThemeFeatures';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBrandingSync.mockReturnValue(null);
  mockGetBranding.mockResolvedValue(null);
  mockSubscribe.mockReturnValue(() => {});
});

describe('useTenantThemeFeatures', () => {
  it('null wanneer er geen branding is', () => {
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toBeNull();
    // abonneert en triggert een refresh
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockGetBranding).toHaveBeenCalledTimes(1);
  });

  it('volledige brandingColors → direct doorgegeven', () => {
    mockGetBrandingSync.mockReturnValue({
      brandingColors: { statusSuccess: '#0a0', background: '#fff' },
    });
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toEqual({
      branding_colors: { statusSuccess: '#0a0', background: '#fff' },
    });
  });

  it('alleen primaryColor → mapt naar statusSuccess-accent', () => {
    mockGetBrandingSync.mockReturnValue({ primaryColor: '#123456' });
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toEqual({ branding_colors: { statusSuccess: '#123456' } });
  });

  it('leeg brandingColors-object valt door naar null', () => {
    mockGetBrandingSync.mockReturnValue({ brandingColors: {}, primaryColor: null });
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toBeNull();
  });

  it('getBrandingSync gooit → initiële state null (geen crash)', () => {
    mockGetBrandingSync.mockImplementation(() => {
      throw new Error('store nog niet klaar');
    });
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toBeNull();
  });

  it('subscribe-update herberekent de payload', () => {
    let pushUpdate: ((b: unknown) => void) | undefined;
    mockSubscribe.mockImplementation((cb: any) => {
      pushUpdate = cb;
      return () => {};
    });
    const { result } = renderHook(() => useTenantThemeFeatures());
    expect(result.current).toBeNull();

    act(() => {
      pushUpdate?.({ primaryColor: '#abcdef' });
    });
    expect(result.current).toEqual({ branding_colors: { statusSuccess: '#abcdef' } });
  });
});
