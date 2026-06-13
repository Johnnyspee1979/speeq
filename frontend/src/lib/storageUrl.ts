/**
 * storageUrl — zet opgeslagen storage-referenties om naar tóónbare URLs.
 *
 * ACHTERGROND
 * De buckets gaan van publiek → privé. Voortaan bewaren we bij upload het
 * BESTANDSPAD in de DB (niet meer een permanente publieke URL, want signed
 * URLs verlopen). Bij het OPHALEN tekenen we het pad on-demand tot een
 * kortlevende signed URL. Zo blijven de bestanden afgeschermd, maar zien de
 * schermen gewoon een `uri` die werkt.
 *
 * BACKWARD-COMPATIBLE
 * Oude rijen bevatten nog een volledige URL (of demo-/externe URLs, of lokale
 * file://-paden in offline-mode). Die laten we ongemoeid — alleen "kale" paden
 * worden getekend. Daardoor kan de migratie per upload-plek geleidelijk en
 * breekt er niets terwijl de buckets nog publiek staan.
 */

import { supabase } from './supabase';

const DEFAULT_TTL_SECONDS = 3600; // 1 uur

/**
 * Een waarde die we NIET moeten tekenen: al een volledige URL, een lokaal
 * bestand (offline-mode), een blob/data-URI, of leeg.
 */
const isPassthrough = (value: string): boolean =>
  value.startsWith('http://') ||
  value.startsWith('https://') ||
  value.startsWith('file://') ||
  value.startsWith('blob:') ||
  value.startsWith('data:') ||
  value.startsWith('local://');

/**
 * Teken één opgeslagen referentie. Een volledige/lokale URL komt onveranderd
 * terug; een kaal pad wordt een signed URL. Faalt het tekenen, dan vallen we
 * terug op de ruwe waarde (liever een mogelijk-werkende URL dan een lege plek).
 */
export async function resolveStorageUrl(
  bucket: string,
  value: string | null | undefined,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string | null | undefined> {
  if (!value || isPassthrough(value)) return value;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(value, ttlSeconds);

  if (error || !data?.signedUrl) {
    console.warn('[storageUrl] signen faalde voor', value, error);
    return value;
  }

  return data.signedUrl;
}

/**
 * Teken een lijst referenties in één batch (één netwerk-call per bucket).
 * Houdt de volgorde aan; passthrough-waarden blijven op hun plek staan.
 */
export async function resolveStorageUrls(
  bucket: string,
  values: Array<string | null | undefined>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<Array<string | null | undefined>> {
  const paths = Array.from(
    new Set(
      values.filter(
        (v): v is string => typeof v === 'string' && v.length > 0 && !isPassthrough(v),
      ),
    ),
  );

  if (paths.length === 0) return values;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, ttlSeconds);

  const signed = new Map<string, string>();
  if (!error && data) {
    for (const item of data) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  } else if (error) {
    console.warn('[storageUrl] batch-signen faalde', error);
  }

  return values.map((v) => (typeof v === 'string' && signed.has(v) ? signed.get(v)! : v));
}
