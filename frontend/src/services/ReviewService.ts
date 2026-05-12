// ReviewService — keurmeester / projectleider workflow voor bewijs.
//
// PENDING_REVIEW → APPROVED → FINALIZED  (happy path)
//                      ↘  REJECTED       (alternatief — vakman herstelt)
//
// De Supabase RPC `set_evidence_review` doet de daadwerkelijke update +
// validatie + autorisatie (security definer). Hier alleen een type-veilige wrapper.

import { supabase } from '../lib/supabase';
import type { ReviewStatus } from '../types/Evidence';

export type ReviewAction = 'APPROVE' | 'REJECT' | 'FINALIZE' | 'REOPEN';

/**
 * Vertaalt een UI-actie naar de doel-status in de database.
 */
export function actionToStatus(action: ReviewAction): ReviewStatus {
  switch (action) {
    case 'APPROVE':  return 'APPROVED';
    case 'REJECT':   return 'REJECTED';
    case 'FINALIZE': return 'FINALIZED';
    case 'REOPEN':   return 'PENDING_REVIEW';
  }
}

interface SetReviewOptions {
  /** De bigint id uit de cloud (StoredWkbEvidence.cloudRecordId). */
  cloudRecordId: number;
  status: ReviewStatus;
  note?: string | null;
}

/**
 * Werkt de review-status van één bewijsstuk bij via de Supabase RPC.
 * Gooit een Error met begrijpelijke tekst als iets misgaat — UI kan die direct tonen.
 */
export async function setEvidenceReview(opts: SetReviewOptions): Promise<void> {
  const trimmedNote = opts.note?.trim() ?? '';

  if (opts.status === 'REJECTED' && trimmedNote.length === 0) {
    throw new Error('Afkeuren kan alleen met een toelichting.');
  }

  const { error } = await supabase.rpc('set_evidence_review', {
    p_evidence_id: opts.cloudRecordId,
    p_status: opts.status,
    p_note: trimmedNote.length > 0 ? trimmedNote : null,
  });

  if (error) {
    throw new Error(error.message || 'Review bijwerken mislukt');
  }
}

export async function approveEvidence(cloudRecordId: number, note?: string): Promise<void> {
  return setEvidenceReview({ cloudRecordId, status: 'APPROVED', note: note ?? null });
}

export async function rejectEvidence(cloudRecordId: number, note: string): Promise<void> {
  return setEvidenceReview({ cloudRecordId, status: 'REJECTED', note });
}

export async function finalizeEvidence(cloudRecordId: number): Promise<void> {
  return setEvidenceReview({ cloudRecordId, status: 'FINALIZED', note: null });
}

export async function reopenEvidence(cloudRecordId: number): Promise<void> {
  return setEvidenceReview({ cloudRecordId, status: 'PENDING_REVIEW', note: null });
}

// ── UI-helpers ────────────────────────────────────────────────────────────────

export interface ReviewBadge {
  label: string;
  emoji: string;
  bg: string;
  fg: string;
}

const FALLBACK_BADGE: ReviewBadge = {
  label: 'In review',
  emoji: '⏳',
  bg: 'rgba(100, 116, 139, 0.15)',
  fg: '#475569',
};

/**
 * Mapt een ReviewStatus naar UI-tokens (label + kleuren) zodat
 * desktop- en mobiel-componenten dezelfde badges renderen.
 */
export function reviewBadgeFor(status: ReviewStatus | null | undefined): ReviewBadge {
  switch (status) {
    case 'APPROVED':
      return { label: 'Goedgekeurd', emoji: '✅', bg: 'rgba(5, 150, 105, 0.15)', fg: '#047857' };
    case 'REJECTED':
      return { label: 'Afgekeurd', emoji: '❌', bg: 'rgba(239, 68, 68, 0.15)', fg: '#b91c1c' };
    case 'FINALIZED':
      return { label: 'Definitief', emoji: '🔒', bg: 'rgba(15, 118, 110, 0.18)', fg: '#0f766e' };
    case 'PENDING_REVIEW':
      return { label: 'In review', emoji: '⏳', bg: 'rgba(217, 119, 6, 0.15)', fg: '#92400e' };
    default:
      return FALLBACK_BADGE;
  }
}

/**
 * Mag deze status nog worden gewijzigd? FINALIZED is vergrendeld.
 */
export function isReviewLocked(status: ReviewStatus | null | undefined): boolean {
  return status === 'FINALIZED';
}
