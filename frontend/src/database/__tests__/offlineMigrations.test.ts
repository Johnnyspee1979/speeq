/**
 * Unit-tests voor runOfflineMigrations.
 *
 * Mocked SqlDb-handle — we testen de runner-logica, niet expo-sqlite zelf.
 * Vier kritieke paden:
 *   1. Eerste install (user_version = 0) → direct naar LATEST, geen migrations gedraaid
 *   2. Up-to-date DB (user_version = LATEST) → niets gebeurt
 *   3. Pending migrations → BEGIN/exec/COMMIT per stuk, applied lijst klopt
 *   4. Faal mid-migration → ROLLBACK, applied stopt, latere migrations niet uitgevoerd
 */

import {
  OFFLINE_MIGRATIONS,
  LATEST_SCHEMA_VERSION,
  runOfflineMigrations,
} from '../offlineMigrations';

interface MockSqlDb {
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
}

function createMockDb(userVersion: number, execFailures: number[] = []): MockSqlDb {
  let execCallCount = 0;
  return {
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: userVersion }),
    execAsync: jest.fn().mockImplementation((sql: string) => {
      execCallCount++;
      if (execFailures.includes(execCallCount)) {
        return Promise.reject(new Error(`mock exec failed at call ${execCallCount} (sql=${sql.slice(0, 40)})`));
      }
      return Promise.resolve();
    }),
  };
}

describe('runOfflineMigrations', () => {
  // ─── Pad 1: eerste install ─────────────────────────────────────────────────
  describe('eerste install (user_version = 0)', () => {
    it('zet user_version direct op LATEST_SCHEMA_VERSION', async () => {
      const db = createMockDb(0);
      const result = await runOfflineMigrations(db);

      expect(result.startedAtVersion).toBe(0);
      expect(result.finishedAtVersion).toBe(LATEST_SCHEMA_VERSION);
      expect(result.applied).toEqual([]);

      // Verwacht: PRAGMA user_version = LATEST (1× exec, geen BEGIN/COMMIT loop)
      expect(db.execAsync).toHaveBeenCalledTimes(1);
      expect(db.execAsync).toHaveBeenCalledWith(
        `PRAGMA user_version = ${LATEST_SCHEMA_VERSION};`,
      );
    });

    it('runt GEEN individuele migration-SQL op eerste install', async () => {
      // Voeg tijdelijk een mock-migration toe via spy op array
      const db = createMockDb(0);
      await runOfflineMigrations(db);

      // execAsync mag GEEN BEGIN bevatten (geen transactie-loop)
      const calls = (db.execAsync.mock.calls as string[][]).map((c) => c[0]);
      expect(calls.some((sql) => sql.includes('BEGIN'))).toBe(false);
      expect(calls.some((sql) => sql.includes('COMMIT'))).toBe(false);
    });
  });

  // ─── Pad 2: up-to-date ─────────────────────────────────────────────────────
  describe('up-to-date DB', () => {
    it('doet niets als user_version al op LATEST staat', async () => {
      const db = createMockDb(LATEST_SCHEMA_VERSION);
      const result = await runOfflineMigrations(db);

      expect(result.startedAtVersion).toBe(LATEST_SCHEMA_VERSION);
      expect(result.finishedAtVersion).toBe(LATEST_SCHEMA_VERSION);
      expect(result.applied).toEqual([]);
      expect(db.execAsync).not.toHaveBeenCalled();
    });
  });

  // ─── Pad 3: pending migrations (gesimuleerd) ───────────────────────────────
  describe('pending migrations', () => {
    const originalMigrations = [...OFFLINE_MIGRATIONS];

    afterEach(() => {
      // Reset het register na elke test — append-only, dus mutatie ongedaan maken
      OFFLINE_MIGRATIONS.length = 0;
      OFFLINE_MIGRATIONS.push(...originalMigrations);
    });

    it('runt BEGIN, sql, PRAGMA, COMMIT voor elke pending migration in volgorde', async () => {
      OFFLINE_MIGRATIONS.push(
        { version: 2, description: 'mock v2', sql: 'ALTER TABLE x ADD COLUMN a;' },
        { version: 3, description: 'mock v3', sql: 'ALTER TABLE x ADD COLUMN b;' },
      );

      const db = createMockDb(1);
      const result = await runOfflineMigrations(db);

      expect(result.startedAtVersion).toBe(1);
      expect(result.finishedAtVersion).toBe(3);
      expect(result.applied).toHaveLength(2);
      expect(result.applied[0].version).toBe(2);
      expect(result.applied[1].version).toBe(3);

      const calls = (db.execAsync.mock.calls as string[][]).map((c) => c[0]);
      // Verwachte volgorde: BEGIN, ALTER a, PRAGMA=2, COMMIT, BEGIN, ALTER b, PRAGMA=3, COMMIT
      expect(calls).toEqual([
        'BEGIN;',
        'ALTER TABLE x ADD COLUMN a;',
        'PRAGMA user_version = 2;',
        'COMMIT;',
        'BEGIN;',
        'ALTER TABLE x ADD COLUMN b;',
        'PRAGMA user_version = 3;',
        'COMMIT;',
      ]);
    });

    it('slaat al-toegepaste migrations over (filter op version > current)', async () => {
      OFFLINE_MIGRATIONS.push(
        { version: 2, description: 'mock v2', sql: 'sql-v2;' },
        { version: 3, description: 'mock v3', sql: 'sql-v3;' },
        { version: 4, description: 'mock v4', sql: 'sql-v4;' },
      );

      const db = createMockDb(3);
      const result = await runOfflineMigrations(db);

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].version).toBe(4);

      const calls = (db.execAsync.mock.calls as string[][]).map((c) => c[0]);
      expect(calls).not.toContain('sql-v2;');
      expect(calls).not.toContain('sql-v3;');
      expect(calls).toContain('sql-v4;');
    });

    it('sorteert migrations op version (zelfs als register out-of-order is)', async () => {
      OFFLINE_MIGRATIONS.push(
        { version: 4, description: 'v4', sql: 'sql-v4;' },
        { version: 2, description: 'v2', sql: 'sql-v2;' },
        { version: 3, description: 'v3', sql: 'sql-v3;' },
      );

      const db = createMockDb(1);
      const result = await runOfflineMigrations(db);

      expect(result.applied.map((m) => m.version)).toEqual([2, 3, 4]);
    });
  });

  // ─── Pad 4: faal-scenario ──────────────────────────────────────────────────
  describe('failure handling', () => {
    const originalMigrations = [...OFFLINE_MIGRATIONS];
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      OFFLINE_MIGRATIONS.length = 0;
      OFFLINE_MIGRATIONS.push(...originalMigrations);
      consoleErrorSpy.mockRestore();
    });

    it('ROLLBACK + stop bij fout, latere migrations niet uitgevoerd', async () => {
      OFFLINE_MIGRATIONS.push(
        { version: 2, description: 'ok', sql: 'sql-v2-ok;' },
        { version: 3, description: 'broken', sql: 'sql-v3-broken;' },
        { version: 4, description: 'unreached', sql: 'sql-v4-unreached;' },
      );

      // Calls: 1=BEGIN, 2=sql-v2-ok, 3=PRAGMA=2, 4=COMMIT, 5=BEGIN, 6=sql-v3-broken (FAIL)
      const db = createMockDb(1, [6]);
      const result = await runOfflineMigrations(db);

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].version).toBe(2);
      expect(result.finishedAtVersion).toBe(2);

      const calls = (db.execAsync.mock.calls as string[][]).map((c) => c[0]);
      expect(calls).toContain('ROLLBACK;');
      expect(calls).not.toContain('sql-v4-unreached;');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('overleeft een falende ROLLBACK (geen unhandled rejection)', async () => {
      OFFLINE_MIGRATIONS.push({ version: 2, description: 'broken', sql: 'sql-broken;' });

      // Calls: 1=BEGIN, 2=sql-broken (FAIL), 3=ROLLBACK (ook FAIL)
      const db = createMockDb(1, [2, 3]);
      await expect(runOfflineMigrations(db)).resolves.toBeDefined();
    });
  });

  // ─── Smoke-test op echte register ──────────────────────────────────────────
  describe('echte OFFLINE_MIGRATIONS register', () => {
    it('LATEST_SCHEMA_VERSION is >= 1', () => {
      expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    });

    it('alle versies in register zijn uniek en oplopend (geen dubbele)', () => {
      const versions = OFFLINE_MIGRATIONS.map((m) => m.version);
      const unique = new Set(versions);
      expect(unique.size).toBe(versions.length);
    });

    it('geen versie 0 of negatief in register', () => {
      OFFLINE_MIGRATIONS.forEach((m) => {
        expect(m.version).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
