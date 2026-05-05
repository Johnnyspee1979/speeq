/**
 * OneDriveSyncService — synchroniseert borgingsbewijzen naar Microsoft OneDrive.
 *
 * Gebruikt MSAL (Microsoft Authentication Library) voor OAuth login.
 * Vereist een Azure App-registratie met Client ID in EXPO_PUBLIC_AZURE_CLIENT_ID.
 *
 * Flow:
 *   1. Gebruiker klikt "🔵 Koppel OneDrive"
 *   2. Microsoft login-popup verschijnt
 *   3. Gebruiker logt in met werk- of privé-Microsoft account
 *   4. App krijgt toegang tot OneDrive
 *   5. Foto's worden geupload naar: OneDrive/WKB-Dossiers/[Project]/[Borgingspunt]/
 *   6. Automatisch bij elke nieuwe foto (via Realtime)
 *
 * Mappenstructuur in OneDrive:
 *   WKB-Dossiers/
 *     └── ProjectNaam/
 *         └── kik-wapening-001/
 *             ├── 2025-05-02_14-32_foto_abc123.jpg
 *             └── 2025-05-02_14-32_notitie_abc123.txt
 */

import {
  PublicClientApplication,
  type AuthenticationResult,
  type Configuration,
  InteractionRequiredAuthError,
  BrowserAuthError,
} from '@azure/msal-browser';

// ─── Configuratie ─────────────────────────────────────────────────────────────

const CLIENT_ID   = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID ?? '';
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : '';
const GRAPH_BASE  = 'https://graph.microsoft.com/v1.0';

/** OneDrive root-map voor alle WKB-dossiers */
const WKB_ROOT    = 'WKB-Dossiers';

const SCOPES      = ['Files.ReadWrite', 'User.Read'];

// ─── MSAL instantie (singleton) ──────────────────────────────────────────────

let _msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (_msalInstance) return _msalInstance;

  const config: Configuration = {
    auth: {
      clientId:    CLIENT_ID,
      authority:   'https://login.microsoftonline.com/common',
      redirectUri: REDIRECT_URI,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
  };

  _msalInstance = new PublicClientApplication(config);
  return _msalInstance;
}

// ─── Feature detection ────────────────────────────────────────────────────────

export function isOneDriveConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.length > 10);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Haalt een geldig access token op (silent of via popup). */
async function getAccessToken(): Promise<string | null> {
  const msal     = getMsalInstance();
  await msal.initialize();
  const accounts = msal.getAllAccounts();

  // Silent token refresh
  if (accounts.length > 0) {
    try {
      const result = await msal.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
      return result.accessToken;
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
    }
  }

  // Popup login
  try {
    const result: AuthenticationResult = await msal.acquireTokenPopup({ scopes: SCOPES });
    return result.accessToken;
  } catch (err) {
    if (err instanceof BrowserAuthError && err.errorCode === 'user_cancelled') return null;
    throw err;
  }
}

/** Geeft de naam van het ingelogde Microsoft-account terug, of null. */
export async function getOneDriveAccountName(): Promise<string | null> {
  if (!isOneDriveConfigured()) return null;
  try {
    const msal = getMsalInstance();
    await msal.initialize();
    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) return null;
    return accounts[0].name ?? accounts[0].username ?? null;
  } catch {
    return null;
  }
}

/** Logt de gebruiker in bij Microsoft. Geeft accountnaam terug bij succes. */
export async function connectOneDrive(): Promise<string | null> {
  if (!isOneDriveConfigured()) return null;
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const msal    = getMsalInstance();
    await msal.initialize();
    const accounts = msal.getAllAccounts();
    return accounts[0]?.name ?? accounts[0]?.username ?? 'Microsoft account';
  } catch {
    return null;
  }
}

/** Logt de gebruiker uit bij Microsoft. */
export async function disconnectOneDrive(): Promise<void> {
  if (!isOneDriveConfigured()) return;
  try {
    const msal = getMsalInstance();
    await msal.initialize();
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      await msal.logoutPopup({ account: accounts[0] });
    }
  } catch { /* stil */ }
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

async function graphFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Upload een bestand naar OneDrive via een upload-sessie (werkt voor grote bestanden).
 * Pad voorbeeld: "WKB-Dossiers/ProjectNaam/borgingspunt/foto.jpg"
 */
async function uploadFile(
  token: string,
  oneDrivePath: string,
  content: ArrayBuffer | Blob,
  contentType: string
): Promise<boolean> {
  const encodedPath = oneDrivePath.split('/').map(encodeURIComponent).join('/');

  // Kleine bestanden (< 4 MB) → directe upload
  const size = content instanceof Blob ? content.size : content.byteLength;

  if (size < 4 * 1024 * 1024) {
    const res = await graphFetch(
      token,
      `/me/drive/root:/${encodedPath}:/content`,
      {
        method:  'PUT',
        headers: { 'Content-Type': contentType },
        body:    content,
      }
    );
    return res.ok;
  }

  // Grote bestanden → upload-sessie
  const sessionRes = await graphFetch(
    token,
    `/me/drive/root:/${encodedPath}:/createUploadSession`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    }
  );

  if (!sessionRes.ok) return false;
  const { uploadUrl } = await sessionRes.json() as { uploadUrl: string };

  const buf    = content instanceof Blob ? await content.arrayBuffer() : content;
  const chunk  = 4 * 1024 * 1024; // 4 MB per chunk

  for (let start = 0; start < buf.byteLength; start += chunk) {
    const end    = Math.min(start + chunk - 1, buf.byteLength - 1);
    const slice  = buf.slice(start, end + 1);
    const res    = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        'Content-Length': String(end - start + 1),
        'Content-Range':  `bytes ${start}-${end}/${buf.byteLength}`,
        'Content-Type':   contentType,
      },
      body: slice,
    });
    if (!res.ok && res.status !== 202) return false;
  }

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeName(name: string): string {
  return (name ?? 'onbekend').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'onbekend';
}

function stampToFilename(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'PASSED':       return '✅ Goedgekeurd';
    case 'FAILED':       return '❌ Afgekeurd';
    case 'NEEDS_REVIEW': return '⚠️ Review vereist';
    default:             return '○ Onbekend';
  }
}

// ─── Evidence type ────────────────────────────────────────────────────────────

export interface OneDriveEvidenceRow {
  id: string;
  inspection_point_id: string;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string;
  ai_status: string | null;
  ai_notes: string | null;
  field_note: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

export interface OneDriveSyncResult {
  ok: boolean;
  synced: number;
  skipped: number;
  errors: string[];
  notConfigured?: boolean;
  authFailed?: boolean;
}

// ─── Hoofd sync functie ───────────────────────────────────────────────────────

/**
 * Synchroniseert evidence naar OneDrive.
 * Bestanden die al bestaan worden overschreven met de nieuwste status.
 */
export async function syncToOneDrive(
  projectName: string,
  items: OneDriveEvidenceRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<OneDriveSyncResult> {

  if (!isOneDriveConfigured()) {
    return { ok: false, synced: 0, skipped: 0, errors: [], notConfigured: true };
  }

  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch { /* negeer */ }

  if (!token) {
    return { ok: false, synced: 0, skipped: 0, errors: [], authFailed: true };
  }

  const safeProject = safeName(projectName);
  let synced  = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item    = items[i];
    const stamp   = stampToFilename(item.timestamp);
    const shortId = item.id.slice(0, 8);
    const folder  = `${WKB_ROOT}/${safeProject}/${safeName(item.inspection_point_id)}`;

    try {
      const photoUrl = item.media_uri ?? item.photo_uri ?? null;

      // ── Foto ──
      if (photoUrl) {
        const res = await fetch(photoUrl);
        if (res.ok) {
          const buf     = await res.arrayBuffer();
          const ok      = await uploadFile(
            token,
            `${folder}/${stamp}_foto_${shortId}.jpg`,
            buf,
            'image/jpeg'
          );
          if (ok) synced++; else skipped++;
        } else {
          skipped++;
        }
      }

      // ── Notitie ──
      const hasNote = item.field_note || item.ai_notes || item.ai_status;
      if (hasNote) {
        let txt  = `Borgingspunt : ${item.inspection_point_id}\n`;
        txt += `Tijdstip     : ${new Date(item.timestamp).toLocaleString('nl-NL')}\n`;
        txt += `Status       : ${statusLabel(item.ai_status)}\n`;
        if (item.field_note)  txt += `\nNotitie vakman:\n${item.field_note}\n`;
        if (item.ai_notes)    txt += `\nAI beoordeling:\n${item.ai_notes}\n`;
        if (item.gps_lat && item.gps_lng) {
          txt += `\nGPS: https://maps.google.com/?q=${item.gps_lat},${item.gps_lng}\n`;
        }

        await uploadFile(
          token,
          `${folder}/${stamp}_notitie_${shortId}.txt`,
          new Blob([txt], { type: 'text/plain' }),
          'text/plain'
        );
      }

    } catch (err) {
      errors.push(`${shortId}: ${err instanceof Error ? err.message : 'fout'}`);
    }

    onProgress?.(i + 1, items.length);
  }

  return { ok: true, synced, skipped, errors };
}
