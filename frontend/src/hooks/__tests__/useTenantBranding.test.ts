/**
 * Unit-tests voor useTenantBranding — geeft componenten de actuele klant-branding
 * (logo + naam + accentkleur) en reageert op live wijzigingen.
 *
 * We mocken `../../services/TenantBrandingService` (getBrandingSync voor de
 * initiële state, getBranding als fire-and-forget refresh op mount,
 * subscribeBranding dat de setter vangt en een unsubscribe teruggeeft) en
 * renderen met renderHook uit @testing-library/react-native. We borgen: de
 * initiële sync-waarde, dat mount één refresh triggert + abonneert, dat een
 * subscribe-update de waarde reactief bijwerkt, en dat unsubscribe bij unmount
 * wordt aangeroepen.
 */

const fallbackBranding = { name: 'SpeeQ', primaryColor: '#111' };
const mockGetBrandingSync = jest.fn<any, unknown[]>(() => fallbackBranding);
const mockGetBranding = jest.fn<Promise<any>, unknown[]>(() => Promise.resolve(null));
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn<() => void, unknown[]>(() => mockUnsubscribe);

jest.mock('../../services/TenantBrandingService', () => ({
  getBrandingSync: (...a: unknown[]) => mockGetBrandingSync(...a),
  getBranding: (...a: unknown[]) => mockGetBranding(...a),
  subscribeBranding: (...a: unknown[]) => mockSubscribe(...a),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useTenantBranding } from '../useTenantBranding';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBrandingSync.mockReturnValue(fallbackBranding);
  mockGetBranding.mockResolvedValue(null);
  mockSubscribe.mockReturnValue(mockUnsubscribe);
});

describe('useTenantBranding', () => {
  it('geeft de initiële sync-branding terug en abonneert + refresht op mount', () => {
    const { result } = renderHook(() => useTenantBranding());
    expect(result.current).toEqual(fallbackBranding);
    expect(mockGetBranding).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('werkt reactief bij via de subscribe-callback', () => {
    let pushUpdate: ((b: unknown) => void) | undefined;
    mockSubscribe.mockImplementation((cb: any) => {
      pushUpdate = cb;
      return mockUnsubscribe;
    });
    const { result } = renderHook(() => useTenantBranding());
    const updated = { name: 'Bouwbedrijf Jansen', primaryColor: '#0a0' };
    act(() => {
      pushUpdate?.(updated);
    });
    expect(result.current).toEqual(updated);
  });

  it('zegt het abonnement op bij unmount', () => {
    const { unmount } = renderHook(() => useTenantBranding());
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
