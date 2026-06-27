/**
 * @jest-environment node
 *
 * Struct- en consistentie-tests voor de WatermelonDB-migraties (database/
 * migrations.ts) in samenhang met het schema (database/schema.ts). Migraties
 * brengen bestaande offline-databases naar de huidige schema-version; als ze uit
 * de pas lopen met het schema mislukt de upgrade en raakt lokale evidence
 * onbereikbaar. We borgen de invarianten die schema en migraties gekoppeld
 * houden:
 *  - de migratie-set is gevalideerd (validated === true);
 *  - maxVersion van de migraties === schema-version (geen drift);
 *  - toVersion-stappen lopen strikt oplopend;
 *  - elke stap is een add_columns op de evidence-tabel;
 *  - ELKE in een migratie toegevoegde kolom bestaat in het schema met hetzelfde
 *    type en dezelfde optionaliteit (referentiële consistentie schema↔migratie).
 *
 * appSchema/schemaMigrations zijn pure builders → @jest-environment node.
 */

import { wkbMigrations } from '../migrations';
import { wkbSchema } from '../schema';

type Column = { name: string; type: string; isOptional?: boolean };
type Step = { type: string; table: string; columns?: Column[] };
type Migration = { toVersion: number; steps: Step[] };

const mig = wkbMigrations as unknown as {
  sortedMigrations: Migration[];
  minVersion: number;
  maxVersion: number;
  validated: boolean;
};

const schemaColumns = (
  wkbSchema.tables as Record<string, { columns: Record<string, Column> }>
).evidence.columns;

describe('wkbMigrations (struct)', () => {
  it('is gevalideerd', () => {
    expect(mig.validated).toBe(true);
  });

  it('heeft maxVersion gelijk aan de schema-version', () => {
    expect(mig.maxVersion).toBe(wkbSchema.version);
  });

  it('heeft strikt oplopende toVersion-stappen', () => {
    const versions = mig.sortedMigrations.map((m) => m.toVersion);
    const ascending = versions.every((v, i) => i === 0 || v > versions[i - 1]);
    expect(ascending).toBe(true);
  });

  it('bevat uitsluitend add_columns-stappen op de evidence-tabel', () => {
    const bad = mig.sortedMigrations.flatMap((m) =>
      m.steps
        .filter((s) => s.type !== 'add_columns' || s.table !== 'evidence')
        .map((s) => `v${m.toVersion}:${s.type}:${s.table}`),
    );
    expect(bad).toEqual([]);
  });
});

describe('migratie ↔ schema consistentie', () => {
  it('voegt alleen kolommen toe die in het schema bestaan met gelijk type/optionaliteit', () => {
    const mismatches: string[] = [];
    for (const m of mig.sortedMigrations) {
      for (const step of m.steps) {
        for (const col of step.columns ?? []) {
          const schemaCol = schemaColumns[col.name];
          if (
            !schemaCol ||
            schemaCol.type !== col.type ||
            Boolean(schemaCol.isOptional) !== Boolean(col.isOptional)
          ) {
            mismatches.push(`v${m.toVersion}:${col.name}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
