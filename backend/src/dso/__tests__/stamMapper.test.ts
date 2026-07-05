/**
 * Tests voor de STAM-mapper (dso/stamMapper.ts → mapToStamPayload).
 *
 * Deze pure functie zet een rauw dossier-record om naar de payload die naar de
 * STAM-/DSO-koppeling van het bevoegd gezag gaat. Een fout hier stuurt de
 * verkeerde projectreferentie mee, mist de bewijslast of zet het meldingstype
 * fout — met een afgekeurde of incomplete melding tot gevolg.
 *
 * We borgen het feitelijke contract:
 *  - lege/ontbrekende velden vallen terug op 'onbekend' / 'BOUWMELDING' / [] / false;
 *  - type_melding 'GEREEDMELDING' levert GEREEDMELDING, al het andere BOUWMELDING;
 *  - strings worden getrimd;
 *  - per bewijs gelden de juiste fallback-ketens voor documentNaam, hash en url;
 *  - verklaring_akkoord wordt naar een echte boolean gecoerced.
 *
 * Pure CommonJS-module → geen mocks nodig.
 */

const { mapToStamPayload } = require('../stamMapper');

describe('mapToStamPayload — defaults', () => {
  it('valt terug op veilige defaults bij lege invoer', () => {
    const out = mapToStamPayload({});
    expect(out).toEqual({
      projectReferentie: 'onbekend',
      kwaliteitsborgerId: 'onbekend',
      typeMelding: 'BOUWMELDING',
      bewijslast: [],
      verklaringAkkoord: false,
    });
  });

  it('behandelt een niet-array bewijs als lege bewijslast', () => {
    expect(mapToStamPayload({ bewijs: 'geen-array' }).bewijslast).toEqual([]);
  });
});

describe('mapToStamPayload — kopvelden', () => {
  it('trimt project_id en kwaliteitsborger_regnr', () => {
    const out = mapToStamPayload({
      project_id: '  P-123  ',
      kwaliteitsborger_regnr: '  KB-9  ',
    });
    expect(out.projectReferentie).toBe('P-123');
    expect(out.kwaliteitsborgerId).toBe('KB-9');
  });

  it('zet typeMelding op GEREEDMELDING enkel bij exacte match', () => {
    expect(mapToStamPayload({ type_melding: 'GEREEDMELDING' }).typeMelding).toBe('GEREEDMELDING');
    expect(mapToStamPayload({ type_melding: 'bouwmelding' }).typeMelding).toBe('BOUWMELDING');
    expect(mapToStamPayload({}).typeMelding).toBe('BOUWMELDING');
  });

  it('coerced verklaring_akkoord naar een echte boolean', () => {
    expect(mapToStamPayload({ verklaring_akkoord: 1 }).verklaringAkkoord).toBe(true);
    expect(mapToStamPayload({ verklaring_akkoord: '' }).verklaringAkkoord).toBe(false);
    expect(mapToStamPayload({ verklaring_akkoord: true }).verklaringAkkoord).toBe(true);
  });
});

describe('mapToStamPayload — bewijslast', () => {
  it('gebruikt de fallback-keten voor documentNaam (document_naam > id > inspection_point_id > index)', () => {
    const out = mapToStamPayload({
      bewijs: [
        { document_naam: 'Foto A', exif_hash: 'h', photo_uri: 'u' },
        { id: 'EV-2', exif_hash: 'h', photo_uri: 'u' },
        { inspection_point_id: 'BP-3', exif_hash: 'h', photo_uri: 'u' },
        { exif_hash: 'h', photo_uri: 'u' },
      ],
    });
    expect(out.bewijslast.map((b: { documentNaam: string }) => b.documentNaam)).toEqual([
      'Foto A',
      'EV-2',
      'BP-3',
      'bewijs-4',
    ]);
  });

  it('neemt exif_hash en photo_uri over, met url-fallback naar download_url', () => {
    const out = mapToStamPayload({
      bewijs: [
        { document_naam: 'A', exif_hash: 'sha-1', photo_uri: 'https://x/a.jpg' },
        { document_naam: 'B', exif_hash: 'sha-2', download_url: 'https://x/b.jpg' },
      ],
    });
    expect(out.bewijslast[0]).toMatchObject({
      documentNaam: 'A',
      hashSha256: 'sha-1',
      downloadUrl: 'https://x/a.jpg',
    });
    expect(out.bewijslast[1]).toMatchObject({
      hashSha256: 'sha-2',
      downloadUrl: 'https://x/b.jpg',
    });
  });

  it('valt terug op een placeholder-hash en fallback-url als die ontbreken', () => {
    const out = mapToStamPayload({ bewijs: [{ document_naam: 'A' }] });
    expect(out.bewijslast[0].hashSha256).toMatch(/^WKB-HASH-PLACEHOLDER-/);
    expect(out.bewijslast[0].downloadUrl).toBe('https://storage.supabase.com/fallback');
  });
});
