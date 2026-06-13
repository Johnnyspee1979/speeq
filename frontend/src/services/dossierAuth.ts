/**
 * dossierAuth — hulpfuncties om dossier-downloads achter auth te krijgen.
 *
 * De dossier-routes (/api/wkb-dossier/*) vereisen nu een Supabase-JWT. Een
 * gewone `window.open(url)` kan echter geen Authorization-header meesturen.
 * Daarom:
 *   - `authHeader()`            → Bearer-header (gooit NL-fout zonder sessie)
 *   - `openPdfInNewTab(url)`    → web: haalt de PDF mét token op als blob en
 *                                 opent die in een nieuw tabblad; geeft de
 *                                 blob-URL terug (voor later opnieuw openen).
 * Native (Expo) `FileSystem.downloadAsync` ondersteunt wél een headers-optie;
 * daar volstaat `{ headers: await authHeader() }` op de call-site.
 */

import { supabase } from '../lib/supabase';

export const authHeader = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Je bent niet (meer) ingelogd. Log opnieuw in om het dossier te openen.');
  }
  return { Authorization: `Bearer ${token}` };
};

/**
 * Haalt een PDF met token op en opent die in een nieuw tabblad (alleen web).
 * Retourneert de blob-URL zodat de aanroeper 'm kan bewaren/hergebruiken.
 */
export const openPdfInNewTab = async (url: string): Promise<string> => {
  const response = await fetch(url, { headers: await authHeader() });
  if (!response.ok) {
    // Probeer een nette server-melding te lezen; val anders terug op status.
    let message = `Dossier ophalen mislukt (${response.status}).`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      /* geen JSON-body; behoud de status-melding */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  return blobUrl;
};
