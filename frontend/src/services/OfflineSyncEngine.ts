/**
 * OfflineSyncEngine — Week 3 van de Offline-Mode roadmap.
 *
 * Verwerkt de lokale sync_queue (uit offlineDb.ts) en push wijzigingen
 * naar Supabase zodra er netwerk is. Implementeert:
 *
 *  - Online/offline detectie (NetInfo + browser-events fallback)
 *  - Batch-processing met exponential backoff bij fouten
 *  - Last-Write-Wins (LWW) conflict-resolution via client_version
 *  - Idempotency-keys (evidence_uuid) — voorkomt duplicates bij retry
 *  - Subscribe-pattern voor sync-status UI (week 4)
 *  - Manuele trigger via syncNow()
 *
 * NIET te verwarren met SyncEngine.ts — die is voor de bestaande cloud-mode
 * (presets + evidence-queue vanuit oude local DB). Deze engine werkt
 * specifiek voor de Dual-Mode offline_mode toggle.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (sectie 5).
 */

import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getOfflineStorage, type SyncQueueRow } from '../database/offlineDb';
import { pullCloudIntoLocal } from './OfflineCloudPuller';
import { getOfflinePhotoStorage } from './OfflinePhotoStorage';

const EVIDENCE_BUCKET = 'wkb-evidence';

/**
 * Lift een lokale foto-URI (file:// of blob:) naar Supabase Storage.
 * Returns het opslag-PAD (niet een publieke URL) dat in evidence.photo_uri
 * komt te staan; fetchEvidenceForReview tekent dat pad bij het ophalen tot
 * een kortlevende signed URL. Werkt ook op een privé-bucket.
 */
async function uploadLocalPhotoToCloud(
  uuid: string,
  localUri: string | null,
): Promise<string | null> {
  if (!localUri) return null;
  // Als al een remote URL is (na eerdere mislukte sync) — niet opnieuw uploaden
  if (localUri.startsWith('http')) return localUri;

  try {
    const photoStore = await getOfflinePhotoStorage();
    // Laad als blob/file
    let blob: Blob;
    if (localUri.startsWith('blob:') || localUri.startsWith('file://') || localUri.startsWith('data:')) {
      try {
        const r = await fetch(localUri);
        blob = await r.blob();
      } catch (fetchErr) {
        // Een blob:-object-URL kan dood zijn na een page-reload (web). Val terug
        // op de duurzame kopie in de offline photo-store (via uuid), zodat de foto
        // alsnog geüpload kan worden i.p.v. verloren te gaan.
        const refreshed = await photoStore.loadPhoto(uuid);
        if (!refreshed) throw fetchErr;
        const r = await fetch(refreshed);
        blob = await r.blob();
      }
    } else {
      // Onbekend pad — probeer photoStore lookup als fallback
      const refreshed = await photoStore.loadPhoto(uuid);
      if (!refreshed) return null;
      const r = await fetch(refreshed);
      blob = await r.blob();
    }

    const fileName = `wkb_foto_${uuid}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(fileName, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });
    if (uploadError) {
      // Conflict op filename (zeldzaam) → genereer nieuwe naam en retry
      throw uploadError;
    }
    // Bewaar het PAD (niet een publieke URL). Bij het ophalen tekent
    // fetchEvidenceForReview() dit pad tot een kortlevende signed URL.
    return fileName;
  } catch (err) {
    console.warn('[OfflineSyncEngine] photo-upload faalt:', err);
    return null;
  }
}

// ─── Public state types ──────────────────────────────────────────────────────

export type OfflineSyncState =
  | { status: 'idle'; lastSyncAt: string | null; pendingCount: number }
  | { status: 'syncing'; processed: number; total: number }
  | { status: 'error'; lastError: string; pendingCount: number; willRetryAt: string };

export type OfflineSyncListener = (state: OfflineSyncState) => void;

// ─── Tunables ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2_000;
const PERIODIC_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minuten — bewust niet agressiever

function backoffMs(attempt: number): number {
  // Exponential met 60s cap: 2s, 4s, 8s, 16s, 32s, 60s
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 60_000);
}

// ─── Module-level singleton ──────────────────────────────────────────────────

let currentState: OfflineSyncState = {
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
};
const listeners = new Set<OfflineSyncListener>();
let isOnline = true;
let isSyncing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let netInfoUnsub: (() => void) | null = null;
let started = false;

function setState(next: OfflineSyncState): void {
  currentState = next;
  listeners.forEach((fn) => fn(next));
}

export function subscribeOfflineSync(listener: OfflineSyncListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineSyncState(): OfflineSyncState {
  return currentState;
}

// ─── Cloud-push per operation type ───────────────────────────────────────────

interface RemoteEvidenceVersion {
  client_version: number | null;
}

async function pushOperation(op: SyncQueueRow): Promise<void> {
  const store = await getOfflineStorage();
  const localRow = await store.getEvidence(op.evidence_uuid);
  if (!localRow) {
    throw new Error(`Lokale evidence ${op.evidence_uuid} niet meer aanwezig`);
  }

  if (op.operation === 'create') {
    // Stap 1: foto naar Supabase Storage uploaden (als 'ie nog lokaal is)
    const remotePhotoUrl = await uploadLocalPhotoToCloud(
      localRow.uuid,
      localRow.photo_uri,
    );
    const remoteMediaUrl =
      localRow.media_uri && localRow.media_uri !== localRow.photo_uri
        ? await uploadLocalPhotoToCloud(localRow.uuid + '-media', localRow.media_uri)
        : remotePhotoUrl;

    // FAIL-CLOSED: als er een lokale foto was maar de upload faalde (null), NIET de
    // row als 'synced' wegschrijven met een lokaal (file://blob:) pad dat de cloud
    // niet kan lezen. Gooien zodat de bestaande backoff/retry het opnieuw probeert;
    // anders verdwijnt het Wkb-bewijs zodra de opschoning de lokale foto weghaalt.
    const hadLocalPhoto = !!localRow.photo_uri && !localRow.photo_uri.startsWith('http');
    if (hadLocalPhoto && !remotePhotoUrl) {
      throw new Error(
        `Foto-upload naar cloud mislukt voor evidence ${localRow.uuid}; ` +
          `sync wordt opnieuw geprobeerd (bewijs blijft lokaal behouden).`,
      );
    }
    const hadLocalMedia =
      !!localRow.media_uri &&
      localRow.media_uri !== localRow.photo_uri &&
      !localRow.media_uri.startsWith('http');
    if (hadLocalMedia && !remoteMediaUrl) {
      throw new Error(
        `Media-upload naar cloud mislukt voor evidence ${localRow.uuid}; sync wordt opnieuw geprobeerd.`,
      );
    }

    // Stap 2: evidence-row insert met de remote URLs
    const { data, error } = await supabase
      .from('evidence')
      .insert({
        project_id: localRow.project_id,
        inspection_point_id: localRow.inspection_point_id,
        photo_uri: remotePhotoUrl ?? localRow.photo_uri,
        media_uri: remoteMediaUrl ?? localRow.media_uri,
        timestamp: localRow.timestamp,
        latitude: localRow.latitude,
        longitude: localRow.longitude,
        gps_accuracy: localRow.gps_accuracy,
        exif_hash: localRow.exif_hash,
        exif_verified: localRow.exif_verified,
        field_note: localRow.field_note,
        ai_status: localRow.ai_status,
        ai_confidence: localRow.ai_confidence,
        ai_notes: localRow.ai_notes,
        // Idempotency + LWW:
        client_uuid: localRow.uuid,
        client_version: localRow.client_version,
      })
      .select('id')
      .single<{ id: number }>();

    if (error) throw error;
    if (!data?.id) throw new Error('Geen ID terug van Supabase na insert');

    // Stap 3: lokale row update met remote_id + sync-status. De LOKALE
    // photo_uri/media_uri (file://-pad op het toestel) houden we bewust
    // ongemoeid: dat blijft de bron voor offline-weergave. In de cloud staat
    // nu het opslag-PAD (remotePhotoUrl), dat bij het ophalen wordt getekend.
    await store.updateEvidence(op.evidence_uuid, {
      remote_id: data.id,
      sync_status: 'synced',
      last_sync_at: new Date().toISOString(),
    });
    return;
  }

  if (op.operation === 'update') {
    if (!localRow.remote_id) {
      throw new Error(
        `update vóór create voor uuid=${op.evidence_uuid}; ` +
          `verwerk eerst de create-operatie`,
      );
    }

    // LWW: vraag remote client_version op, alleen overschrijven als
    // onze versie nieuwer of gelijk is.
    const { data: remote, error: fetchError } = await supabase
      .from('evidence')
      .select('client_version')
      .eq('id', localRow.remote_id)
      .single<RemoteEvidenceVersion>();

    if (fetchError) throw fetchError;

    const remoteVersion = remote?.client_version ?? 0;
    if (remoteVersion > localRow.client_version) {
      // Remote is nieuwer — onze update verliest. Markeer als conflict
      // zodat werkvoorbereider het in week 4 in de UI kan oplossen.
      await store.updateEvidence(op.evidence_uuid, { sync_status: 'error' });
      throw new Error(
        `Conflict: remote v${remoteVersion} > local v${localRow.client_version}`,
      );
    }

    const payload = JSON.parse(op.payload) as { status?: string; note?: string | null };
    const updatePayload: Record<string, unknown> = {
      client_version: localRow.client_version,
    };
    if (typeof payload.status === 'string') updatePayload.ai_status = payload.status;
    if (payload.note !== undefined) updatePayload.ai_notes = payload.note;

    const { error: updateError } = await supabase
      .from('evidence')
      .update(updatePayload)
      .eq('id', localRow.remote_id);

    if (updateError) throw updateError;

    await store.updateEvidence(op.evidence_uuid, {
      sync_status: 'synced',
      last_sync_at: new Date().toISOString(),
    });
    return;
  }

  if (op.operation === 'delete') {
    if (!localRow.remote_id) {
      // Bestond alleen lokaal — niets te doen aan cloud-kant
      return;
    }
    const { error } = await supabase
      .from('evidence')
      .delete()
      .eq('id', localRow.remote_id);
    if (error) throw error;
    return;
  }

  throw new Error(
    `Onbekende sync-operation: ${(op as { operation: string }).operation}`,
  );
}

// ─── Main queue-processor ────────────────────────────────────────────────────

export async function processOfflineSyncQueue(): Promise<void> {
  if (isSyncing) return;
  if (!isOnline) return;

  isSyncing = true;
  try {
    // Stap 1: PULL — haal remote wijzigingen lokaal binnen.
    // Dit voorkomt dat een vakman die zojuist online komt zijn
    // werkvoorbereider-edits mist.
    try {
      await pullCloudIntoLocal();
    } catch (err) {
      console.warn('[OfflineSyncEngine] pull-step faalde:', err);
      // Pull-fout is non-fatal — ga door met push
    }

    // Stap 2: PUSH — verwerk de lokale sync-queue
    const store = await getOfflineStorage();
    const queue = await store.listPendingSync();

    if (queue.length === 0) {
      setState({
        status: 'idle',
        lastSyncAt: new Date().toISOString(),
        pendingCount: 0,
      });
      return;
    }

    let processed = 0;
    setState({ status: 'syncing', processed: 0, total: queue.length });

    for (const op of queue) {
      // Skip operations die nog in backoff-window zitten
      if (op.last_attempt_at) {
        const since = Date.now() - new Date(op.last_attempt_at).getTime();
        if (since < backoffMs(op.attempts)) {
          continue;
        }
      }
      if (op.attempts >= MAX_ATTEMPTS) {
        // Te vaak gefaald — laat staan voor handmatig review (week 4 UI)
        continue;
      }

      try {
        await pushOperation(op);
        await store.removeSyncOperation(op.id);
        processed += 1;
        setState({ status: 'syncing', processed, total: queue.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await store.markSyncAttempt(op.id, msg);
        console.warn('[OfflineSyncEngine] operation faalde:', op.id, msg);
      }
    }

    const remaining = await store.listPendingSync();
    if (remaining.length > 0) {
      const earliestAttempt = Math.min(...remaining.map((r) => r.attempts));
      const retryAt = new Date(Date.now() + backoffMs(earliestAttempt));
      setState({
        status: 'error',
        lastError: `${remaining.length} operatie(s) wachten op retry`,
        pendingCount: remaining.length,
        willRetryAt: retryAt.toISOString(),
      });
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        void processOfflineSyncQueue();
      }, Math.max(0, retryAt.getTime() - Date.now()));
    } else {
      setState({
        status: 'idle',
        lastSyncAt: new Date().toISOString(),
        pendingCount: 0,
      });
      // Geslaagde sync-cycle → opruim oude lokale foto-cache (fire-and-forget)
      void import('./OfflineStorageCleanup')
        .then(({ runOfflineStorageCleanup }) => runOfflineStorageCleanup())
        .then((cleanup) => {
          if (cleanup.removed > 0) {
            console.info(
              `[OfflineSyncEngine] cleanup: ${cleanup.removed} foto's opgeruimd, ` +
                `${cleanup.retained} behouden${cleanup.hardCapTriggered ? ' (hard cap)' : ''}`,
            );
          }
        })
        .catch((err) => console.warn('[OfflineSyncEngine] cleanup faalt:', err));
    }
  } finally {
    isSyncing = false;
  }
}

// ─── Netwerk-detectie ───────────────────────────────────────────────────────

function attachNetInfo(): void {
  if (netInfoUnsub) return;
  try {
    netInfoUnsub = NetInfo.addEventListener((state) => {
      const next = !!state.isConnected;
      if (next !== isOnline) {
        isOnline = next;
        if (isOnline) {
          // Just-back-online — onmiddellijk syncen
          void processOfflineSyncQueue();
        }
      }
    });
  } catch (err) {
    console.warn('[OfflineSyncEngine] NetInfo-listener kon niet worden gekoppeld:', err);
  }
}

function attachBrowserOnlineEvents(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;

  const onOnline = (): void => {
    isOnline = true;
    void processOfflineSyncQueue();
  };
  const onOffline = (): void => {
    isOnline = false;
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  isOnline = navigator.onLine !== false;
}

// ─── Public lifecycle ────────────────────────────────────────────────────────

/**
 * Start de OfflineSyncEngine. Idempotent — herhaalde aanroep is no-op.
 * Aanroepen vanuit een top-level provider zodra offline-mode actief wordt.
 *
 * Periodic auto-sync: een setInterval van PERIODIC_SYNC_INTERVAL_MS (5 min)
 * triggert een sync-cycle wanneer het netwerk online is — ook als de
 * gebruiker geen actie heeft ondernomen. Past idle/syncing/error netjes
 * door het subscribe-pattern.
 */
export function startOfflineSyncEngine(): void {
  if (started) return;
  started = true;
  attachNetInfo();
  attachBrowserOnlineEvents();
  // Eerste sync direct
  void processOfflineSyncQueue();
  // Periodic auto-sync
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    if (isOnline) void processOfflineSyncQueue();
  }, PERIODIC_SYNC_INTERVAL_MS);
}

/**
 * Stop de engine. Cleanup bij tenant-switch of logout.
 */
export function stopOfflineSyncEngine(): void {
  if (!started) return;
  started = false;
  if (netInfoUnsub) {
    netInfoUnsub();
    netInfoUnsub = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  setState({ status: 'idle', lastSyncAt: null, pendingCount: 0 });
}

/**
 * Forceer een sync nu — handig voor een "Nu synchroniseren"-knop in de UI.
 */
export async function syncOfflineQueueNow(): Promise<void> {
  await processOfflineSyncQueue();
}
