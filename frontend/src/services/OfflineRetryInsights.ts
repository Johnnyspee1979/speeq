/**
 * OfflineRetryInsights — read-only inzicht in de sync-queue.
 *
 * De OfflineSyncEngine schrijft per gefaalde operation `attempts`,
 * `last_attempt_at` en `last_error` in sync_queue. Die data verdwijnt
 * normaal in de logs. Deze module ontsluit 'm voor debugging-UI en
 * voor de Klant-Tonen-Wat-Mis-Gaat-knop.
 *
 * Geen mutatie — alleen lees-helpers. Wijzigingen aan de queue gaan
 * via OfflineSyncEngine (push) of OfflineConflictResolver (resolutie).
 *
 * Onderdeel van docs/strategie/offline-mode-roadmap.md week 8+.
 */

import {
  getOfflineStorage,
  type SyncQueueRow,
} from '../database/offlineDb';

const MAX_ATTEMPTS = 5; // moet matchen met OfflineSyncEngine.MAX_ATTEMPTS

export interface RetrySummary {
  totalPending: number;
  awaitingRetry: number;
  exhausted: number;
  succeededLastHour: number; // placeholder voor toekomstige tracking
  oldestPendingIso: string | null;
}

export interface FailedOperationDetail {
  id: number;
  evidenceUuid: string;
  operation: 'create' | 'update' | 'delete';
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  exhausted: boolean;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * High-level snapshot voor de sync-status badge.
 */
export async function getRetrySummary(): Promise<RetrySummary> {
  const store = await getOfflineStorage();
  const queue = await store.listPendingSync();

  let awaitingRetry = 0;
  let exhausted = 0;
  let oldestPendingIso: string | null = null;

  for (const op of queue) {
    if (op.attempts >= MAX_ATTEMPTS) {
      exhausted += 1;
    } else {
      awaitingRetry += 1;
    }
    if (!oldestPendingIso || op.created_at < oldestPendingIso) {
      oldestPendingIso = op.created_at;
    }
  }

  return {
    totalPending: queue.length,
    awaitingRetry,
    exhausted,
    succeededLastHour: 0,
    oldestPendingIso,
  };
}

/**
 * Volledige lijst van gefaalde of in-progress operations.
 * Gesorteerd op meest-recent-gefaald eerst.
 */
export async function listFailedOperations(): Promise<FailedOperationDetail[]> {
  const store = await getOfflineStorage();
  const queue = await store.listPendingSync();

  return queue
    .filter((op) => op.attempts > 0)
    .map(toDetail)
    .sort((a, b) => {
      const aTime = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
      const bTime = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
      return bTime - aTime;
    });
}

/**
 * Operations die de max-retry-budget hebben opgebruikt en handmatige
 * actie behoeven.
 */
export async function listExhaustedOperations(): Promise<FailedOperationDetail[]> {
  const all = await listFailedOperations();
  return all.filter((op) => op.exhausted);
}

/**
 * Groepeer recente errors per type — handig voor patterns te zien
 * (bv. "10× 401 Unauthorized" duidt op een token-issue).
 */
export async function groupErrorsByMessage(): Promise<Array<{
  message: string;
  count: number;
  sampleUuid: string;
}>> {
  const failed = await listFailedOperations();
  const groups = new Map<string, { count: number; sampleUuid: string }>();

  for (const op of failed) {
    const msg = normalizeErrorMessage(op.lastError);
    const existing = groups.get(msg);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(msg, { count: 1, sampleUuid: op.evidenceUuid });
    }
  }

  return Array.from(groups.entries())
    .map(([message, { count, sampleUuid }]) => ({ message, count, sampleUuid }))
    .sort((a, b) => b.count - a.count);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDetail(op: SyncQueueRow): FailedOperationDetail {
  return {
    id: op.id,
    evidenceUuid: op.evidence_uuid,
    operation: op.operation,
    attempts: op.attempts,
    lastAttemptAt: op.last_attempt_at,
    lastError: op.last_error,
    createdAt: op.created_at,
    exhausted: op.attempts >= MAX_ATTEMPTS,
  };
}

function normalizeErrorMessage(raw: string | null): string {
  if (!raw) return '(onbekende fout)';
  // Strip dynamische stukjes — bv. UUID's, IDs, timestamps — zodat
  // gelijksoortige errors samen worden gegroepeerd.
  return raw
    .replace(/uuid=[a-f0-9-]+/gi, 'uuid=*')
    .replace(/\b\d{4,}\b/g, '*')
    .slice(0, 200);
}
