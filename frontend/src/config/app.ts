const rawBackendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000').trim();
const rawDefaultProjectId = (process.env.EXPO_PUBLIC_DEFAULT_PROJECT_ID ?? '104A').trim();
const rawExpoProjectId = (process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '').trim();
const rawProjectLatitude = (process.env.EXPO_PUBLIC_PROJECT_LATITUDE ?? '').trim();
const rawProjectLongitude = (process.env.EXPO_PUBLIC_PROJECT_LONGITUDE ?? '').trim();
const rawProjectRadiusMeters = (process.env.EXPO_PUBLIC_PROJECT_RADIUS_METERS ?? '250').trim();
const rawLocationAccuracyMeters = (
  process.env.EXPO_PUBLIC_LOCATION_MAX_ACCURACY_METERS ?? '25'
).trim();
const rawWkbProjectKind = (process.env.EXPO_PUBLIC_WKB_PROJECT_KIND ?? 'NIEUWBOUW').trim();
const rawWkbVergunningplichtig = (
  process.env.EXPO_PUBLIC_WKB_VERGUNNINGPLICHTIG ?? 'true'
).trim();
const rawWkbIllegalExistingBuild = (
  process.env.EXPO_PUBLIC_WKB_ILLEGAL_EXISTING_BUILD ?? 'false'
).trim();
const rawWkbKwaliteitsborgerIndependent = (
  process.env.EXPO_PUBLIC_WKB_KWALITEITSBORGER_INDEPENDENT ?? ''
).trim();

const parseNumber = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalBoolean = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (['true', '1', 'yes', 'ja'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'nee'].includes(normalized)) {
    return false;
  }

  return null;
};

const normalizeProjectKind = (value: string) => {
  const normalized = value.trim().toUpperCase();

  if (['VERBOUW', 'RENOVATIE', 'RENOVATION'].includes(normalized)) {
    return 'VERBOUW' as const;
  }

  if (['NIEUWBOUW', 'NEW_BUILD', 'NEWBUILD'].includes(normalized)) {
    return 'NIEUWBOUW' as const;
  }

  return 'ONBEKEND' as const;
};

export const APP_SCHEME = 'wkb-snap-sync';
export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');
export const DEFAULT_PROJECT_ID = rawDefaultProjectId || '104A';
export const EXPO_PROJECT_ID = rawExpoProjectId;
export const DEFAULT_PROJECT_NAME =
  (process.env.EXPO_PUBLIC_PROJECT_NAME ?? `Wkb Dossier ${DEFAULT_PROJECT_ID}`).trim() ||
  `Wkb Dossier ${DEFAULT_PROJECT_ID}`;
export const DEFAULT_GEVOLGKLASSE =
  (process.env.EXPO_PUBLIC_GEVOLGKLASSE ?? '1').trim() || '1';
export const DEFAULT_KWALITEITSBORGER =
  (process.env.EXPO_PUBLIC_KWALITEITSBORGER ?? '').trim();
export const APP_TITLE = `Wkb Snap & Sync - ${DEFAULT_PROJECT_ID}`;
export const PROJECT_LOCATION =
  parseNumber(rawProjectLatitude) != null && parseNumber(rawProjectLongitude) != null
    ? {
        latitude: parseNumber(rawProjectLatitude) as number,
        longitude: parseNumber(rawProjectLongitude) as number,
      }
    : null;
export const PROJECT_RADIUS_METERS = parseNumber(rawProjectRadiusMeters) ?? 250;
export const LOCATION_MAX_ACCURACY_METERS =
  parseNumber(rawLocationAccuracyMeters) ?? 25;
export const WKB_PROJECT_KIND = normalizeProjectKind(rawWkbProjectKind);
export const WKB_VERGUNNINGPLICHTIG = parseOptionalBoolean(rawWkbVergunningplichtig);
export const WKB_ILLEGAL_EXISTING_BUILD = parseOptionalBoolean(
  rawWkbIllegalExistingBuild
);
export const WKB_KWALITEITSBORGER_ASSIGNED = DEFAULT_KWALITEITSBORGER.trim().length > 0;
export const WKB_KWALITEITSBORGER_INDEPENDENT = parseOptionalBoolean(
  rawWkbKwaliteitsborgerIndependent
);
