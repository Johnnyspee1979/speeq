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

// ─── Local implementation (stub voor week 2+) ────────────────────────────────

export const localEvidenceRepository: EvidenceRepository = {
  async listForReview(_projectId?: string) {
    // TODO week 2: SQLite query + sync-queue dedupe
    console.warn(
      '[LocalEvidenceRepository] listForReview() niet geïmplementeerd — ' +
        'val terug op cloud. Te bouwen in week 2 (zie offline-mode-roadmap.md).',
    );
    return cloudEvidenceRepository.listForReview(_projectId);
  },
  async updateStatus(id, nextStatus, note = null) {
    // TODO week 3: lokale mutation + sync-queue + LWW conflict-resolution
    console.warn(
      '[LocalEvidenceRepository] updateStatus() niet geïmplementeerd — ' +
        'val terug op cloud. Te bouwen in week 3 (zie offline-mode-roadmap.md).',
    );
    return cloudEvidenceRepository.updateStatus(id, nextStatus, note);
  },
};

// ─── Re-export types voor schermen ───────────────────────────────────────────

export type { ReviewableEvidenceStatus };
