/**
 * OfflineConflictResolver — service-laag voor het oplossen van
 * sync-conflicten die zijn ontstaan in OfflineSyncEngine of
 * OfflineCloudPuller.
 *
 * Conflict = lokale evidence-rij heeft `sync_status='error'` ÉN er was
 * een versie-conflict (remote > local terwijl wij een push klaar hadden,
 * óf de andere kant op tijdens pull). De engine laat zo'n rij staan
 * zodat de werkvoorbereider handmatig kan kiezen.
 *
 * Twee resoluties:
 *   - 'keep-local'  → markeer pending opnieuw, OfflineSyncEngine zal
 *                     bij volgende push de remote overschrijven met
 *                     verhoogd client_version (LWW wint dan).
 *   - 'accept-cloud' → wis lokale wijzigingen, pull-engine zal bij
 *                      volgende cycle de remote-versie binnenhalen.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md §5 — conflict
 * resolution.
 */

import {
  getOfflineStorage,
  type LocalEvidenceRow,
} from '../database/offlineDb';

export interface ConflictRow {
  uuid: string;
  remoteId: number | null;
  projectId: string | null;
  photoUri: string | null;
  fieldNote: string | null;
  aiStatus: string | null;
  localVersion: number;
  updatedAt: string;
}

export type ConflictResolution = 'keep-local' | 'accept-cloud';

export interface ResolveResult {
  uuid: string;
  resolution: ConflictResolution;
  ok: boolean;
  error?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Lijst alle lokale evidence-rijen die in conflict-status staan.
 */
export async function listConflicts(): Promise<ConflictRow[]> {
  const store = await getOfflineStorage();
  const all = await store.listEvidence();
  return all
    .filter((r) => r.sync_status === 'error')
    .map(toConflictRow);
}

/**
 * Telt aantal conflicten — handig voor badge in floating sync-indicator.
 */
export async function countConflicts(): Promise<number> {
  const list = await listConflicts();
  return list.length;
}

/**
 * Los één conflict op.
 *
 * keep-local:
 *   - sync_status → 'pending'
 *   - client_version + 1 (zodat onze push de remote zal winnen)
 *   - enqueue 'update' (de engine pakt 'm op bij volgende cycle)
 *
 * accept-cloud:
 *   - sync_status → 'synced' tijdelijk
 *   - laatste pull-cycle pakt de remote rij op en overschrijft lokaal
 *   - elke pending update-operation voor deze uuid wordt uit de queue
 *     gehaald (niet meer doorduwen)
 *
 * Returns ResolveResult met ok=false bij ontbrekende rij of DB-fout.
 */
export async function resolveConflict(
  uuid: string,
  resolution: ConflictResolution,
): Promise<ResolveResult> {
  const store = await getOfflineStorage();
  const row = await store.getEvidence(uuid);
  if (!row) {
    return {
      uuid,
      resolution,
      ok: false,
      error: 'Evidence niet meer aanwezig (mogelijk al opgelost)',
    };
  }
  if (row.sync_status !== 'error') {
    return {
      uuid,
      resolution,
      ok: false,
      error: `Geen conflict — status is '${row.sync_status}'`,
    };
  }

  try {
    if (resolution === 'keep-local') {
      await store.updateEvidence(uuid, {
        sync_status: 'pending',
        client_version: row.client_version + 1,
        updated_at: new Date().toISOString(),
      });
      await store.enqueueSyncOperation({
        evidence_uuid: uuid,
        operation: 'update',
        payload: JSON.stringify({
          status: row.ai_status,
          note: row.ai_notes,
        }),
        attempts: 0,
        last_attempt_at: null,
        last_error: null,
        created_at: new Date().toISOString(),
      });
      return { uuid, resolution, ok: true };
    }

    // accept-cloud:
    // Lokale rij krijgt sync_status='synced'. De pull-engine ziet bij
    // volgende cycle dat remote_version > local_version (omdat de
    // server al een hogere had), en overschrijft.
    await store.updateEvidence(uuid, {
      sync_status: 'synced',
      // Reset client_version naar wat de remote had — best-effort,
      // pull-engine corrigeert sowieso.
      client_version: Math.max(1, row.client_version - 1),
      updated_at: new Date().toISOString(),
    });
    // Verwijder eventuele pending operations voor deze uuid
    const queue = await store.listPendingSync();
    for (const op of queue) {
      if (op.evidence_uuid === uuid) {
        await store.removeSyncOperation(op.id);
      }
    }
    return { uuid, resolution, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { uuid, resolution, ok: false, error: msg };
  }
}

/**
 * Bulk-resolutie — pas dezelfde resolutie toe op meerdere uuids.
 * Returnt per-uuid ResolveResult.
 */
export async function resolveAll(
  uuids: string[],
  resolution: ConflictResolution,
): Promise<ResolveResult[]> {
  const results: ResolveResult[] = [];
  for (const uuid of uuids) {
    results.push(await resolveConflict(uuid, resolution));
  }
  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toConflictRow(row: LocalEvidenceRow): ConflictRow {
  return {
    uuid: row.uuid,
    remoteId: row.remote_id,
    projectId: row.project_id,
    photoUri: row.photo_uri,
    fieldNote: row.field_note,
    aiStatus: row.ai_status,
    localVersion: row.client_version,
    updatedAt: row.updated_at,
  };
}
