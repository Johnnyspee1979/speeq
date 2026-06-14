/**
 * ControlepuntBibliotheekService — typeahead + synoniem-normalisatie over de
 * gestandaardiseerde controlepunt-bibliotheek.
 *
 * Twee taken:
 *  1. `searchControlepunten(query)` — fuzzy typeahead voor de UI (tolerant voor
 *     typefouten, doorzoekt naam + synoniemen + trefwoorden).
 *  2. `normalizeControlepunt(query)` — zet vrije tekst ("scheurtje") om naar de
 *     één vaste standaardnaam ("Scheurvorming"). Deterministisch: exacte naam-
 *     en synoniem-matches gaan vóór fuzzy.
 *
 * Tenant-eigen controlepunten mogen worden meegegeven; ze worden naast de basis-
 * set doorzocht. Geen AI, geen netwerk — Fuse.js is al een projectdependency.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import {
  CONTROLEPUNT_BIBLIOTHEEK,
  type Controlepunt,
} from '../constants/ControlepuntBibliotheek';

export type { Controlepunt } from '../constants/ControlepuntBibliotheek';

const FUSE_OPTIONS: IFuseOptions<Controlepunt> = {
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'naam', weight: 0.4 },
    { name: 'synoniemen', weight: 0.35 },
    { name: 'trefwoorden', weight: 0.15 },
    { name: 'omschrijving', weight: 0.1 },
  ],
};

/** Lower-case, trim en strip diacritics zodat "craqué" ~ "craque" matcht. */
const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

let cachedBaseIndex: Fuse<Controlepunt> | null = null;

const getBaseIndex = (): Fuse<Controlepunt> => {
  if (!cachedBaseIndex) {
    cachedBaseIndex = new Fuse(CONTROLEPUNT_BIBLIOTHEEK, FUSE_OPTIONS);
  }
  return cachedBaseIndex;
};

const buildIndex = (extra?: Controlepunt[]): Fuse<Controlepunt> => {
  if (!extra || extra.length === 0) {
    return getBaseIndex();
  }
  return new Fuse([...CONTROLEPUNT_BIBLIOTHEEK, ...extra], FUSE_OPTIONS);
};

export interface ControlepuntSearchOptions {
  /** Tenant-eigen controlepunten die naast de basisset doorzocht worden. */
  extra?: Controlepunt[];
  /** Beperk tot één categorie (bijv. de discipline van het borgingspunt). */
  categorie?: Controlepunt['categorie'];
  /** Maximaal aantal resultaten (default 8 — genoeg voor een typeahead). */
  limit?: number;
}

/**
 * Fuzzy typeahead. Lege query geeft de (optioneel gefilterde) volledige lijst,
 * zodat de UI bij focus meteen suggesties kan tonen.
 */
export const searchControlepunten = (
  query: string,
  options: ControlepuntSearchOptions = {}
): Controlepunt[] => {
  const { extra, categorie, limit = 8 } = options;
  const trimmed = query.trim();

  const matchesCategorie = (item: Controlepunt) =>
    !categorie || item.categorie === categorie;

  if (!trimmed) {
    const all = [...CONTROLEPUNT_BIBLIOTHEEK, ...(extra ?? [])];
    return all.filter(matchesCategorie).slice(0, limit);
  }

  const results = buildIndex(extra)
    .search(trimmed)
    .map((result) => result.item)
    .filter(matchesCategorie);

  return results.slice(0, limit);
};

export interface ControlepuntNormalisatie {
  controlepunt: Controlepunt;
  /** 'naam' | 'synoniem' = zekere match; 'fuzzy' = beste gok. */
  via: 'naam' | 'synoniem' | 'fuzzy';
}

/**
 * Zet vrije tekst om naar één gestandaardiseerd controlepunt.
 *
 * Volgorde (deterministisch eerst):
 *  1. Exacte naam-match
 *  2. Exacte synoniem-match
 *  3. Fuzzy beste match
 *
 * Geeft `null` als niets binnen de drempel valt — dan blijft de vrije tekst staan.
 */
export const normalizeControlepunt = (
  query: string,
  options: Pick<ControlepuntSearchOptions, 'extra'> = {}
): ControlepuntNormalisatie | null => {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const needle = normalizeText(trimmed);
  const pool = [...CONTROLEPUNT_BIBLIOTHEEK, ...(options.extra ?? [])];

  const byName = pool.find((item) => normalizeText(item.naam) === needle);
  if (byName) {
    return { controlepunt: byName, via: 'naam' };
  }

  const bySynonym = pool.find((item) =>
    item.synoniemen.some((syn) => normalizeText(syn) === needle)
  );
  if (bySynonym) {
    return { controlepunt: bySynonym, via: 'synoniem' };
  }

  const [best] = buildIndex(options.extra).search(trimmed);
  if (best) {
    return { controlepunt: best.item, via: 'fuzzy' };
  }

  return null;
};

/** Snelkoppeling: de gestandaardiseerde naam, of `null` als niets matcht. */
export const standaardiseerControlepuntNaam = (
  query: string,
  options: Pick<ControlepuntSearchOptions, 'extra'> = {}
): string | null => normalizeControlepunt(query, options)?.controlepunt.naam ?? null;
