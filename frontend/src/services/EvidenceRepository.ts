/**
 * EvidenceRepository — abstractie-laag tussen schermen en evidence-data.
 *
 * Schermen mogen NIET meer direct supabase.from('evidence') aanroepen.
 * Alle data-toegang gaat via deze interface, zodat we transparant kunnen
 * switchen tussen Cloud-mode (huidig) en Offline-mode (lokaal).
 *
 * Twee implementaties:
 *  - CloudEvidenceRepository → wrapt cloudEvidenceService (Supabase direct)
 *  - LocalEvidenceRepository → SQLite + sync-queue (week 2+)
 *
 * Selectie via useEvidenceRepository() hook — leest tenant_features.offline_mode.
 *
 * Onderdeel van de Dual-Mode architectuur. Zie docs/strategie/dual-mode-architectuur.md
 */

import type {
  CloudEvidence,
  ReviewableEvidenceStatus,
} from './cloudEvidenceService';
import {
  fetchEvidenceForReview as cloudFetchEvidenceForReview,
  updateEvidenceStatus as cloudUpdateEvidenceStatus,
} from './cloudEvidenceService';
import { supabase } from '../lib/supabase';
import { getOfflinePhotoStorage } from './OfflinePhotoStorage';
import { generateEvidenceUuid } from '../database/offlineDb';

/**
 * Genormaliseerd evidence-type dat beide repository's teruggeven.
 * Voor nu identiek aan CloudEvidence — local repository moet ook
 * dit shape teruggeven (mapper-laag bij sync).
 */
export type EvidenceRecord = CloudEvidence;

/**
 * Input voor het aanmaken van een nieuwe evidence-row.
 *
 * `photoSource` kan zijn:
 *  - data:image/jpeg;base64,...
 *  - blob://...
 *  - file://...   (native camera-output)
 *  - https://...  (remote URL — wordt gefetcht)
 *  - Blob/File object
 *
 * Cloud-mode upload direct naar Supabase Storage.
 * Offline-mode slaat lokaal op via OfflinePhotoStorage en queued de upload.
 */
export interface EvidenceCreateInput {
  projectId: string;
  inspectionPointId?: string | null;
  photoSource: string | Blob;
  timestamp?: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracy?: number | null;
  exifHash?: string | null;
  fieldNote?: string | null;
  aiStatus?: ReviewableEvidenceStatus | null;
  aiConfidence?: number | null;
  aiNotes?: string | null;
}

export interface EvidenceRepository {
  /**
   * Lijst alle evidence-records op voor een project (of alle projecten
   * als geen projectId gegeven).
   */
  listForReview(projectId?: string): Promise<EvidenceRecord[]>;

  /**
   * Update de review-status van één evidence-record.
   * Retourneert true bij succes.
   */
  updateStatus(
    id: number,
    nextStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW',
    note?: string | null,
  ): Promise<boolean>;

  /**
   * Maak een nieuwe evidence-row aan. In cloud-mode synchroon naar
   * Supabase; in offline-mode lokaal + sync-queue.
   *
   * Returns de gegenereerde (lokale of remote) ID, of null bij fout.
   */
  createEvidence(input: EvidenceCreateInput): Promise<number | null>;
}

// ─── Cloud implementation ────────────────────────────────────────────────────

const EVIDENCE_BUCKET = 'wkb-evidence';

async function photoSourceToBlob(source: string | Blob): Promise<Blob> {
  if (source instanceof Blob) return source;
  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const [meta, base64] = source.split(',');
      const mime = /data:([^;]+);/.exec(meta)?.[1] ?? 'image/jpeg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    // blob:/http(s)/file:// — fetch werkt voor alle drie in moderne RN-web
    const r = await fetch(source);
    if (!r.ok) throw new Error(`Photo fetch faalt: ${r.status}`);
    return r.blob();
  }
  throw new Error('Onbekende photoSource type');
}

export const cloudEvidenceRepository: EvidenceRepository = {
  async listForReview(projectId?: string) {
    return cloudFetchEvidenceForReview(projectId);
  },
  async updateStatus(id, nextStatus, note = null) {
    return cloudUpdateEvidenceStatus(id, nextStatus, note);
  },
  async createEvidence(input) {
    try {
      const uuid = generateEvidenceUuid();
      const fileName = `wkb_foto_${uuid}_${Date.now()}.jpg`;
      const blob = await photoSourceToBlob(input.photoSource);

      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(fileName, blob, { contentType: blob.type || 'image/jpeg' });
      if (uploadError) {
        console.error('[cloudEvidenceRepository] upload faalde:', uploadError);
        return null;
      }

      // Bewaar het PAD, niet een publieke URL. Bij het ophalen tekent
      // fetchEvidenceForReview() dit pad tot een kortlevende signed URL.
      const { data, error } = await supabase
        .from('evidence')
        .insert({
          project_id: input.projectId,
          inspection_point_id: input.inspectionPointId ?? null,
          photo_uri: fileName,
          media_uri: fileName,
          timestamp: input.timestamp ?? new Date().toISOString(),
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          gps_accuracy: input.gpsAccuracy ?? null,
          exif_hash: input.exifHash ?? null,
          field_note: input.fieldNote ?? null,
          ai_status: input.aiStatus ?? null,
          ai_confidence: input.aiConfidence ?? null,
          ai_notes: input.aiNotes ?? null,
          client_uuid: uuid,
          client_version: 1,
        })
        .select('id')
        .single<{ id: number }>();

      if (error) {
        console.error('[cloudEvidenceRepository] insert faalde:', error);
        return null;
      }
      return data?.id ?? null;
    } catch (err) {
      console.error('[cloudEvidenceRepository] createEvidence:', err);
      return null;
    }
  },
};

// ─── Local implementation (Week 2 — SQLite/IndexedDB via offlineDb) ─────────

import { getOfflineStorage, type LocalEvidenceRow } from '../database/offlineDb';

function localRowToEvidence(row: LocalEvidenceRow): EvidenceRecord {
  return {
    // Server-id heeft prioriteit (na sync), anders lokale id
    id: row.remote_id ?? row.id,
    project_id: row.project_id,
    inspection_point_id: row.inspection_point_id,
    photo_uri: row.photo_uri,
    media_uri: row.media_uri,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    gps_accuracy: row.gps_accuracy,
    exif_hash: row.exif_hash,
    exif_verified: row.exif_verified,
    field_note: row.field_note,
    betonkwaliteit: row.betonkwaliteit,
    milieuklasse: row.milieuklasse,
    volume: row.volume,
    leverdatum: row.leverdatum,
    stop_moment_confirmed: null,
    measurement_tool_confirmed: null,
    location_verified: null,
    location_spoof_risk: null,
    location_security_message: null,
    ai_status: row.ai_status as EvidenceRecord['ai_status'],
    ai_confidence: row.ai_confidence,
    ai_notes: row.ai_notes,
  };
}

export const localEvidenceRepository: EvidenceRepository = {
  async listForReview(projectId?: string) {
    const store = await getOfflineStorage();
    const rows = await store.listEvidence({ projectId });
    return rows.map(localRowToEvidence);
  },

  async updateStatus(id, nextStatus, note = null) {
    // Update lokaal + enqueue voor sync. De daadwerkelijke push naar cloud
    // gebeurt in week 3 (sync-engine).
    const store = await getOfflineStorage();

    // Zoek de evidence — id kan zowel lokaal als remote zijn
    const all = await store.listEvidence();
    const row = all.find((r) => r.remote_id === id || r.id === id);
    if (!row) {
      console.error('[LocalEvidenceRepository] updateStatus: evidence niet gevonden, id=', id);
      return false;
    }

    await store.updateEvidence(row.uuid, {
      ai_status: nextStatus,
      ai_notes: note,
      sync_status: 'pending',
    });

    await store.enqueueSyncOperation({
      evidence_uuid: row.uuid,
      operation: 'update',
      payload: JSON.stringify({ status: nextStatus, note }),
      attempts: 0,
      last_attempt_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
    });

    return true;
  },

  async createEvidence(input) {
    try {
      const store = await getOfflineStorage();
      const photoStore = await getOfflinePhotoStorage();
      const uuid = generateEvidenceUuid();
      const now = new Date().toISOString();

      // 1. Foto fysiek opslaan op het toestel
      const localPhotoUri = await photoStore.savePhoto(uuid, input.photoSource);

      // 2. Evidence-row insert (sync_status = pending)
      const row = await store.insertEvidence({
        uuid,
        remote_id: null,
        project_id: input.projectId,
        inspection_point_id: input.inspectionPointId ?? null,
        photo_uri: localPhotoUri,
        media_uri: localPhotoUri,
        timestamp: input.timestamp ?? now,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        gps_accuracy: input.gpsAccuracy ?? null,
        exif_hash: input.exifHash ?? null,
        exif_verified: null,
        field_note: input.fieldNote ?? null,
        betonkwaliteit: null,
        milieuklasse: null,
        volume: null,
        leverdatum: null,
        ai_status: input.aiStatus ?? null,
        ai_confidence: input.aiConfidence ?? null,
        ai_notes: input.aiNotes ?? null,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
        last_sync_at: null,
        client_version: 1,
      });

      // 3. Sync-queue: create-operation. Sync-engine pakt op zodra netwerk.
      await store.enqueueSyncOperation({
        evidence_uuid: uuid,
        operation: 'create',
        payload: JSON.stringify({}), // create-payload niet meer nodig, alles staat in row
        attempts: 0,
        last_attempt_at: null,
        last_error: null,
        created_at: now,
      });

      return row.id;
    } catch (err) {
      console.error('[LocalEvidenceRepository] createEvidence:', err);
      return null;
    }
  },
};

// ─── Re-export types voor schermen ───────────────────────────────────────────

export type { ReviewableEvidenceStatus };
