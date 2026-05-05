import { useCallback, useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { isWeb } from '../lib/platform';
import {
  parseInspectionCameraDeepLink,
  parseInspectionRouteFromNotificationData,
  type InspectionRouteIntent,
} from '../services/deepLinking';

type RouteHandler = (intent: InspectionRouteIntent) => void;

export const useNotificationRouting = (onRoute: RouteHandler) => {
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const handledKeysRef = useRef<Set<string>>(new Set());

  const handleIntent = useCallback(
    (key: string, intent: InspectionRouteIntent | null) => {
      if (!intent || handledKeysRef.current.has(key)) {
        return;
      }

      handledKeysRef.current.add(key);
      onRoute(intent);
    },
    [onRoute]
  );

  useEffect(() => {
    let isMounted = true;

    void Linking.getInitialURL().then((initialUrl) => {
      if (!isMounted || !initialUrl) {
        return;
      }

      handleIntent(`initial-url:${initialUrl}`, parseInspectionCameraDeepLink(initialUrl));
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleIntent(`url:${url}`, parseInspectionCameraDeepLink(url));
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
    };
  }, [handleIntent]);

  useEffect(() => {
    if (isWeb || !lastNotificationResponse) {
      return;
    }

    const notificationId =
      lastNotificationResponse.notification.request.identifier ??
      JSON.stringify(lastNotificationResponse.notification.request.content.data ?? {});

    handleIntent(
      `last-notification:${notificationId}`,
      parseInspectionRouteFromNotificationData(
        lastNotificationResponse.notification.request.content.data
      )
    );
  }, [handleIntent, lastNotificationResponse]);

  useEffect(() => {
    if (isWeb) {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const notificationId =
          response.notification.request.identifier ??
          JSON.stringify(response.notification.request.content.data ?? {});

        handleIntent(
          `notification:${notificationId}`,
          parseInspectionRouteFromNotificationData(
            response.notification.request.content.data
          )
        );
      }
    );

    return () => {
      subscription.remove();
    };
  }, [handleIntent]);
};
