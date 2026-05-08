/**
 * Sprint 8 — REGRESSIETEST: sync.ts mag een WKB_LOCKED-error NOOIT meer retryen.
 *
 * Achtergrond: Sprint 3 lockte dossiers, Sprint 8 voegt een Postgres
 * INSERT-trigger toe (`evidence_insert_lock_guard`) die nieuwe rijen
 * weigert in een afgesloten dossier. De backend gooit dan:
 *   'WKB_LOCKED: Dossier is afgesloten op ...'
 *
 * De PWA sync-engine MOET die error herkennen en het item meteen op
 * FAILED zetten, zonder de drie MAX_SYNC_RETRIES op te branden.
 * Anders draaien we batterij + cellulair door op uploads die de DB
 * juridisch nooit zal accepteren.
 *
 * Deze test leest de SOURCE TEXT van sync.ts en faalt als iemand
 * de WKB_LOCKED early-out per ongeluk schrapt of door het retry-pad
 * laat lopen. Geen mocks, geen runtime — pure statische assertions.
 *
 * Als deze test faalt: lees `frontend/src/services/sync.ts` rond
 * de catch-block en herstel het `if (reason.includes('WKB_LOCKED'))`
 * pad VÓÓR de retry-logica. Of update deze test EXPLICIET met argument.
 */

import * as fs from 'fs';
import * as path from 'path';

const SYNC_PATH = path.join(__dirname, '..', 'sync.ts');
const syncSource = fs.readFileSync(SYNC_PATH, 'utf8');

// Strip comments zodat de test niet triggert op uitleg-comments die
// juist beschrijven WAAROM dit pad bestaat.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const syncCode = stripComments(syncSource);

describe('Sprint 8 — sync WKB_LOCKED regressietest', () => {
  it('bevat de WKB_LOCKED early-out in het catch-pad', () => {
    expect(syncCode).toMatch(/reason\.includes\(\s*['"]WKB_LOCKED['"]\s*\)/);
  });

  it('roept continue aan bij WKB_LOCKED (skip retry-loop)', () => {
    // We zoeken een if-block dat WKB_LOCKED checkt en eindigt op continue;
    const blockPattern =
      /reason\.includes\(\s*['"]WKB_LOCKED['"]\s*\)[\s\S]{0,400}?continue\s*;/;
    expect(syncCode).toMatch(blockPattern);
  });

  it('de WKB_LOCKED check staat VÓÓR de MAX_SYNC_RETRIES check', () => {
    const wkbIdx = syncCode.indexOf("reason.includes('WKB_LOCKED')");
    const wkbIdxAlt = syncCode.indexOf('reason.includes("WKB_LOCKED")');
    const checkIdx = wkbIdx >= 0 ? wkbIdx : wkbIdxAlt;
    const retryIdx = syncCode.indexOf('MAX_SYNC_RETRIES');
    expect(checkIdx).toBeGreaterThan(0);
    expect(retryIdx).toBeGreaterThan(0);
    // De binnenste retry-check (de `if (retryCount >= MAX_SYNC_RETRIES)` regel)
    // moet ná het WKB_LOCKED-pad komen.
    const innerRetryIdx = syncCode.indexOf(
      'retryCount >= MAX_SYNC_RETRIES'
    );
    expect(innerRetryIdx).toBeGreaterThan(checkIdx);
  });

  it('roept markEvidenceSyncFailed aan in het WKB_LOCKED-pad', () => {
    // De rowId moet als FAILED gemarkeerd worden zodat de UI hem
    // niet eindeloos op PENDING laat staan.
    const blockPattern =
      /reason\.includes\(\s*['"]WKB_LOCKED['"]\s*\)[\s\S]{0,400}?markEvidenceSyncFailed/;
    expect(syncCode).toMatch(blockPattern);
  });
});
