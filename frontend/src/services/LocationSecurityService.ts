export type ProjectLocation = {
  latitude: number;
  longitude: number;
};

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  isMocked?: boolean | null;
};

export type LocationSecurityIssue =
  | 'missing-location'
  | 'invalid-coordinates'
  | 'poor-accuracy'
  | 'outside-project-radius'
  | 'mocked-location';

export type LocationSecurityResult = {
  allowed: boolean;
  distanceMeters: number | null;
  accuracyOk: boolean;
  withinProjectRadius: boolean;
  spoofRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  issues: LocationSecurityIssue[];
  message: string;
};

type LocationSecurityOptions = {
  projectLocation?: ProjectLocation | null;
  allowedRadiusMeters?: number | null;
  maxAccuracyMeters?: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const isFiniteCoordinate = (value: number) => Number.isFinite(value);

export const calculateDistanceMeters = (
  from: ProjectLocation,
  to: ProjectLocation
) => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
};

export const evaluateLocationSecurity = (
  location: CapturedLocation | null,
  options: LocationSecurityOptions = {}
): LocationSecurityResult => {
  if (!location) {
    return {
      allowed: false,
      distanceMeters: null,
      accuracyOk: false,
      withinProjectRadius: false,
      spoofRisk: 'HIGH',
      issues: ['missing-location'],
      message: 'Geen GPS-fix beschikbaar voor juridische vastlegging.',
    };
  }

  if (
    !isFiniteCoordinate(location.latitude) ||
    !isFiniteCoordinate(location.longitude)
  ) {
    return {
      allowed: false,
      distanceMeters: null,
      accuracyOk: false,
      withinProjectRadius: false,
      spoofRisk: 'HIGH',
      issues: ['invalid-coordinates'],
      message: 'GPS-coordinaten zijn ongeldig en kunnen niet als bewijs dienen.',
    };
  }

  const issues: LocationSecurityIssue[] = [];
  const maxAccuracyMeters = options.maxAccuracyMeters ?? 25;
  const allowedRadiusMeters = options.allowedRadiusMeters ?? 250;
  const accuracyOk =
    location.accuracy == null || location.accuracy <= maxAccuracyMeters;

  if (!accuracyOk) {
    issues.push('poor-accuracy');
  }

  if (location.isMocked) {
    issues.push('mocked-location');
  }

  const distanceMeters = options.projectLocation
    ? calculateDistanceMeters(options.projectLocation, location)
    : null;
  const withinProjectRadius =
    distanceMeters == null || distanceMeters <= allowedRadiusMeters;

  if (!withinProjectRadius) {
    issues.push('outside-project-radius');
  }

  const spoofRisk = location.isMocked
    ? 'HIGH'
    : !accuracyOk || !withinProjectRadius
      ? 'MEDIUM'
      : 'LOW';

  const allowed = issues.length === 0;
  const message = allowed
    ? distanceMeters == null
      ? 'GPS-signaal is bruikbaar voor Wkb-vastlegging.'
      : `GPS-signaal is bruikbaar en valt binnen ${Math.round(distanceMeters)} m van de projectlocatie.`
    : issues.includes('mocked-location')
      ? 'Locatie lijkt gemanipuleerd; Wkb-vastlegging is geblokkeerd.'
      : issues.includes('outside-project-radius')
        ? 'Locatie valt buiten de projectzone; controleer of je op de juiste bouwplaats staat.'
        : issues.includes('poor-accuracy')
          ? 'GPS-nauwkeurigheid is onvoldoende voor juridisch bewijs.'
          : 'Locatiecontrole is niet geslaagd.';

  return {
    allowed,
    distanceMeters,
    accuracyOk,
    withinProjectRadius,
    spoofRisk,
    issues,
    message,
  };
};

// ────────────────────────────────────────────────
// Teleport / speed detection
// ────────────────────────────────────────────────

/** Max physically possible speed in km/h before flagging as teleport */
const MAX_REALISTIC_SPEED_KMH = 300;

interface PositionSnapshot {
  latitude: number;
  longitude: number;
  timestamp: number; // Date.now()
}

let _lastSnapshot: PositionSnapshot | null = null;

/**
 * Controleer of de bewegingssnelheid realistisch is.
 * Geeft 'HIGH' spoof risk terug als de positie in te korte tijd
 * te ver verplaatst is (teleport-detectie).
 */
export function checkTeleportRisk(
  latitude: number,
  longitude: number,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const now = Date.now();
  const snap = _lastSnapshot;
  _lastSnapshot = { latitude, longitude, timestamp: now };

  if (!snap) return 'LOW';

  const elapsedSeconds = (now - snap.timestamp) / 1000;
  if (elapsedSeconds < 1) return 'LOW'; // too short to judge

  const distM = calculateDistanceMeters(
    { latitude: snap.latitude, longitude: snap.longitude },
    { latitude, longitude }
  );
  const speedKmh = (distM / elapsedSeconds) * 3.6;

  if (speedKmh > MAX_REALISTIC_SPEED_KMH) return 'HIGH';
  if (speedKmh > 120) return 'MEDIUM'; // faster than car on motorway while supposedly on a building site
  return 'LOW';
}

/** Reset de snelheidshistorie (bijv. bij app-start of nieuw project) */
export function resetTeleportHistory(): void {
  _lastSnapshot = null;
}
