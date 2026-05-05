import { Dimensions, Platform } from 'react-native';

export type DeviceType = 'DESKTOP' | 'TABLET' | 'MOBILE';

export const isWeb = Platform.OS === 'web';
export const isiOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Components can also pass the live width from useWindowDimensions for reactive layouts.
export const getDeviceType = (
  width: number = Dimensions.get('window').width
): DeviceType => {
  if (width > 1024) return 'DESKTOP';
  if (width > 768) return 'TABLET';
  return 'MOBILE';
};
