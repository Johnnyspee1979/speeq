import { APP_SCHEME } from '../config/app';

export type InspectionRouteIntent = {
  inspectionPointId: string;
  reason?: string | null;
  source: 'deep-link' | 'notification';
};

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const normalizeReason = (value: unknown) => {
  const reason = readString(value);
  return reason || null;
};

export const buildInspectionCameraDeepLink = (
  inspectionPointId: string,
  reason?: string | null
) => {
  const safeInspectionPointId = encodeURIComponent(inspectionPointId.trim());
  const normalizedReason = normalizeReason(reason);

  if (!normalizedReason) {
    return `${APP_SCHEME}://camera/${safeInspectionPointId}`;
  }

  return `${APP_SCHEME}://camera/${safeInspectionPointId}?reason=${encodeURIComponent(
    normalizedReason
  )}`;
};

export const parseInspectionCameraDeepLink = (
  url?: string | null
): InspectionRouteIntent | null => {
  const rawUrl = readString(url);

  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();

    if (protocol === APP_SCHEME && parsed.hostname.toLowerCase() === 'camera') {
      const inspectionPointId = decodeURIComponent(
        parsed.pathname.replace(/^\/+/, '').trim()
      );

      if (!inspectionPointId) {
        return null;
      }

      return {
        inspectionPointId,
        reason: normalizeReason(parsed.searchParams.get('reason')),
        source: 'deep-link',
      };
    }

    const normalizedPath = parsed.pathname.replace(/^\/+/, '').replace(/^--\//, '');
    const segments = normalizedPath.split('/').filter(Boolean);

    if (segments[0] !== 'camera' || !segments[1]) {
      return null;
    }

    return {
      inspectionPointId: decodeURIComponent(segments[1]),
      reason: normalizeReason(parsed.searchParams.get('reason')),
      source: 'deep-link',
    };
  } catch {
    return null;
  }
};

export const parseInspectionRouteFromNotificationData = (
  rawData: unknown
): InspectionRouteIntent | null => {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const data = rawData as Record<string, unknown>;
  const routing =
    data.routing && typeof data.routing === 'object'
      ? (data.routing as Record<string, unknown>)
      : null;
  const evidence =
    data.evidence && typeof data.evidence === 'object'
      ? (data.evidence as Record<string, unknown>)
      : null;
  const review =
    data.review && typeof data.review === 'object'
      ? (data.review as Record<string, unknown>)
      : null;

  const routedDeepLink = readString(routing?.deepLink) || readString(data.deepLink);
  if (routedDeepLink) {
    const parsedDeepLink = parseInspectionCameraDeepLink(routedDeepLink);

    if (parsedDeepLink) {
      return {
        ...parsedDeepLink,
        source: 'notification',
        reason:
          parsedDeepLink.reason ??
          normalizeReason(routing?.reason) ??
          normalizeReason(review?.notes),
      };
    }
  }

  const action = readString(routing?.action) || readString(data.action);
  const inspectionPointId =
    readString(routing?.inspectionPointId) ||
    readString(data.inspectionPointId) ||
    readString(evidence?.inspectionPointId);

  if (action !== 'OPEN_EVIDENCE' || !inspectionPointId) {
    return null;
  }

  return {
    inspectionPointId,
    reason: normalizeReason(routing?.reason) ?? normalizeReason(review?.notes),
    source: 'notification',
  };
};
