import { useCallback, useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import {
  parseInspectionCameraDeepLink,
  type InspectionRouteIntent,
} from '../services/deepLinking';

type RouteHandler = (intent: InspectionRouteIntent) => void;

export const useNotificationRouting = (onRoute: RouteHandler) => {
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

      handleIntent(
        `initial-url:${initialUrl}`,
        parseInspectionCameraDeepLink(initialUrl)
      );
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleIntent(`url:${url}`, parseInspectionCameraDeepLink(url));
    });

    return () => {
      isMounted = false;
      urlSubscription.remove();
    };
  }, [handleIntent]);
};
