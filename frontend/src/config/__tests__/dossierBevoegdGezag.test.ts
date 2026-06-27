/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor de dossier-bevoegd-gezag-checklist
 * (DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN). Dit is de interne categorie-lijst die de
 * gereedmeld-/dossier-flow afvinkt; een onvolledige of dubbele categorie geeft
 * een verwarrende checklist of blokkeert de "compleet"-status onterecht. De
 * lijst is GEEN juridische norm (zie de bron-header) — Johnny stelt de
 * definitieve set vast — dus we borgen hier alleen de VORM-invarianten waar de
 * service/UI op leunt en die stabiel horen te blijven, niet de inhoud.
 *
 * We borgen:
 *  - de lijst is niet-leeg;
 *  - elke `id` is een unieke slug (a-z, 0-9, koppelteken);
 *  - `naam`, `omschrijving` en `todo` zijn niet-lege strings;
 *  - `autoBron` is exact 'EVIDENCE' of null (geen andere bron-waarde);
 *  - `nvtToegestaan` is een boolean.
 *
 * Pure data (alleen `export type`/`interface` + één const-array, geen RN/lucide-
 * import) → @jest-environment node.
 */

import {
  DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN,
  type DossierAutoBron,
} from '../dossierBevoegdGezag';

const SLUG = /^[a-z0-9-]+$/;
const AUTO_BRONNEN = new Set<DossierAutoBron>(['EVIDENCE', null]);

const isNonEmptyString = (v: unknown): boolean =>
  typeof v === 'string' && v.trim() !== '';

describe('DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN (struct)', () => {
  it('is een niet-lege lijst', () => {
    expect(DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.length).toBeGreaterThan(0);
  });

  it('heeft unieke slug-id-s', () => {
    const ids = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.map((c) => c.id);
    const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const badSlug = ids.filter((id) => !SLUG.test(id));
    expect(dups).toEqual([]);
    expect(badSlug).toEqual([]);
  });

  it('heeft niet-lege naam, omschrijving en todo', () => {
    const bad = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.filter(
      (c) =>
        !isNonEmptyString(c.naam) ||
        !isNonEmptyString(c.omschrijving) ||
        !isNonEmptyString(c.todo),
    ).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('heeft een geldige autoBron (EVIDENCE of null)', () => {
    const bad = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.filter(
      (c) => !AUTO_BRONNEN.has(c.autoBron),
    ).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('heeft nvtToegestaan als boolean', () => {
    const bad = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN.filter(
      (c) => typeof c.nvtToegestaan !== 'boolean',
    ).map((c) => c.id);
    expect(bad).toEqual([]);
  });
});
