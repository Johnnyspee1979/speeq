/**
 * VakmanFeedbackService — informeert de vakman zodra zijn foto wordt afgekeurd.
 *
 * Twee mechanismen, één API:
 * 1. Supabase Realtime — direct push wanneer evidence.ai_status verandert naar FAILED
 *    of wanneer een werkvoorbereider een foto handmatig afkeurt.
 * 2. Polling fallback — voor klanten met onbetrouwbaar realtime (firewall, VPN);
 *    elke 60s een SELECT op rejected items sinds laatste check.
 *
 * Gebruik in de app:
 *   const stop = subscribeToRejections(myUserId, (item) => {
 *     showLocalNotification(`Foto afgekeurd: ${item.inspectionPointId}`);
 *   });
 *   // ...later: stop();
 */

import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RejectionReason = 'AI_FAILED' | 'WV_REJECTED' | 'NEEDS_REVIEW';

export interface RejectedEvidence {
  evidenceId: number;
  inspectionPointId: string;
  projectId: string;
  reason: RejectionReason;
  notes: string | null;
  rejectedAt: string;
}

const POLL_INTERVAL_MS = 60_000;
const STORAGE_KEY = 'wkb_last_rejection_check';

type RejectionHandler = (item: RejectedEvidence) => void;

/**
 * Start een realtime + polling combinatie. Geeft een stop-functie terug
 * die zowel de Realtime channel sluit als de polling timer cleart.
 */
export function subscribeToRejections(
  userId: string,
  onRejection: RejectionHandler
): () => void {
  const channel = subscribeRealtime(userId, onRejection);
  const pollTimer = startPolling(userId, onRejection);

  return () => {
    if (channel) {
      try { supabase.removeChannel(channel); } catch (e) { console.warn('Realtime cleanup error:', e); }
    }
    clearInterval(pollTimer);
  };
}

// ── Realtime: directe push via Postgres CDC ──────────────────────────────────
function subscribeRealtime(
  userId: string,
  onRejection: RejectionHandler
): RealtimeChannel | null {
  try {
    const channel = supabase
      .channel(`vakman-feedback-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'evidence',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, any>;
          const oldRow = payload.old as Record<string, any>;
          const reason = detectRejectionReason(oldRow, newRow);
          if (!reason) return;

          onRejection({
            evidenceId: newRow.id,
            inspectionPointId: newRow.inspection_point_id,
            projectId: newRow.project_id,
            reason,
            notes: newRow.ai_notes ?? null,
            rejectedAt: new Date().toISOString(),
          });
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('VakmanFeedback realtime subscribe mislukt — alleen polling actief:', err);
    return null;
  }
}

// ── Polling fallback ─────────────────────────────────────────────────────────
function startPolling(userId: string, onRejection: RejectionHandler) {
  const tick = async () => {
    try {
      const since = readLastCheck();
      const { data, error } = await supabase
        .from('evidence')
        .select('id, inspection_point_id, project_id, ai_status, ai_notes, updated_at')
        .eq('user_id', userId)
        .or('ai_status.eq.FAILED,ai_status.eq.NEEDS_REVIEW')
        .gt('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error || !data) return;

      for (const row of data) {
        onRejection({
          evidenceId: row.id,
          inspectionPointId: row.inspection_point_id,
          projectId: row.project_id,
          reason: row.ai_status === 'FAILED' ? 'AI_FAILED' : 'NEEDS_REVIEW',
          notes: row.ai_notes ?? null,
          rejectedAt: row.updated_at,
        });
      }

      writeLastCheck(new Date().toISOString());
    } catch (err) {
      console.warn('VakmanFeedback poll mislukt:', err);
    }
  };

  // Direct na start ook één keer pollen, daarna periodiek
  tick();
  return setInterval(tick, POLL_INTERVAL_MS);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function detectRejectionReason(
  oldRow: Record<string, any>,
  newRow: Record<string, any>
): RejectionReason | null {
  // AI markeerde de foto als FAILED
  if (oldRow.ai_status !== 'FAILED' && newRow.ai_status === 'FAILED') return 'AI_FAILED';
  // Werkvoorbereider zette status op NEEDS_REVIEW
  if (oldRow.ai_status !== 'NEEDS_REVIEW' && newRow.ai_status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  return null;
}

function readLastCheck(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) ?? new Date(Date.now() - 24 * 3600_000).toISOString();
    }
  } catch { /* native or private browsing */ }
  return new Date(Date.now() - 24 * 3600_000).toISOString();
}

function writeLastCheck(iso: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, iso);
  } catch { /* swallow */ }
}
