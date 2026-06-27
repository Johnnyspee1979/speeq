/**
 * Unit-tests voor lib/platform — device-type-detectie op breedte plus de
 * platform-vlaggen (isWeb/isiOS/isAndroid). We mocken react-native's Platform
 * (mutabel, default 'web') en Dimensions.get('window').width zodat de
 * default-tak van getDeviceType deterministisch is.
 *
 * We borgen de drempels: >1024 DESKTOP, >768 TABLET, anders MOBILE (incl. de
 * exacte grenswaarden 1024/768), de default-breedte uit Dimensions, en dat de
 * vlaggen kloppen wanneer Platform.OS 'web' is.
 */

const mockPlatform = { OS: 'web' as string };
const mockGetWindow = jest.fn<{ width: number }, unknown[]>(() => ({ width: 500 }));
jest.mock('react-native', () => ({
  Platform: mockPlatform,
  Dimensions: { get: (...a: unknown[]) => mockGetWindow(...a) },
}));

import { getDeviceType, isWeb, isiOS, isAndroid } from '../platform';

describe('getDeviceType', () => {
  it.each([
    [1400, 'DESKTOP'],
    [1025, 'DESKTOP'],
    [1024, 'TABLET'],
    [900, 'TABLET'],
    [769, 'TABLET'],
    [768, 'MOBILE'],
    [375, 'MOBILE'],
    [0, 'MOBILE'],
  ])('breedte %i → %s', (width, expected) => {
    expect(getDeviceType(width)).toBe(expected);
  });

  it('zonder argument valt terug op Dimensions-breedte', () => {
    mockGetWindow.mockReturnValueOnce({ width: 1200 });
    expect(getDeviceType()).toBe('DESKTOP');
    expect(mockGetWindow).toHaveBeenCalledWith('window');
  });
});

describe('platform-vlaggen (Platform.OS = web)', () => {
  it('isWeb true, isiOS/isAndroid false', () => {
    expect(isWeb).toBe(true);
    expect(isiOS).toBe(false);
    expect(isAndroid).toBe(false);
  });
});
