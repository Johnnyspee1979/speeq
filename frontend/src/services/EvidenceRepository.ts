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

/**
 * Genormaliseerd evidence-type dat beide repository's teruggeven.
 * Voor nu identiek aan CloudEvidence — local repository moet ook
 * dit shape teruggeven (mapper-laag bij sync).
 */
export type EvidenceRecord = CloudEvidence;

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
}

// ─── Cloud implementation ────────────────────────────────────────────────────

export const cloudEvidenceRepository: EvidenceRepository = {
  async listForReview(projectId?: string) {
    return cloudFetchEvidenceForReview(projectId);
  },
  async updateStatus(id, nextStatus, note = null) {
    return cloudUpdateEvidenceStatus(id, nextStatus, note);
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
};

// ─── Re-export types voor schermen ───────────────────────────────────────────

export type { ReviewableEvidenceStatus };
