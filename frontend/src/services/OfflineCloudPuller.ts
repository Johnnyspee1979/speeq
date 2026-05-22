/**
 * OfflineCloudPuller — cloud → local synchronisatie.
 *
 * Aanvulling op OfflineSyncEngine (die alleen local → cloud push). Deze
 * module pulled remote wijzigingen naar de lokale SQLite/IndexedDB,
 * zodat een vakman die offline werkt en weer online komt de updates
 * van de werkvoorbereider ziet — en omgekeerd.
 *
 * Strategie:
 *  - Incremental pull op `updated_at` > laatste local sync-timestamp
 *  - Conflict-detectie via client_version:
 *      • Remote > Local en geen lokale pending op die uuid → cloud wint, lokaal overschrijven
 *      • Remote > Local en lokale pending push → markeer pending op 'error' (conflict-UI handelt het af)
 *      • Remote == Local → niets te doen
 *      • Local > Remote → onze versie wint, push-cycle van OfflineSyncEngine handelt af
 *
 * Aan te roepen door OfflineSyncEngine vlak vóór processOfflineSyncQueue().
 * Idempotent — meerdere aanroepen veroorzaken geen dubbele writes.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md §5.
 */

import { supabase } from '../lib/supabase';
import {
  getOfflineStorage,
  type LocalEvidenceRow,
} from '../database/offlineDb';
import { getActiveTenantId } from '../config/tenant';
import localforage from 'localforage';

// ─── Constants ───────────────────────────────────────────────────────────────

const LAST_PULL_KEY = 'speeq_offline_last_pull_iso';
const INITIAL_PULL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen

const pullMetaStore = localforage.createInstance({
  name: 'speeq_offline',
  storeName: 'pull_meta',
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface RemoteEvidenceRow {
  id: number;
  client_uuid: string | null;
  client_version: number | null;
  project_id: string | null;
  inspection_point_id: string | null;
  photo_uri: string | null;
  media_uri: string | null;
  timestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  exif_hash: string | null;
  exif_verified: boolean | number | null;
  field_note: string | null;
  betonkwaliteit: string | null;
  milieuklasse: string | null;
  volume: string | null;
  leverdatum: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_notes: string | null;
  updated_at: string | null;
}

export interface PullResult {
  fetched: number;
  inserted: number;
  updated: number;
  conflicts: number;
  skipped: number;
  errors: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getLastPullIso(): Promise<string | null> {
  return (await pullMetaStore.getItem<string>(LAST_PULL_KEY)) ?? null;
}

async function setLastPullIso(iso: string): Promise<void> {
  await pullMetaStore.setItem(LAST_PULL_KEY, iso);
}

function remoteToLocalRow(remote: RemoteEvidenceRow): Omit<LocalEvidenceRow, 'id'> {
  return {
    uuid: remote.client_uuid ?? `cloud-${remote.id}`,
    remote_id: remote.id,
    project_id: remote.project_id,
    inspection_point_id: remote.inspection_point_id,
    photo_uri: remote.photo_uri,
    media_uri: remote.media_uri,
    timestamp: remote.timestamp,
    latitude: remote.latitude,
    longitude: remote.longitude,
    gps_accuracy: remote.gps_accuracy,
    exif_hash: remote.exif_hash,
    exif_verified:
      remote.exif_verified == null
        ? null
        : remote.exif_verified === true
        ? 1
        : remote.exif_verified === false
        ? 0
        : (remote.exif_verified as number),
    field_note: remote.field_note,
    betonkwaliteit: remote.betonkwaliteit,
    milieuklasse: remote.milieuklasse,
    volume: remote.volume,
    leverdatum: remote.leverdatum,
    ai_status: remote.ai_status,
    ai_confidence: remote.ai_confidence,
    ai_notes: remote.ai_notes,
    sync_status: 'synced',
    created_at: remote.updated_at ?? new Date().toISOString(),
    updated_at: remote.updated_at ?? new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
    client_version: remote.client_version ?? 1,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pull remote updates voor de actieve tenant naar de lokale storage.
 * Doet incremental pull op `updated_at` > vorige pull (of 30d window
 * bij eerste run).
 *
 * Returnt counters voor logging + sync-status indicator.
 */
export async function pullCloudIntoLocal(): Promise<PullResult> {
  const result: PullResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    conflicts: 0,
    skipped: 0,
    errors: [],
  };

  const tenantId = getActiveTenantId();
  if (!tenantId) {
    result.errors.push('Geen actieve tenant — pull overgeslagen');
    return result;
  }

  const sinceIso =
    (await getLastPullIso()) ??
    new Date(Date.now() - INITIAL_PULL_WINDOW_MS).toISOString();

  // Fetch remote rows die sinds laatste pull zijn veranderd
  const { data, error } = await supabase
    .from('evidence')
    .select(
      'id, client_uuid, client_version, project_id, inspection_point_id, ' +
        'photo_uri, media_uri, timestamp, latitude, longitude, gps_accuracy, ' +
        'exif_hash, exif_verified, field_note, betonkwaliteit, milieuklasse, ' +
        'volume, leverdatum, ai_status, ai_confidence, ai_notes, updated_at',
    )
    .gt('updated_at', sinceIso)
    .order('updated_at', { ascending: true })
    .limit(500);

  if (error) {
    result.errors.push(`Supabase fetch faalde: ${error.message}`);
    return result;
  }

  const remotes = (data ?? []) as unknown as RemoteEvidenceRow[];
  result.fetched = remotes.length;
  if (remotes.length === 0) {
    await setLastPullIso(new Date().toISOString());
    return result;
  }

  const store = await getOfflineStorage();

  // Cache pending sync-uuids in een set voor O(1) conflict-detectie
  const queue = await store.listPendingSync();
  const pendingUuids = new Set(queue.map((q) => q.evidence_uuid));

  for (const remote of remotes) {
    try {
      // Identificeer de lokale rij — eerst op client_uuid, daarna op remote_id
      let localRow: LocalEvidenceRow | null = null;
      if (remote.client_uuid) {
        localRow = await store.getEvidence(remote.client_uuid);
      }
      if (!localRow) {
        // Zoek op remote_id (cloud-mode records die niet via offline-mode zijn gemaakt)
        const allLocal = await store.listEvidence();
        localRow = allLocal.find((r) => r.remote_id === remote.id) ?? null;
      }

      if (!localRow) {
        // Nieuwe record vanuit cloud — insert lokaal
        await store.insertEvidence(remoteToLocalRow(remote));
        result.inserted += 1;
        continue;
      }

      const remoteVersion = remote.client_version ?? 1;
      const localVersion = localRow.client_version;

      if (remoteVersion === localVersion) {
        result.skipped += 1;
        continue;
      }

      if (remoteVersion < localVersion) {
        // Onze versie is nieuwer — push-cycle van OfflineSyncEngine handelt af
        result.skipped += 1;
        continue;
      }

      // Remote is nieuwer
      if (pendingUuids.has(localRow.uuid)) {
        // We hebben een pending push op deze rij — conflict
        await store.updateEvidence(localRow.uuid, { sync_status: 'error' });
        result.conflicts += 1;
        continue;
      }

      // Geen lokale pending — cloud wint, overschrijf lokaal
      await store.updateEvidence(localRow.uuid, {
        project_id: remote.project_id,
        inspection_point_id: remote.inspection_point_id,
        photo_uri: remote.photo_uri,
        media_uri: remote.media_uri,
        timestamp: remote.timestamp,
        latitude: remote.latitude,
        longitude: remote.longitude,
        gps_accuracy: remote.gps_accuracy,
        exif_hash: remote.exif_hash,
        exif_verified:
          remote.exif_verified == null
            ? null
            : remote.exif_verified === true
            ? 1
            : remote.exif_verified === false
            ? 0
            : (remote.exif_verified as number),
        field_note: remote.field_note,
        betonkwaliteit: remote.betonkwaliteit,
        milieuklasse: remote.milieuklasse,
        volume: remote.volume,
        leverdatum: remote.leverdatum,
        ai_status: remote.ai_status,
        ai_confidence: remote.ai_confidence,
        ai_notes: remote.ai_notes,
        sync_status: 'synced',
        client_version: remoteVersion,
        last_sync_at: new Date().toISOString(),
      });
      result.updated += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`row ${remote.id}: ${msg}`);
    }
  }

  // Update last-pull timestamp
  const latestUpdatedAt = remotes
    .map((r) => r.updated_at)
    .filter((s): s is string => typeof s === 'string')
    .sort()
    .pop();
  if (latestUpdatedAt) {
    await setLastPullIso(latestUpdatedAt);
  } else {
    await setLastPullIso(new Date().toISOString());
  }

  return result;
}

/**
 * Reset het pull-window. Forceert volgende aanroep om de hele
 * INITIAL_PULL_WINDOW_MS te halen.
 *
 * Aanroepen bij tenant-switch of bij first-time activatie van offline-mode.
 */
export async function resetPullState(): Promise<void> {
  await pullMetaStore.removeItem(LAST_PULL_KEY);
}
