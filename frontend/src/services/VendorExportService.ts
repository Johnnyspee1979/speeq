/**
 * VendorExportService — vendor-neutrale WKB-dossier-export. Bundelt een compleet
 * projectdossier zonder leverancier-lock-in: een open `dossier.json`, een
 * `manifest.txt` met SHA-256-hashes, de originele bijlagen en (eromheen) een
 * `dossier.pdf`. Belofte: jouw dossier, jouw data, in één klik overdraagbaar.
 *
 * Zuiver: bouwt de open JSON + het manifest. De hashfunctie is injecteerbaar
 * (HashFn, default expo-crypto SHA-256, lazy). Ontbrekende/corrupte bijlagen
 * stoppen de export niet — ze worden zichtbaar genoteerd. ZIP/PDF-assemblage,
 * achtergrond-job en audit-log zitten eromheen.
 *
 * Zie docs/export-schema.md voor het schema.
 */

import type * as CryptoTypes from 'expo-crypto';

export const EXPORT_SCHEMA_VERSIE = 'speeq-wkb-export/1.0';

export type HashFn = (input: string) => Promise<string>;

let cryptoMod: typeof CryptoTypes | null = null;

/** Default SHA-256 via expo-crypto (offline, cross-platform). Lazy geladen. */
export const defaultHashFn: HashFn = async (input: string) => {
  if (!cryptoMod) {
    cryptoMod = await import('expo-crypto');
  }
  return cryptoMod.digestStringAsync(cryptoMod.CryptoDigestAlgorithm.SHA256, input);
};

// ── Vendor-neutraal datamodel ────────────────────────────────────────────────

export type ExportStatus = 'akkoord' | 'in_behandeling' | 'afgekeurd' | 'onbekend';

export interface ExportProject {
  id: string;
  naam: string;
  adres?: string | null;
  opdrachtgever?: string | null;
  gevolgklasse?: string | null;
  projecttype?: string | null;
}

export interface ExportControlepunt {
  id: string;
  omschrijving: string;
  status: ExportStatus;
  discipline?: string | null;
  vastlegdatum?: string | null;
  verantwoordelijke?: string | null;
  locatie?: { lat: number; lng: number } | null;
  fotos: string[];
}

export interface ExportAfwijking {
  omschrijving: string;
  herstelactie?: string | null;
  opgelostAt?: string | null;
}

export interface ExportBijlage {
  bestandsnaam: string;
  type?: string | null;
  beschrijving?: string | null;
}

export interface DossierJson {
  schemaVersie: typeof EXPORT_SCHEMA_VERSIE;
  gegenereerdAt: string;
  project: ExportProject;
  risicobeoordeling?: string | null;
  borgingsplan?: string | null;
  controlepunten: ExportControlepunt[];
  afwijkingen: ExportAfwijking[];
  bijlagen: ExportBijlage[];
}

export interface DossierBron {
  project: ExportProject;
  risicobeoordeling?: string | null;
  borgingsplan?: string | null;
  controlepunten?: ExportControlepunt[];
  afwijkingen?: ExportAfwijking[];
  bijlagen?: ExportBijlage[];
}

/** Normaliseert een ruwe review-status naar de vendor-neutrale exportstatus. */
export const normaliseerStatus = (raw: string | null | undefined): ExportStatus => {
  switch (raw) {
    case 'APPROVED':
    case 'FINALIZED':
    case 'akkoord':
      return 'akkoord';
    case 'PENDING_REVIEW':
    case 'in_behandeling':
      return 'in_behandeling';
    case 'REJECTED':
    case 'afgekeurd':
      return 'afgekeurd';
    default:
      return 'onbekend';
  }
};

/** Bouwt de open, machine-leesbare dossier.json. Deterministisch van vorm. */
export const bouwDossierJson = (
  bron: DossierBron,
  gegenereerdAt: string = new Date().toISOString()
): DossierJson => ({
  schemaVersie: EXPORT_SCHEMA_VERSIE,
  gegenereerdAt,
  project: bron.project,
  risicobeoordeling: bron.risicobeoordeling ?? null,
  borgingsplan: bron.borgingsplan ?? null,
  controlepunten: bron.controlepunten ?? [],
  afwijkingen: bron.afwijkingen ?? [],
  bijlagen: bron.bijlagen ?? [],
});

// ── Manifest met SHA-256 ─────────────────────────────────────────────────────

export type BestandStatus = 'OK' | 'ONTBREEKT' | 'CORRUPT';

/**
 * Eén bestand voor het manifest. `inhoud` is de te hashen content (string-vorm
 * van de bytes); `null` = bijlage niet gevonden → ONTBREEKT. Een leesfout zet
 * `status: 'CORRUPT'`. Beide stoppen de export niet.
 */
export interface ManifestBron {
  pad: string;
  inhoud: string | null;
  status?: BestandStatus;
}

export interface ManifestRegel {
  pad: string;
  sha256: string;
  bytes: number;
  status: BestandStatus;
}

const byteLengte = (s: string): number => {
  // Werkt zonder Buffer/TextEncoder-afhankelijkheid in alle runtimes.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  return unescape(encodeURIComponent(s)).length;
};

/**
 * Bouwt de manifest-regels met SHA-256 per bestand. Ontbrekende inhoud → een
 * ONTBREEKT-regel met lege hash; expliciet als CORRUPT gemarkeerde bestanden
 * krijgen ook een lege hash. De export gaat door — integriteit wordt zichtbaar.
 */
export const bouwManifest = async (
  bestanden: ManifestBron[],
  hashFn: HashFn = defaultHashFn
): Promise<ManifestRegel[]> => {
  const regels: ManifestRegel[] = [];
  for (const b of bestanden) {
    if (b.inhoud == null || b.status === 'ONTBREEKT') {
      regels.push({ pad: b.pad, sha256: '', bytes: 0, status: 'ONTBREEKT' });
      continue;
    }
    if (b.status === 'CORRUPT') {
      regels.push({ pad: b.pad, sha256: '', bytes: byteLengte(b.inhoud), status: 'CORRUPT' });
      continue;
    }
    const sha256 = await hashFn(b.inhoud);
    regels.push({ pad: b.pad, sha256, bytes: byteLengte(b.inhoud), status: 'OK' });
  }
  return regels;
};

/** Serialiseert de manifest-regels naar manifest.txt-vorm. */
export const formatManifest = (regels: ManifestRegel[]): string =>
  regels
    .map((r) => `${r.sha256 || '-'}  ${r.bytes}  ${r.status}  ${r.pad}`)
    .join('\n');

/** Korte samenvatting voor de UI/audit: hoeveel OK / ontbrekend / corrupt. */
export const vatManifestSamen = (
  regels: ManifestRegel[]
): { ok: number; ontbreekt: number; corrupt: number; totaal: number } => ({
  ok: regels.filter((r) => r.status === 'OK').length,
  ontbreekt: regels.filter((r) => r.status === 'ONTBREEKT').length,
  corrupt: regels.filter((r) => r.status === 'CORRUPT').length,
  totaal: regels.length,
});
