/**
 * EvidenceSealService — verzegelt bewijsstukken met een SHA-256 hash-keten zodat
 * aantoonbaar is dat een stuk ná vastleggen niet meer is gewijzigd.
 *
 * Achtergrond: bij een Wkb-geschil (art. 7:758 BW) moet de aannemer aantonen dat
 * conform afspraak is gebouwd. Losse foto's zonder onweerlegbaar, vastgelegd
 * moment zijn kwetsbaar. Deze laag verzegelt elk stuk en ketent ze, zodat ook
 * volgorde + compleetheid vaststaan: een ontbrekend of vervangen stuk valt op.
 *
 * Ontwerp:
 * - Pure, offline functies. De hash gaat over een meegegeven `fileDigest` (de
 *   content-hash van het OPGESLAGEN origineel) + de metadata — deze service raakt
 *   de fotopijplijn niet aan en hercomprimeert niets.
 * - De hashfunctie is injecteerbaar (`HashFn`). Default = expo-crypto SHA-256
 *   (cross-platform, offline). Tests injecteren een deterministische hash.
 * - V1: alleen keten + servertijdstempel (sealed_at). Externe RFC-3161 TSA /
 *   anchoring is expliciet V2.
 */

import type * as CryptoTypes from 'expo-crypto';

/** Genesis-verwijzing voor het eerste stuk in een dossier. */
export const GENESIS_PREV_HASH = '';

export type HashFn = (input: string) => Promise<string>;

let cryptoMod: typeof CryptoTypes | null = null;

/** Default: expo-crypto SHA-256 (werkt offline op web + native). Lazy geladen
 *  zodat de native-only module niet bij import-tijd faalt in test/SSR. */
export const defaultHashFn: HashFn = async (input: string) => {
  if (!cryptoMod) {
    cryptoMod = await import('expo-crypto');
  }
  return cryptoMod.digestStringAsync(
    cryptoMod.CryptoDigestAlgorithm.SHA256,
    input
  );
};

/** Vastgelegde metadata die mee in de hash gaat. Volgorde-onafhankelijk: we
 *  serialiseren canoniek (gesorteerde sleutels). */
export interface EvidenceMeta {
  /** Content-hash van het opgeslagen origineel (foto-bestand). */
  fileDigest: string;
  /** ISO-tijdstip van vastleggen. */
  capturedAt: string;
  /** GPS, indien beschikbaar. */
  lat?: number | null;
  lng?: number | null;
  /** Vastleggende gebruiker. */
  userId?: string | null;
  /** Controlepunt waartoe dit bewijs hoort. */
  controlepuntId?: string | null;
}

export interface SealedEntry extends EvidenceMeta {
  chainIndex: number;
  prevHash: string;
  evidenceHash: string;
}

/**
 * Canonieke serialisatie: stabiele, gesorteerde sleutel-volgorde zodat dezelfde
 * inhoud altijd dezelfde string (en dus dezelfde hash) oplevert. `undefined`
 * wordt als `null` genormaliseerd.
 */
export const canonicalize = (meta: EvidenceMeta, prevHash: string): string => {
  const normalized: Record<string, unknown> = {
    fileDigest: meta.fileDigest,
    capturedAt: meta.capturedAt,
    lat: meta.lat ?? null,
    lng: meta.lng ?? null,
    userId: meta.userId ?? null,
    controlepuntId: meta.controlepuntId ?? null,
    prevHash,
  };
  const sortedKeys = Object.keys(normalized).sort();
  return JSON.stringify(normalized, sortedKeys);
};

/**
 * Hasht één bewijsstuk (metadata + prevHash). Werkt offline.
 */
export const hashEvidence = async (
  meta: EvidenceMeta,
  prevHash: string,
  hashFn: HashFn = defaultHashFn
): Promise<string> => hashFn(canonicalize(meta, prevHash));

/**
 * Voegt één stuk toe aan een bestaande keten. prevHash = de evidenceHash van het
 * laatste stuk (of GENESIS voor het eerste). Retourneert het verzegelde stuk.
 */
export const appendToChain = async (
  chain: SealedEntry[],
  meta: EvidenceMeta,
  hashFn: HashFn = defaultHashFn
): Promise<SealedEntry> => {
  const prevHash =
    chain.length === 0 ? GENESIS_PREV_HASH : chain[chain.length - 1].evidenceHash;
  const chainIndex = chain.length;
  const evidenceHash = await hashEvidence(meta, prevHash, hashFn);
  return { ...meta, chainIndex, prevHash, evidenceHash };
};

export interface EntryVerificatie {
  chainIndex: number;
  ongewijzigd: boolean;
  /** Reden bij falen — voor de leesbare uitleg. */
  reden?: string;
}

export interface KetenVerificatie {
  ongeschonden: boolean;
  stuks: EntryVerificatie[];
  /** Korte, niet-technische samenvatting voor opdrachtgever/jurist. */
  samenvatting: string;
}

/**
 * Rekent de hele keten opnieuw na. Per stuk: klopt de opgeslagen hash met een
 * verse herberekening, én verwijst prevHash correct naar het vorige stuk?
 * Een gewijzigd veld of een vervangen/ontbrekend stuk laat dit falen.
 */
export const verifyChain = async (
  chain: SealedEntry[],
  hashFn: HashFn = defaultHashFn
): Promise<KetenVerificatie> => {
  const stuks: EntryVerificatie[] = [];

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const verwachtePrev =
      i === 0 ? GENESIS_PREV_HASH : chain[i - 1].evidenceHash;

    if (entry.chainIndex !== i) {
      stuks.push({
        chainIndex: i,
        ongewijzigd: false,
        reden: `Volgorde klopt niet (index ${entry.chainIndex}, verwacht ${i}).`,
      });
      continue;
    }
    if (entry.prevHash !== verwachtePrev) {
      stuks.push({
        chainIndex: i,
        ongewijzigd: false,
        reden: 'Verwijzing naar vorig bewijsstuk klopt niet (keten verbroken).',
      });
      continue;
    }

    const herberekend = await hashEvidence(entry, entry.prevHash, hashFn);
    if (herberekend !== entry.evidenceHash) {
      stuks.push({
        chainIndex: i,
        ongewijzigd: false,
        reden: 'Inhoud of metadata is na vastleggen gewijzigd.',
      });
      continue;
    }

    stuks.push({ chainIndex: i, ongewijzigd: true });
  }

  const ongeschonden = stuks.every((s) => s.ongewijzigd);
  const aantalGewijzigd = stuks.filter((s) => !s.ongewijzigd).length;
  const samenvatting = ongeschonden
    ? `Alle ${chain.length} bewijsstukken zijn ongewijzigd sinds vastlegging; de keten is intact.`
    : `${aantalGewijzigd} van ${chain.length} bewijsstukken wijkt af — het bewijs is na vastlegging gewijzigd of de volgorde is aangetast.`;

  return { ongeschonden, stuks, samenvatting };
};
