/**
 * offlineMigrations — versioneer-systeem voor lokale SQLite (native).
 *
 * Probleem dat dit oplost: zonder migration-runner verliezen klanten
 * hun lokale offline-data zodra we een kolom toevoegen aan
 * evidence_local (CREATE TABLE IF NOT EXISTS doet dan niets en bestaande
 * rows missen de nieuwe kolom).
 *
 * Hoe het werkt:
 *  1. Bij eerste run: PRAGMA user_version = 0 (default)
 *  2. Run alle migrations met versie > user_version
 *  3. PRAGMA user_version = laatste-versie
 *
 * SQLite's `user_version` is een 32-bit integer in de DB-header — perfect
 * voor dit doel. Geen aparte tabel nodig.
 *
 * Migrations zijn append-only — verwijder of herschrijf NOOIT een bestaande.
 * Voeg alleen toe met een hogere versie-nummer.
 *
 * Web (IndexedDB via localforage) gebruikt key-value en heeft géén schema
 * — daar volstaat IndexedDB's eigen onupgradeneeded (niet via deze runner).
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md §8.
 */

// Type voor de db-handle uit expo-sqlite (loosely typed om coupling te vermijden)
type SqlDb = {
  execAsync(sql: string): Promise<unknown>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
};

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

// ─── Migration register ──────────────────────────────────────────────────────

/**
 * APPEND-ONLY. Nooit een bestaande entry wijzigen of verwijderen — anders
 * lopen bestaande klant-DB's uit sync met productie-schema.
 *
 * Versie 1 = initial schema (al inline in createNativeStorage gedaan).
 * Volgende migrations beginnen bij versie 2.
 */
export const OFFLINE_MIGRATIONS: Migration[] = [
  // Versie 1 wordt niet hier herhaald — die zit als CREATE TABLE IF NOT EXISTS
  // in offlineDb.ts en is idempotent. Bij eerste run zet de migration-runner
  // user_version op MAX_VERSION zodat we niet alle CREATE-statements opnieuw
  // hoeven uit te voeren.
  //
  // VOORBEELD voor toekomstige migrations:
  //
  // {
  //   version: 2,
  //   description: 'Voeg ai_categories kolom toe voor lokale MobileNet output',
  //   sql: `ALTER TABLE evidence_local ADD COLUMN ai_categories TEXT;`,
  // },
];

export const LATEST_SCHEMA_VERSION =
  OFFLINE_MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 1);

// ─── Runner ──────────────────────────────────────────────────────────────────

interface UserVersionRow {
  user_version: number;
}

/**
 * Run alle openstaande migrations. Idempotent — herhaalde aanroepen
 * doen niets na de eerste keer.
 *
 * Aan te roepen in createNativeStorage NA de CREATE TABLE IF NOT EXISTS
 * blokken. Bij eerste install zijn alle tabellen al aangemaakt op v1;
 * bestaande klant-DBs krijgen dan alleen de delta-migrations vanaf v2+.
 */
export async function runOfflineMigrations(db: SqlDb): Promise<{
  startedAtVersion: number;
  finishedAtVersion: number;
  applied: Migration[];
}> {
  const versionRow = await db.getFirstAsync<UserVersionRow>(
    'PRAGMA user_version;',
  );
  const currentVersion = versionRow?.user_version ?? 0;

  // Eerste install: bestaande tabellen op v1, niet opnieuw bouwen
  if (currentVersion === 0) {
    await db.execAsync(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION};`);
    return {
      startedAtVersion: 0,
      finishedAtVersion: LATEST_SCHEMA_VERSION,
      applied: [],
    };
  }

  // Bepaal welke migrations nog moeten
  const pending = OFFLINE_MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) {
    return {
      startedAtVersion: currentVersion,
      finishedAtVersion: currentVersion,
      applied: [],
    };
  }

  const applied: Migration[] = [];
  for (const migration of pending) {
    try {
      await db.execAsync('BEGIN;');
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      await db.execAsync('COMMIT;');
      applied.push(migration);
    } catch (err) {
      // Best-effort rollback. Bij fout: stoppen — klant draait op
      // laatste-werkende versie. Console-log voor diagnose.
      try {
        await db.execAsync('ROLLBACK;');
      } catch {
        /* rollback eigen fout — negeren */
      }
      console.error(
        `[offlineMigrations] versie ${migration.version} faalde:`,
        err,
      );
      break;
    }
  }

  return {
    startedAtVersion: currentVersion,
    finishedAtVersion: applied.length
      ? applied[applied.length - 1].version
      : currentVersion,
    applied,
  };
}
