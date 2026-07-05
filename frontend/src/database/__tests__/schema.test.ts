/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor het lokale WatermelonDB-schema (database/schema.ts).
 * Dit schema beschrijft de offline `evidence`-tabel waar de capture-/sync-laag op
 * leest en schrijft. Een stille kolom-/type-wijziging zonder version-bump breekt
 * de migratie en daarmee de offline-sync. We borgen de vorm-invarianten die
 * stabiel horen te blijven:
 *  - schema-version is 3 en er is exact één tabel: `evidence`;
 *  - elke kolom heeft een geldig WatermelonDB-type (string|number|boolean);
 *  - de kern-kolommen bestaan met het juiste type (sync/AI/locatie/EXIF);
 *  - de geïndexeerde kolommen (lookup-paden) zijn daadwerkelijk geïndexeerd.
 *
 * BEWUST NIET afgedwongen: een exacte 1-op-1 kolomlijst — een nieuwe kolom mét
 * version-bump is legitiem en hoort deze test niet rood te maken. We locken het
 * contract waar de code op leunt, niet elke toekomstige uitbreiding.
 *
 * appSchema/tableSchema zijn pure builders → @jest-environment node.
 */

import { wkbSchema } from '../schema';

type Column = { name: string; type: string; isIndexed?: boolean; isOptional?: boolean };

const VALID_TYPES = new Set(['string', 'number', 'boolean']);

const evidence = (wkbSchema.tables as Record<string, { columns: Record<string, Column> }>)
  .evidence;
const columns = evidence.columns;

const REQUIRED_TYPES: Record<string, string> = {
  evidence_id: 'string',
  project_id: 'string',
  inspection_point_id: 'string',
  media_uri: 'string',
  timestamp: 'string',
  latitude: 'number',
  longitude: 'number',
  exif_hash: 'string',
  exif_verified: 'boolean',
  sync_status: 'string',
};

const INDEXED = ['evidence_id', 'project_id', 'inspection_point_id', 'sync_status'];

describe('wkbSchema (struct)', () => {
  it('heeft version 3 en exact één tabel: evidence', () => {
    expect(wkbSchema.version).toBe(3);
    expect(Object.keys(wkbSchema.tables)).toEqual(['evidence']);
    expect(evidence).toBeDefined();
  });

  it('heeft uitsluitend geldige WatermelonDB-kolomtypes', () => {
    const bad = Object.values(columns)
      .filter((c) => !VALID_TYPES.has(c.type))
      .map((c) => `${c.name}:${c.type}`);
    expect(bad).toEqual([]);
  });

  it('heeft de kern-kolommen met het juiste type', () => {
    const bad = Object.entries(REQUIRED_TYPES)
      .filter(([name, type]) => !columns[name] || columns[name].type !== type)
      .map(([name]) => name);
    expect(bad).toEqual([]);
  });

  it('indexeert de lookup-kolommen', () => {
    const notIndexed = INDEXED.filter((name) => columns[name]?.isIndexed !== true);
    expect(notIndexed).toEqual([]);
  });
});
