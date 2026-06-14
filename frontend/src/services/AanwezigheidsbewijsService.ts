/**
 * AanwezigheidsbewijsService — "vastgelegd op locatie"-laag bovenop de bestaande
 * controlepunten. Geeft een eerlijk, controleerbaar spoor van waar/wanneer een
 * controle is vastgelegd. GEEN juridisch hardgemaakt bewijs, GEEN tracking — een
 * momentopname op het bewuste vastlegmoment.
 *
 * Aanleiding: de Wkb-evaluatie 2026 bekritiseert dat niet aantoonbaar is dát de
 * controle op de bouwplaats gebeurde. Deze laag dicht die flank zonder meer te
 * suggereren dan we waar kunnen maken.
 *
 * Zuiver: beoordelen + formatteren + klok-afwijking detecteren. Opslag/sync/UI
 * zit eromheen.
 */

/** Apparaat-tijd mag max zoveel van de server-tijd afwijken voor "betrouwbaar". */
export const KLOK_AFWIJKING_DREMPEL_SEC = 5 * 60; // 5 minuten

/** Nauwkeurigheidsgrenzen in meters. */
export const NAUWKEURIGHEID_GOED_M = 20;
export const NAUWKEURIGHEID_MATIG_M = 50;

export type AanwezigheidsStatus = 'OP_LOCATIE' | 'ZONDER_LOCATIE';
export type AanwezigheidsKleur = 'groen' | 'oranje' | 'grijs';
export type Nauwkeurigheid = 'goed' | 'matig' | 'laag' | 'onbekend';

export interface AanwezigheidsInput {
  /** Heeft de aannemer locatie toegestaan voor dit project? */
  toestemming: boolean;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  /** Tijd volgens het apparaat bij vastleggen (ISO). */
  deviceTime: string;
  /** Server-ontvangsttijd bij sync (ISO). Null zolang niet gesynct. */
  serverTime?: string | null;
}

export interface Klokafwijking {
  /** Absolute afwijking in seconden (0 als server-tijd ontbreekt). */
  afwijkingSec: number;
  /** Overschrijdt de afwijking de drempel? */
  significant: boolean;
  /** Bekend = er was een server-tijd om mee te vergelijken. */
  bekend: boolean;
}

export interface Aanwezigheidsbewijs {
  status: AanwezigheidsStatus;
  kleur: AanwezigheidsKleur;
  nauwkeurigheid: Nauwkeurigheid;
  klok: Klokafwijking;
  /** Korte nuance-regel; nooit een juridische claim. */
  nuance: string;
}

/** Detecteert een afwijking tussen apparaat- en server-tijd. */
export const detecteerKlokafwijking = (
  deviceTimeISO: string,
  serverTimeISO?: string | null
): Klokafwijking => {
  if (!serverTimeISO) {
    return { afwijkingSec: 0, significant: false, bekend: false };
  }
  const afwijkingSec = Math.round(
    Math.abs(
      new Date(deviceTimeISO).getTime() - new Date(serverTimeISO).getTime()
    ) / 1000
  );
  return {
    afwijkingSec,
    significant: afwijkingSec > KLOK_AFWIJKING_DREMPEL_SEC,
    bekend: true,
  };
};

const beoordeelNauwkeurigheid = (accuracyM?: number | null): Nauwkeurigheid => {
  if (accuracyM == null) return 'onbekend';
  if (accuracyM <= NAUWKEURIGHEID_GOED_M) return 'goed';
  if (accuracyM <= NAUWKEURIGHEID_MATIG_M) return 'matig';
  return 'laag';
};

const heeftLocatie = (input: AanwezigheidsInput): boolean =>
  input.toestemming && input.lat != null && input.lng != null;

/**
 * Beoordeelt het aanwezigheidsbewijs. Zonder toestemming of GPS → ZONDER_LOCATIE
 * (nooit blokkeren). Met locatie → kleur op basis van nauwkeurigheid + klok.
 */
export const beoordeelAanwezigheid = (
  input: AanwezigheidsInput
): Aanwezigheidsbewijs => {
  const klok = detecteerKlokafwijking(input.deviceTime, input.serverTime);

  if (!heeftLocatie(input)) {
    return {
      status: 'ZONDER_LOCATIE',
      kleur: 'grijs',
      nauwkeurigheid: 'onbekend',
      klok,
      nuance: 'Zonder locatiebewijs vastgelegd.',
    };
  }

  const nauwkeurigheid = beoordeelNauwkeurigheid(input.accuracyM);
  const zwakkeNauwkeurigheid = nauwkeurigheid === 'matig' || nauwkeurigheid === 'laag';
  const kleur: AanwezigheidsKleur =
    klok.significant || zwakkeNauwkeurigheid ? 'oranje' : 'groen';

  let nuance = 'Vastgelegd op locatie — een controleerbaar spoor, geen juridisch bewijs.';
  if (klok.significant) {
    nuance = 'Vastgelegd op locatie; apparaat-tijd wijkt af van servertijd — tijd onder voorbehoud.';
  } else if (nauwkeurigheid === 'laag') {
    nuance = 'Vastgelegd op locatie; GPS-nauwkeurigheid is laag.';
  }

  return { status: 'OP_LOCATIE', kleur, nauwkeurigheid, klok, nuance };
};

const NL_MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/** Deterministische NL-datum/tijd in UTC: "8 juni 2026 10:14". */
const formatNlDatumTijd = (iso: string): string => {
  const d = new Date(iso);
  const dag = d.getUTCDate();
  const maand = NL_MAANDEN[d.getUTCMonth()];
  const jaar = d.getUTCFullYear();
  const uu = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dag} ${maand} ${jaar} ${uu}:${mm}`;
};

/**
 * Bouwt de badge-regel. Met locatie:
 *   "op locatie vastgelegd · 8 juni 2026 10:14 · ±8 m"
 * Zonder locatie:
 *   "zonder locatiebewijs · 8 juni 2026 10:14"
 */
export const formatAanwezigheidsBadge = (
  input: AanwezigheidsInput,
  bewijs: Aanwezigheidsbewijs = beoordeelAanwezigheid(input)
): string => {
  const tijd = formatNlDatumTijd(input.deviceTime);
  if (bewijs.status === 'ZONDER_LOCATIE') {
    return `zonder locatiebewijs · ${tijd}`;
  }
  const acc =
    input.accuracyM != null ? ` · ±${Math.round(input.accuracyM)} m` : '';
  const voorbehoud = bewijs.klok.significant ? ' · tijd onder voorbehoud' : '';
  return `op locatie vastgelegd · ${tijd}${acc}${voorbehoud}`;
};
