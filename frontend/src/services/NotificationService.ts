import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BACKEND_URL, EXPO_PROJECT_ID } from '../config/app';
import { supabase } from '../lib/supabase';

export const BLURRY_PHOTO_MESSAGE =
  'Foto onvoldoende voor Wkb-dossier, neem opnieuw met focus op de aansluiting.';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'web') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wkb-alerts', {
      name: 'Wkb Kwaliteitswaarschuwingen',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: '#FF3B30',
      sound: 'default',
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    console.warn('⚠️ Geen toestemming voor Wkb-pushnotificaties gekregen.');
    return false;
  }

  return true;
};

export const triggerBlurryPhotoAlert = async () => {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Kwaliteitswaarschuwing',
      body: BLURRY_PHOTO_MESSAGE,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
  });
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();

    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // no-op
  }

  return fallback;
};

export const registerForReviewNotifications = async (
  projectId: string,
  deviceLabel?: string
) => {
  if (Platform.OS === 'web') {
    return { registered: false, reason: 'web' as const };
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    return { registered: false, reason: 'permissions_denied' as const };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { registered: false, reason: 'not_authenticated' as const };
  }

  if (!EXPO_PROJECT_ID) {
    console.warn(
      '⚠️ EXPO_PUBLIC_EXPO_PROJECT_ID ontbreekt; review-pushregistratie wordt overgeslagen.'
    );
    return { registered: false, reason: 'missing_project_id' as const };
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
    projectId: EXPO_PROJECT_ID,
  });

  const response = await fetch(`${BACKEND_URL}/api/notifications/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      expoPushToken,
      platform: Platform.OS,
      deviceLabel: deviceLabel ?? `${Platform.OS}-device`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        'Push-registratie voor reviewnotificaties mislukt.'
      )
    );
  }

  return { registered: true, reason: 'ok' as const };
};
