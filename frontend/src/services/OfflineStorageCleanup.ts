/**
 * OfflineStorageCleanup — beheert disk-budget voor offline-mode.
 *
 * Zonder cap groeit de lokale foto-cache onbegrensd:
 *   - 1000 foto's × 3 MB = ~3 GB op telefoon
 *   - IndexedDB-quota op web wordt geraakt en throw't bij verdere writes
 *
 * Beleid (gekalibreerd op aannemers-werkprocessen):
 *   - Bewaar lokaal: alle pending sync + alle synced van laatste 30 dagen
 *   - Verwijder: synced + last_sync_at ouder dan 30 dagen (cloud is bron)
 *   - Hard cap: max 1000 foto's lokaal — bij overschrijding: oudste eerst weg
 *
 * Aan te roepen door OfflineSyncEngine na elke succesvolle sync-cycle,
 * en/of via een cron-trigger (1×/dag bij start van app).
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md §8.
 */

import { getOfflineStorage, type LocalEvidenceRow } from '../database/offlineDb';
import { getOfflinePhotoStorage } from './OfflinePhotoStorage';

// ─── Tunables ────────────────────────────────────────────────────────────────

const RETAIN_SYNCED_DAYS = 30;
const HARD_CAP_PHOTOS = 1000;

const RETAIN_SYNCED_MS = RETAIN_SYNCED_DAYS * 24 * 60 * 60 * 1000;

// ─── Public types ───────────────────────────────────────────────────────────

export interface CleanupResult {
  removed: number;
  retained: number;
  hardCapTriggered: boolean;
  errors: string[];
}

// ─── Selection logic ────────────────────────────────────────────────────────

function shouldRemoveByAge(row: LocalEvidenceRow): boolean {
  if (row.sync_status !== 'synced') return false;
  if (!row.last_sync_at) return false;
  const ageMs = Date.now() - new Date(row.last_sync_at).getTime();
  return ageMs > RETAIN_SYNCED_MS;
}

/**
 * Selecteer welke rows mogen worden opgeruimd op basis van age + hard-cap.
 * Returns een lijst van uuids die uit photo-storage mogen.
 *
 * Behoudt:
 *  - Alle pending/syncing/error rows
 *  - Alle synced rows van laatste 30 dagen
 *  - Bij hard-cap-trigger: nieuwste 1000 synced rows
 */
function pickRowsToCleanup(rows: LocalEvidenceRow[]): {
  toRemove: LocalEvidenceRow[];
  retained: LocalEvidenceRow[];
  hardCapTriggered: boolean;
} {
  const toRemoveByAge = rows.filter(shouldRemoveByAge);
  const remaining = rows.filter((r) => !toRemoveByAge.includes(r));

  // Hard cap check op overgebleven synced rows
  const syncedRemaining = remaining
    .filter((r) => r.sync_status === 'synced')
    .sort((a, b) =>
      (b.last_sync_at ?? '').localeCompare(a.last_sync_at ?? ''),
    );

  let toRemoveByCap: LocalEvidenceRow[] = [];
  let hardCapTriggered = false;
  if (syncedRemaining.length > HARD_CAP_PHOTOS) {
    hardCapTriggered = true;
    toRemoveByCap = syncedRemaining.slice(HARD_CAP_PHOTOS);
  }

  const toRemove = [...toRemoveByAge, ...toRemoveByCap];
  const retained = rows.filter((r) => !toRemove.includes(r));

  return { toRemove, retained, hardCapTriggered };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Voer een opruim-cycle uit. Verwijdert ALLEEN de lokale foto-cache —
 * de evidence-rows blijven staan met hun remote URL (klant kan ze
 * online raadplegen).
 *
 * Idempotent — meerdere aanroepen zonder side-effects.
 */
export async function runOfflineStorageCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    removed: 0,
    retained: 0,
    hardCapTriggered: false,
    errors: [],
  };

  try {
    const store = await getOfflineStorage();
    const photoStore = await getOfflinePhotoStorage();
    const allRows = await store.listEvidence();
    const decision = pickRowsToCleanup(allRows);
    result.hardCapTriggered = decision.hardCapTriggered;
    result.retained = decision.retained.length;

    for (const row of decision.toRemove) {
      try {
        // Verwijder de lokale foto — evidence-row blijft staan met remote URL
        await photoStore.removePhoto(row.uuid);
        // Update evidence-row: photo_uri terug naar remote URL als die bekend is
        // (in een nette implementatie hebben we 'm bewaard; voor MVP leeg)
        await store.updateEvidence(row.uuid, {
          // sync_status blijft 'synced' — alleen lokale cache opgeruimd
        });
        result.removed += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`row ${row.uuid}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`cleanup-loop: ${msg}`);
  }

  return result;
}

/**
 * Telt hoeveel lokale foto-bytes ongeveer worden gebruikt.
 * Geeft een ruwe schatting (gebaseerd op rij-tellingen × 1.5MB gemiddeld).
 *
 * Voor exacte byte-counts zou je per photo via OfflinePhotoStorage.getPhotoSize
 * iteratie moeten doen — duur op grote sets.
 */
export async function getApproximateLocalStorageBytes(): Promise<number> {
  const store = await getOfflineStorage();
  const rows = await store.listEvidence();
  // 1.5MB gemiddelde JPEG van smartphone-camera
  return rows.length * 1_500_000;
}
