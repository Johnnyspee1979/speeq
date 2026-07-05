/**
 * ShareLinkService — read-only deellink per project voor de kwaliteitsborger.
 *
 * Context: de gemeente heeft via het Omgevingsloket alleen verbinding met de
 * aanvrager, niet met de borger. De aannemer overbrugt dat. Een token-gebaseerde,
 * read-only projectkijk laat de borger live meekijken zónder SpeeQ-account.
 *
 * Veiligheid (essentieel):
 * - Het token geeft NOOIT schrijfrechten. De ontvanger leest alleen het ENE
 *   gedeelde project — afgedwongen server-side door een security-definer RPC die
 *   strikt op `project_id` van het token filtert (zie migratie
 *   20260614_borger_deellink.sql). Geen service-keys of write-tokens in client.
 * - Altijd token + vervaldatum + intrekbaar; geen publieke, niet-verlopende links.
 * - Tenant-isolatie + AVG: de link toont nooit meer dan het gedeelde project; EU-
 *   hosting blijft intact (geen data buiten Supabase Frankfurt).
 *
 * Deze service is zuiver: tokengeneratie (injecteerbare RNG, default expo-crypto),
 * vervaldatum-berekening en geldigheidsbeoordeling. Netwerk/DB zit in de laag
 * eromheen.
 */

/** Standaard geldigheidsduur van een deellink, in dagen. */
export const DEFAULT_GELDIGHEID_DAGEN = 14;

const MS_PER_DAG = 24 * 60 * 60 * 1000;

export type RandomBytesFn = (n: number) => Promise<Uint8Array>;

/** Default: cryptografisch veilige random bytes via expo-crypto (lazy geladen). */
export const defaultRandomBytes: RandomBytesFn = async (n: number) => {
  const Crypto = await import('expo-crypto');
  return Crypto.getRandomBytesAsync(n);
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Genereert een ondoordringbaar deeltoken (256-bit, hex). Injecteerbare RNG voor
 * tests; default = expo-crypto.
 */
export const genereerDeeltoken = async (
  rng: RandomBytesFn = defaultRandomBytes
): Promise<string> => toHex(await rng(32));

/** Vervaldatum = aanmaakmoment + geldigheidsduur (ISO). */
export const berekenVervaldatum = (
  createdAtISO: string,
  geldigheidsDagen: number = DEFAULT_GELDIGHEID_DAGEN
): string =>
  new Date(
    new Date(createdAtISO).getTime() + geldigheidsDagen * MS_PER_DAG
  ).toISOString();

export interface ShareLink {
  token: string;
  projectId: string;
  expiresAt: string;
  /** Gezet zodra de KEYUSER de link intrekt. */
  revokedAt?: string | null;
}

export type DeellinkReden = 'GELDIG' | 'VERLOPEN' | 'INGETROKKEN';

export interface DeellinkOordeel {
  geldig: boolean;
  reden: DeellinkReden;
  /** Niet-technische boodschap voor het ontvanger-scherm. */
  boodschap: string;
}

/**
 * Beoordeelt of een deellink nu nog bruikbaar is. Ingetrokken wint van verlopen
 * (een ingetrokken link is bewust dichtgezet).
 */
export const beoordeelDeellink = (
  link: Pick<ShareLink, 'expiresAt' | 'revokedAt'>,
  nuISO: string
): DeellinkOordeel => {
  if (link.revokedAt) {
    return {
      geldig: false,
      reden: 'INGETROKKEN',
      boodschap: 'Deze deellink is ingetrokken en niet meer beschikbaar.',
    };
  }
  if (new Date(nuISO).getTime() >= new Date(link.expiresAt).getTime()) {
    return {
      geldig: false,
      reden: 'VERLOPEN',
      boodschap: 'Deze deellink is verlopen. Vraag de aannemer om een nieuwe link.',
    };
  }
  return {
    geldig: true,
    reden: 'GELDIG',
    boodschap: 'Live meekijken met dit project (alleen-lezen).',
  };
};

/** Bouwt de deel-URL voor een token op een gegeven basis-URL. */
export const bouwDeelUrl = (basisUrl: string, token: string): string => {
  const schoon = basisUrl.replace(/\/+$/, '');
  return `${schoon}/deel/${token}`;
};
