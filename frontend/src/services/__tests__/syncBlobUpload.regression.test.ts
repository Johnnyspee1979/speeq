/**
 * Sprint 8 — REGRESSIETEST: sync.ts mag NOOIT meer base64-roundtrippen.
 *
 * Achtergrond: vóór Sprint 8 deed de offline-sync per foto:
 *   fetch → arrayBuffer → handmatige byte-loop → btoa → decode → upload
 * Dit blokkeerde de main thread ~10s bij 150 foto's offline en triggerde
 * de Android OOM-killer. Sprint 8 vervangt dit door directe Blob-upload
 * via fetch().blob() of getOfflinePhotoBlob() uit IndexedDB.
 *
 * Deze test leest de SOURCE TEXT van sync.ts en OfflinePhotoStore.ts en
 * faalt als iemand de oude anti-patterns reintroduceert. Geen mocks,
 * geen runtime — pure statische assertions over de codebase.
 *
 * Als deze test faalt, is een PR onbedoeld een prestatiebug aan het
 * herintroduceren. Lees `frontend/src/services/sync.ts` en herstel de
 * directe Blob-upload, of update deze test EXPLICIET met argument.
 */

import * as fs from 'fs';
import * as path from 'path';

const SYNC_PATH = path.join(__dirname, '..', 'sync.ts');
const STORE_PATH = path.join(__dirname, '..', 'OfflinePhotoStore.ts');

const syncSource = fs.readFileSync(SYNC_PATH, 'utf8');
const storeSource = fs.readFileSync(STORE_PATH, 'utf8');

// Stripe alle commentaarregels uit de source vóór we anti-patterns checken.
// Anders triggert deze test op de uitleg-comments die juist beschrijven
// waarom we die patterns NIET meer mogen gebruiken.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // /* ... */
    .replace(/\/\/.*$/gm, '');          // // ...
}

const syncCode = stripComments(syncSource);
const storeCode = stripComments(storeSource);

describe('Sprint 8 — sync blob-upload regressietest', () => {
  describe('sync.ts mag geen base64-roundtrip meer doen', () => {
    it('bevat GEEN handmatige byte → string loop (String.fromCharCode in for-loop)', () => {
      // Deze regex matched de oude `for (...) binary += String.fromCharCode(bytes[i])` patroon
      const bytePattern = /for\s*\([^)]*\)\s*\{?\s*\w+\s*\+=\s*String\.fromCharCode\s*\(\s*\w+\s*\[\s*\w+\s*\]/;
      expect(syncCode).not.toMatch(bytePattern);
    });

    it('roept GEEN btoa(...) aan op een handmatig opgebouwde binary string', () => {
      // btoa(binary) of btoa(<lange string>) in upload-context = base64 inflate
      expect(syncCode).not.toMatch(/btoa\s*\(\s*binary\s*\)/);
    });

    it('roept GEEN decode(base64) aan binnen syncEvidenceToCloud (web pad)', () => {
      // De variable name `base64` als let in de upload-loop was de smoking gun
      expect(syncCode).not.toMatch(/let\s+base64\s*:\s*string\s*;/);
    });
  });

  describe('sync.ts gebruikt het juiste blob-pad', () => {
    it('importeert getOfflinePhotoBlob uit OfflinePhotoStore', () => {
      expect(syncSource).toMatch(/getOfflinePhotoBlob/);
      expect(syncSource).toMatch(/from\s+['"]\.\/OfflinePhotoStore['"]/);
    });

    it('roept getOfflinePhotoBlob aan in de web upload-pad', () => {
      expect(syncCode).toMatch(/getOfflinePhotoBlob\s*\(\s*item\.id\s*\)/);
    });

    it('upload de body als Blob | ArrayBuffer, niet als base64 string', () => {
      // Type-annotatie van de upload-variabele
      expect(syncCode).toMatch(/uploadBody\s*:\s*Blob\s*\|\s*ArrayBuffer/);
    });
  });

  describe('OfflinePhotoStore.ts slaat foto op als native Blob', () => {
    it('exporteert getOfflinePhotoBlob als publieke functie', () => {
      expect(storeCode).toMatch(/export\s+async\s+function\s+getOfflinePhotoBlob/);
    });

    it('idbPut accepteert het StoredValue type (Blob | string)', () => {
      // Het opslagformaat moet Blob ondersteunen, niet alleen string
      expect(storeCode).toMatch(/StoredValue/);
      expect(storeCode).toMatch(/type\s+StoredValue\s*=\s*Blob\s*\|\s*string/);
    });

    it('persistOfflinePhoto schrijft een Blob naar IndexedDB (geen data-URL meer)', () => {
      // De put-call moet `blob` als value gebruiken, niet `dataUrl`
      expect(storeCode).toMatch(/idbPut\s*\(\s*db\s*,\s*evidenceId\s*,\s*blob\s*\)/);
      // De OUDE regel idbPut(db, evidenceId, dataUrl) mag niet meer bestaan
      expect(storeCode).not.toMatch(/idbPut\s*\(\s*db\s*,\s*evidenceId\s*,\s*dataUrl\s*\)/);
    });
  });
});
