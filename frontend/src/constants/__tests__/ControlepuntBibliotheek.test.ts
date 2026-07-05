/**
 * @jest-environment node
 *
 * Struct-invariant-tests voor de CONTROLEPUNT_BIBLIOTHEEK — de offline,
 * lokaal gebundelde lijst die vrije veldnotities mapt naar gestandaardiseerde
 * gebrek-namen. De typeahead en het dossier vertrouwen op stabiele slug-id's,
 * geldige categorieën en bruikbare synoniem/trefwoord-lijsten.
 *
 * We borgen: unieke slug-id's (id is "stabiel, verandert nooit"), geldig
 * slug-formaat, niet-lege naam/omschrijving, geldige categorie-enum, en
 * synoniemen/trefwoorden als niet-lege lijsten van niet-lege strings zonder
 * duplicaten bínnen één entry. (Synoniemen mogen bewust over categorieën heen
 * overlappen — dat dwingen we niet af.)
 */

import {
  CONTROLEPUNT_BIBLIOTHEEK,
  type ControlepuntCategorie,
} from '../ControlepuntBibliotheek';

const CATEGORIES = new Set<ControlepuntCategorie>([
  'BOUW',
  'BOUWFYSICA',
  'INSTALLATIE',
  'ELEKTRA',
  'BRANDVEILIGHEID',
  'AFBOUW_SCHILDER',
]);
const SLUG = /^[a-z0-9-]+$/;

describe('CONTROLEPUNT_BIBLIOTHEEK', () => {
  it('bevat controlepunten', () => {
    expect(CONTROLEPUNT_BIBLIOTHEEK.length).toBeGreaterThan(0);
  });

  it('heeft unieke slug-id-s', () => {
    const ids = CONTROLEPUNT_BIBLIOTHEEK.map((c) => c.id);
    const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    expect(dups).toEqual([]);
  });

  it('heeft geldig slug-formaat voor elk id', () => {
    const bad = CONTROLEPUNT_BIBLIOTHEEK.filter((c) => !SLUG.test(c.id)).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('heeft niet-lege naam en omschrijving', () => {
    const bad = CONTROLEPUNT_BIBLIOTHEEK.filter(
      (c) => c.naam.trim() === '' || c.omschrijving.trim() === '',
    ).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('gebruikt alleen geldige categorieën', () => {
    const bad = CONTROLEPUNT_BIBLIOTHEEK.filter((c) => !CATEGORIES.has(c.categorie)).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('heeft niet-lege synoniemen en trefwoorden (niet-lege strings)', () => {
    const bad = CONTROLEPUNT_BIBLIOTHEEK.filter((c) => {
      const lists = [c.synoniemen, c.trefwoorden];
      return lists.some(
        (l) => !Array.isArray(l) || l.length === 0 || l.some((s) => typeof s !== 'string' || s.trim() === ''),
      );
    }).map((c) => c.id);
    expect(bad).toEqual([]);
  });

  it('heeft geen dubbele synoniemen binnen één controlepunt', () => {
    const offenders = CONTROLEPUNT_BIBLIOTHEEK.filter((c) => {
      const lower = c.synoniemen.map((s) => s.toLowerCase());
      return new Set(lower).size !== lower.length;
    }).map((c) => c.id);
    expect(offenders).toEqual([]);
  });
});
