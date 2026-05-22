/**
 * offlineDb — platform-aware lokale opslag voor Dual-Mode (Offline-mode).
 *
 * Een tweekoppige adapter:
 *  - Native (iOS/Android): expo-sqlite — relationele tabellen + indexen
 *  - Web: localforage (IndexedDB) — key-value, met geserialiseerde records
 *
 * Beide kanten exposeren één gezamenlijke interface zodat LocalEvidenceRepository
 * agnostisch is van de onderliggende store. Schema-init gebeurt op startup
 * (idempotent).
 *
 * Tabellen / collections:
 *  1. evidence_local      — alle vastleggingen (lokaal-gecreëerd of cloud-synced)
 *  2. sync_queue          — operaties die wachten op netwerk om te syncen
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (Week 2 deliverable).
 */

import { Platform } from 'react-native';
import localforage from 'localforage';
import { runOfflineMigrations } from './offlineMigrations';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LocalEvidenceRow {
  /** Lokale primary key — auto-increment of generated UUID */
  id: number;
  /** UUID gegenereerd door client — gebruikt voor sync-tracking + dedupe */
  uuid: string;
  /** Server-side ID — NULL totdat sync slaagt */
  remote_id: number | null;
  project_id: string | null;
  inspection_point_id: string | null;
  photo_uri: string | null;
  media_uri: string | null;
  timestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  exif_hash: string | null;
  exif_verified: number | null;
  field_note: string | null;
  betonkwaliteit: string | null;
  milieuklasse: string | null;
  volume: string | null;
  leverdatum: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_notes: string | null;
  /** pending | syncing | synced | error */
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
  /** Monotonous client-version voor Last-Write-Wins conflict-resolution */
  client_version: number;
}

export interface SyncQueueRow {
  id: number;
  evidence_uuid: string;
  operation: 'create' | 'update' | 'delete';
  payload: string; // JSON-string
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
}

// ─── Common adapter interface ────────────────────────────────────────────────

export interface OfflineStorage {
  init(): Promise<void>;
  // evidence_local
  insertEvidence(row: Omit<LocalEvidenceRow, 'id'>): Promise<LocalEvidenceRow>;
  updateEvidence(uuid: string, patch: Partial<LocalEvidenceRow>): Promise<void>;
  getEvidence(uuid: string): Promise<LocalEvidenceRow | null>;
  listEvidence(filter?: { projectId?: string }): Promise<LocalEvidenceRow[]>;
  // sync_queue
  enqueueSyncOperation(row: Omit<SyncQueueRow, 'id'>): Promise<void>;
  listPendingSync(): Promise<SyncQueueRow[]>;
  removeSyncOperation(id: number): Promise<void>;
  markSyncAttempt(id: number, error: string | null): Promise<void>;
  // utility
  clearAll(): Promise<void>;
}

// ─── Native (SQLite via expo-sqlite) ─────────────────────────────────────────

async function createNativeStorage(): Promise<OfflineStorage> {
  // Lazy-import zodat web-bundle expo-sqlite niet meeneemt
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync('speeq_offline.db');

  // Schema init (idempotent — IF NOT EXISTS)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS evidence_local (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid                     TEXT NOT NULL UNIQUE,
      remote_id                INTEGER,
      project_id               TEXT,
      inspection_point_id      TEXT,
      photo_uri                TEXT,
      media_uri                TEXT,
      timestamp                TEXT,
      latitude                 REAL,
      longitude                REAL,
      gps_accuracy             REAL,
      exif_hash                TEXT,
      exif_verified            INTEGER,
      field_note               TEXT,
      betonkwaliteit           TEXT,
      milieuklasse             TEXT,
      volume                   TEXT,
      leverdatum               TEXT,
      ai_status                TEXT,
      ai_confidence            REAL,
      ai_notes                 TEXT,
      sync_status              TEXT NOT NULL DEFAULT 'pending',
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL,
      last_sync_at             TEXT,
      client_version           INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS evidence_local_project_idx ON evidence_local(project_id);
    CREATE INDEX IF NOT EXISTS evidence_local_sync_idx ON evidence_local(sync_status);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_uuid   TEXT NOT NULL,
      operation       TEXT NOT NULL,
      payload         TEXT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      last_error      TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sync_queue_evidence_idx ON sync_queue(evidence_uuid);
  `);

  // Voer pending migrations uit (versie > user_version). Bestaande v1-DBs
  // worden niet opnieuw aangemaakt — alleen delta-migrations naar v2+.
  try {
    const migrationResult = await runOfflineMigrations(db);
    if (migrationResult.applied.length > 0) {
      console.info(
        `[offlineDb] migrations toegepast: v${migrationResult.startedAtVersion} → v${migrationResult.finishedAtVersion} ` +
          `(${migrationResult.applied.length} stappen)`,
      );
    }
  } catch (err) {
    console.warn('[offlineDb] migration-runner fout:', err);
  }

  return {
    async init() {
      // Reeds boven via execAsync gebeurd.
    },

    async insertEvidence(row) {
      const result = await db.runAsync(
        `INSERT INTO evidence_local
          (uuid, remote_id, project_id, inspection_point_id, photo_uri, media_uri,
           timestamp, latitude, longitude, gps_accuracy, exif_hash, exif_verified,
           field_note, betonkwaliteit, milieuklasse, volume, leverdatum,
           ai_status, ai_confidence, ai_notes, sync_status,
           created_at, updated_at, last_sync_at, client_version)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          row.uuid, row.remote_id, row.project_id, row.inspection_point_id,
          row.photo_uri, row.media_uri, row.timestamp,
          row.latitude, row.longitude, row.gps_accuracy,
          row.exif_hash, row.exif_verified,
          row.field_note, row.betonkwaliteit, row.milieuklasse,
          row.volume, row.leverdatum,
          row.ai_status, row.ai_confidence, row.ai_notes, row.sync_status,
          row.created_at, row.updated_at, row.last_sync_at, row.client_version,
        ],
      );
      return { ...row, id: result.lastInsertRowId };
    },

    async updateEvidence(uuid, patch) {
      const entries = Object.entries(patch).filter(([k]) => k !== 'id' && k !== 'uuid');
      if (entries.length === 0) return;
      const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
      const values = entries.map(([, v]) => v as any);
      await db.runAsync(
        `UPDATE evidence_local SET ${setClause}, updated_at = ?, client_version = client_version + 1
         WHERE uuid = ?`,
        [...values, new Date().toISOString(), uuid],
      );
    },

    async getEvidence(uuid) {
      const row = await db.getFirstAsync<LocalEvidenceRow>(
        `SELECT * FROM evidence_local WHERE uuid = ?`,
        [uuid],
      );
      return row ?? null;
    },

    async listEvidence(filter) {
      const projectId = filter?.projectId;
      const rows = projectId
        ? await db.getAllAsync<LocalEvidenceRow>(
            `SELECT * FROM evidence_local WHERE project_id = ? ORDER BY timestamp DESC`,
            [projectId],
          )
        : await db.getAllAsync<LocalEvidenceRow>(
            `SELECT * FROM evidence_local ORDER BY timestamp DESC`,
          );
      return rows ?? [];
    },

    async enqueueSyncOperation(row) {
      await db.runAsync(
        `INSERT INTO sync_queue
          (evidence_uuid, operation, payload, attempts, last_attempt_at, last_error, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [
          row.evidence_uuid, row.operation, row.payload,
          row.attempts, row.last_attempt_at, row.last_error, row.created_at,
        ],
      );
    },

    async listPendingSync() {
      const rows = await db.getAllAsync<SyncQueueRow>(
        `SELECT * FROM sync_queue ORDER BY created_at ASC`,
      );
      return rows ?? [];
    },

    async removeSyncOperation(id) {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
    },

    async markSyncAttempt(id, error) {
      await db.runAsync(
        `UPDATE sync_queue
         SET attempts = attempts + 1, last_attempt_at = ?, last_error = ?
         WHERE id = ?`,
        [new Date().toISOString(), error, id],
      );
    },

    async clearAll() {
      await db.execAsync(`
        DELETE FROM evidence_local;
        DELETE FROM sync_queue;
      `);
    },
  };
}

// ─── Web (IndexedDB via localforage) ─────────────────────────────────────────

async function createWebStorage(): Promise<OfflineStorage> {
  const evidenceStore = localforage.createInstance({
    name: 'speeq_offline',
    storeName: 'evidence_local',
  });
  const syncStore = localforage.createInstance({
    name: 'speeq_offline',
    storeName: 'sync_queue',
  });

  // Auto-increment counters via simpele meta-store
  const metaStore = localforage.createInstance({
    name: 'speeq_offline',
    storeName: 'meta',
  });

  async function nextId(counterKey: string): Promise<number> {
    const current = ((await metaStore.getItem<number>(counterKey)) ?? 0) + 1;
    await metaStore.setItem(counterKey, current);
    return current;
  }

  return {
    async init() {
      // localforage zelf vereist geen init — instances zijn lazy
    },

    async insertEvidence(row) {
      const id = await nextId('evidence_id');
      const full: LocalEvidenceRow = { ...row, id };
      await evidenceStore.setItem(row.uuid, full);
      return full;
    },

    async updateEvidence(uuid, patch) {
      const existing = await evidenceStore.getItem<LocalEvidenceRow>(uuid);
      if (!existing) return;
      const updated: LocalEvidenceRow = {
        ...existing,
        ...patch,
        uuid: existing.uuid,
        id: existing.id,
        updated_at: new Date().toISOString(),
        client_version: existing.client_version + 1,
      };
      await evidenceStore.setItem(uuid, updated);
    },

    async getEvidence(uuid) {
      return (await evidenceStore.getItem<LocalEvidenceRow>(uuid)) ?? null;
    },

    async listEvidence(filter) {
      const all: LocalEvidenceRow[] = [];
      await evidenceStore.iterate<LocalEvidenceRow, void>((value) => {
        all.push(value);
      });
      const filtered = filter?.projectId
        ? all.filter((r) => r.project_id === filter.projectId)
        : all;
      return filtered.sort((a, b) =>
        (b.timestamp ?? '').localeCompare(a.timestamp ?? ''),
      );
    },

    async enqueueSyncOperation(row) {
      const id = await nextId('sync_id');
      await syncStore.setItem(String(id), { ...row, id });
    },

    async listPendingSync() {
      const all: SyncQueueRow[] = [];
      await syncStore.iterate<SyncQueueRow, void>((value) => {
        all.push(value);
      });
      return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async removeSyncOperation(id) {
      await syncStore.removeItem(String(id));
    },

    async markSyncAttempt(id, error) {
      const row = await syncStore.getItem<SyncQueueRow>(String(id));
      if (!row) return;
      const updated: SyncQueueRow = {
        ...row,
        attempts: row.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: error,
      };
      await syncStore.setItem(String(id), updated);
    },

    async clearAll() {
      await evidenceStore.clear();
      await syncStore.clear();
      await metaStore.clear();
    },
  };
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let cachedStorage: OfflineStorage | null = null;
let initPromise: Promise<OfflineStorage> | null = null;

/**
 * Eén gedeelde instantie van OfflineStorage per app-runtime.
 * Lazy-init bij eerste aanroep — kies platform-implementatie.
 */
export async function getOfflineStorage(): Promise<OfflineStorage> {
  if (cachedStorage) return cachedStorage;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const impl = Platform.OS === 'web'
      ? await createWebStorage()
      : await createNativeStorage();
    await impl.init();
    cachedStorage = impl;
    return impl;
  })();

  return initPromise;
}

/**
 * UUID-generator — RFC4122 v4. Voorkomt expo-crypto dependency.
 */
export function generateEvidenceUuid(): string {
  // crypto.randomUUID() is beschikbaar op moderne RN + web
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: pseudo-random (niet cryptografisch, maar uniek genoeg voor sync-keys)
  const chars = '0123456789abcdef';
  const arr: string[] = [];
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) arr.push('-');
    if (i === 12) arr.push('4');
    else if (i === 16) arr.push(chars[(Math.random() * 4) | 0 | 8]);
    else arr.push(chars[(Math.random() * 16) | 0]);
  }
  return arr.join('');
}
