import { CONTROLEPUNT_BIBLIOTHEEK } from '../../constants/ControlepuntBibliotheek';
import {
  type Controlepunt,
  normalizeControlepunt,
  searchControlepunten,
  standaardiseerControlepuntNaam,
} from '../ControlepuntBibliotheekService';

describe('ControlepuntBibliotheekService — searchControlepunten', () => {
  it('returns a focused list (not the whole catalog) on an empty query', () => {
    const results = searchControlepunten('');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('respects the limit option on an empty query', () => {
    const results = searchControlepunten('', { limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('finds Scheurvorming when a vakman types the synonym "scheurtje"', () => {
    const results = searchControlepunten('scheurtje');
    expect(results.some((c) => c.id === 'scheurvorming')).toBe(true);
  });

  it('tolerates a small typo like "kondens"', () => {
    const results = searchControlepunten('kondens');
    expect(results.some((c) => c.id === 'condensvorming')).toBe(true);
  });

  it('finds the missing RCD point for a query like "geen aardlek"', () => {
    const results = searchControlepunten('geen aardlek');
    expect(results.some((c) => c.id === 'aardlek-ontbreekt')).toBe(true);
  });

  it('filters by categorie so only matching disciplines surface', () => {
    const results = searchControlepunten('', { categorie: 'ELEKTRA' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.categorie === 'ELEKTRA')).toBe(true);
  });

  it('searches tenant-eigen items alongside the base set', () => {
    const eigen: Controlepunt = {
      id: 'eigen-vloerverwarming-lek',
      naam: 'Lekkage vloerverwarming',
      categorie: 'INSTALLATIE',
      synoniemen: ['vloerverwarming lek', 'vvw lek'],
      trefwoorden: ['vloer', 'verwarming'],
      omschrijving: 'Tenant-eigen controlepunt.',
    };
    const results = searchControlepunten('vloerverwarming', { extra: [eigen] });
    expect(results.some((c) => c.id === 'eigen-vloerverwarming-lek')).toBe(true);
  });
});

describe('ControlepuntBibliotheekService — normalizeControlepunt', () => {
  it('maps an exact standardized name back to itself via "naam"', () => {
    const match = normalizeControlepunt('Scheurvorming');
    expect(match?.controlepunt.id).toBe('scheurvorming');
    expect(match?.via).toBe('naam');
  });

  it('is case- and accent-insensitive on the standardized name', () => {
    const match = normalizeControlepunt('verzakking / ZETTING');
    expect(match?.controlepunt.id).toBe('verzakking');
    expect(match?.via).toBe('naam');
  });

  it('maps a known synonym deterministically via "synoniem"', () => {
    const match = normalizeControlepunt('barst');
    expect(match?.controlepunt.id).toBe('scheurvorming');
    expect(match?.via).toBe('synoniem');
  });

  it('falls back to a fuzzy best-guess for a near-miss like "scheuren"', () => {
    // "scheuren" is not an exact synonym (those are "scheur"/"scheurtje"/…),
    // so it must reach the point through the fuzzy fallback path.
    const match = normalizeControlepunt('scheuren');
    expect(match?.controlepunt.id).toBe('scheurvorming');
    expect(match?.via).toBe('fuzzy');
  });

  it('returns null for an empty query', () => {
    expect(normalizeControlepunt('   ')).toBeNull();
  });

  it('returns null when nothing comes close', () => {
    expect(normalizeControlepunt('xyzzy qwerty zomaar')).toBeNull();
  });

  it('prefers an exact synonym over a fuzzy match', () => {
    // "kit" is an exact synonym of the kitnaad point; it must win deterministically.
    const match = normalizeControlepunt('kit');
    expect(match?.controlepunt.id).toBe('kitnaad-gebrekkig');
    expect(match?.via).toBe('synoniem');
  });
});

describe('ControlepuntBibliotheekService — standaardiseerControlepuntNaam', () => {
  it('turns "haarscheur" into the one fixed name "Scheurvorming"', () => {
    expect(standaardiseerControlepuntNaam('haarscheur')).toBe('Scheurvorming');
  });

  it('returns null when nothing matches', () => {
    expect(standaardiseerControlepuntNaam('xyzzy qwerty')).toBeNull();
  });
});

describe('ControlepuntBibliotheek — data integrity', () => {
  it('has unique ids', () => {
    const ids = CONTROLEPUNT_BIBLIOTHEEK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique standardized names', () => {
    const names = CONTROLEPUNT_BIBLIOTHEEK.map((c) => c.naam.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every controlepunt at least one synonym and keyword', () => {
    for (const c of CONTROLEPUNT_BIBLIOTHEEK) {
      expect(c.synoniemen.length).toBeGreaterThan(0);
      expect(c.trefwoorden.length).toBeGreaterThan(0);
      expect(c.omschrijving.trim().length).toBeGreaterThan(0);
    }
  });
});
