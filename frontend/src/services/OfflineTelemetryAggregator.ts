/**
 * OfflineTelemetryAggregator — periodieke metrics-snapshot voor monitoring.
 *
 * Verzamelt key offline-mode metrics in één compact object dat bv. eens
 * per uur naar Supabase kan worden gestuurd voor cross-tenant inzicht.
 *
 * Wat we meten:
 *   - Storage: lokale foto-bytes, foto-aantal
 *   - Sync: pending operations, gefaald, opgegeven
 *   - Conflicts: open conflict-rijen
 *   - Auth: dagen offline-grace resterend
 *   - Branding: cache-leeftijd
 *
 * Read-only — geen mutatie van de offline-staat. Geen network-calls in
 * deze module zelf; consumer beslist wat ermee te doen (loggen, posten
 * naar Supabase, naar Sentry).
 *
 * Niet vervangen voor de UI-paneeltjes (#54 + #41 storage-meter) — die
 * tonen interactieve detail-info aan de klant. Deze module is bedoeld
 * voor product-team / monitoring.
 *
 * Onderdeel van docs/strategie/offline-mode-roadmap.md week 8+.
 */

import { getOfflineStorage } from '../database/offlineDb';
import {
  getRetrySummary,
  type RetrySummary,
} from './OfflineRetryInsights';
import { countConflicts } from './OfflineConflictResolver';
import {
  getGraceRemainingMs,
} from './OfflineAuthCache';
import { getCacheAgeMs } from './OfflineBrandingCache';
import { getApproximateLocalStorageBytes } from './OfflineStorageCleanup';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OfflineTelemetrySnapshot {
  /** ISO-timestamp van moment van meten */
  capturedAt: string;
  storage: {
    photoCount: number;
    approximateBytes: number;
  };
  sync: RetrySummary & {
    conflicts: number;
  };
  auth: {
    /** -1 = geen cache, anders dagen tot grace verloopt */
    graceRemainingDays: number;
  };
  branding: {
    /** -1 = geen cache, anders uren sinds laatste sync */
    ageHours: number;
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verzamel één snapshot. Idempotent — meerdere aanroepen achter elkaar
 * geven (binnen klok-precisie) dezelfde data.
 */
export async function collectTelemetrySnapshot(): Promise<OfflineTelemetrySnapshot> {
  const [
    photoCount,
    approximateBytes,
    syncSummary,
    conflicts,
    graceMs,
    brandingAgeMs,
  ] = await Promise.all([
    countPhotos(),
    safeGetBytes(),
    safeGetRetrySummary(),
    safeCountConflicts(),
    safeGetGraceMs(),
    safeGetBrandingAge(),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    storage: {
      photoCount,
      approximateBytes,
    },
    sync: {
      ...syncSummary,
      conflicts,
    },
    auth: {
      graceRemainingDays:
        graceMs === -1 ? -1 : Math.round((graceMs / DAY_MS) * 10) / 10,
    },
    branding: {
      ageHours:
        brandingAgeMs === -1 ? -1 : Math.round((brandingAgeMs / HOUR_MS) * 10) / 10,
    },
  };
}

/**
 * Bereken een health-score van 0..100. Voor at-a-glance monitoring.
 * Lager = problemen.
 *
 * Aftrek per indicator:
 *   - 25 punten als grace < 3 dagen (auth dreigt offline-lock)
 *   - 15 punten per 10 conflict-rijen (cap 30)
 *   - 15 punten als sync exhausted > 0
 *   - 10 punten als pending > 50 (queue loopt vol)
 *   - 5 punten per 500MB lokale storage
 */
export function deriveHealthScore(snapshot: OfflineTelemetrySnapshot): number {
  let score = 100;

  if (snapshot.auth.graceRemainingDays >= 0 && snapshot.auth.graceRemainingDays < 3) {
    score -= 25;
  }

  const conflictPenalty = Math.min(30, Math.floor(snapshot.sync.conflicts / 10) * 15);
  score -= conflictPenalty;

  if (snapshot.sync.exhausted > 0) score -= 15;
  if (snapshot.sync.totalPending > 50) score -= 10;

  const sizeMb = snapshot.storage.approximateBytes / 1_000_000;
  const sizePenalty = Math.min(20, Math.floor(sizeMb / 500) * 5);
  score -= sizePenalty;

  return Math.max(0, Math.min(100, score));
}

/**
 * Compact one-line samenvatting voor logs / console.
 * Bv. "[telemetry] 87 foto's · 130MB · 3 pending · 0 conflicts · grace 22d · health 95"
 */
export function formatTelemetryLine(snapshot: OfflineTelemetrySnapshot): string {
  const health = deriveHealthScore(snapshot);
  const sizeMb = Math.round(snapshot.storage.approximateBytes / 1_000_000);
  const grace =
    snapshot.auth.graceRemainingDays >= 0
      ? `grace ${snapshot.auth.graceRemainingDays}d`
      : 'no auth';
  return (
    `[telemetry] ${snapshot.storage.photoCount} foto's · ` +
    `${sizeMb}MB · ${snapshot.sync.totalPending} pending · ` +
    `${snapshot.sync.conflicts} conflicts · ${grace} · ` +
    `health ${health}`
  );
}

// ─── Safe wrappers — falen niet bij missing storage ─────────────────────────

async function countPhotos(): Promise<number> {
  try {
    const store = await getOfflineStorage();
    const rows = await store.listEvidence();
    return rows.length;
  } catch {
    return 0;
  }
}

async function safeGetBytes(): Promise<number> {
  try {
    return await getApproximateLocalStorageBytes();
  } catch {
    return 0;
  }
}

async function safeGetRetrySummary(): Promise<RetrySummary> {
  try {
    return await getRetrySummary();
  } catch {
    return {
      totalPending: 0,
      awaitingRetry: 0,
      exhausted: 0,
      succeededLastHour: 0,
      oldestPendingIso: null,
    };
  }
}

async function safeCountConflicts(): Promise<number> {
  try {
    return await countConflicts();
  } catch {
    return 0;
  }
}

async function safeGetGraceMs(): Promise<number> {
  try {
    return await getGraceRemainingMs();
  } catch {
    return -1;
  }
}

async function safeGetBrandingAge(): Promise<number> {
  try {
    return await getCacheAgeMs();
  } catch {
    return -1;
  }
}
