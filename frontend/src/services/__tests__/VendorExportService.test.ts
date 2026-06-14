import { createHash } from 'crypto';
import {
  type DossierBron,
  type ManifestBron,
  EXPORT_SCHEMA_VERSIE,
  bouwDossierJson,
  bouwManifest,
  formatManifest,
  normaliseerStatus,
  vatManifestSamen,
} from '../VendorExportService';

// Deterministische SHA-256 via Node (i.p.v. expo-crypto in test).
const nodeHash = async (input: string): Promise<string> =>
  createHash('sha256').update(input, 'utf8').digest('hex');

const bron: DossierBron = {
  project: { id: 'p-1', naam: 'Woning 12', gevolgklasse: 'GK1', projecttype: 'gk1' },
  controlepunten: [
    {
      id: 'cp-101',
      omschrijving: 'Wapening fundering',
      status: 'akkoord',
      discipline: 'constructie',
      vastlegdatum: '2026-06-01T10:14:00.000Z',
      verantwoordelijke: 'J. Vakman',
      fotos: ['bijlagen/cp-101-1.jpg'],
    },
  ],
};

describe('VendorExportService — normaliseerStatus', () => {
  it('mapt ruwe statussen naar vendor-neutraal', () => {
    expect(normaliseerStatus('APPROVED')).toBe('akkoord');
    expect(normaliseerStatus('FINALIZED')).toBe('akkoord');
    expect(normaliseerStatus('PENDING_REVIEW')).toBe('in_behandeling');
    expect(normaliseerStatus('REJECTED')).toBe('afgekeurd');
    expect(normaliseerStatus(null)).toBe('onbekend');
    expect(normaliseerStatus('iets')).toBe('onbekend');
  });
});

describe('VendorExportService — bouwDossierJson', () => {
  it('zet schemaVersie + gegenereerdAt en vult lege secties', () => {
    const json = bouwDossierJson({ project: { id: 'p-1', naam: 'X' } }, '2026-06-14T12:00:00.000Z');
    expect(json.schemaVersie).toBe(EXPORT_SCHEMA_VERSIE);
    expect(json.gegenereerdAt).toBe('2026-06-14T12:00:00.000Z');
    expect(json.controlepunten).toEqual([]);
    expect(json.afwijkingen).toEqual([]);
    expect(json.bijlagen).toEqual([]);
    expect(json.risicobeoordeling).toBeNull();
  });

  it('neemt controlepunten 1-op-1 over', () => {
    const json = bouwDossierJson(bron, '2026-06-14T12:00:00.000Z');
    expect(json.controlepunten).toHaveLength(1);
    expect(json.controlepunten[0]).toMatchObject({ id: 'cp-101', status: 'akkoord' });
  });
});

describe('VendorExportService — bouwManifest', () => {
  it('hasht aanwezige bestanden met SHA-256', async () => {
    const bestanden: ManifestBron[] = [{ pad: 'dossier.json', inhoud: '{"a":1}' }];
    const regels = await bouwManifest(bestanden, nodeHash);
    expect(regels[0].status).toBe('OK');
    expect(regels[0].sha256).toBe(await nodeHash('{"a":1}'));
    expect(regels[0].bytes).toBe(7);
  });

  it('ontbrekende bijlage → ONTBREEKT zonder de export te stoppen', async () => {
    const bestanden: ManifestBron[] = [
      { pad: 'dossier.json', inhoud: '{}' },
      { pad: 'bijlagen/weg.jpg', inhoud: null },
    ];
    const regels = await bouwManifest(bestanden, nodeHash);
    expect(regels).toHaveLength(2);
    expect(regels[1]).toMatchObject({ pad: 'bijlagen/weg.jpg', sha256: '', status: 'ONTBREEKT' });
  });

  it('corrupt gemarkeerd bestand → CORRUPT met lege hash', async () => {
    const regels = await bouwManifest(
      [{ pad: 'bijlagen/stuk.jpg', inhoud: 'xx', status: 'CORRUPT' }],
      nodeHash
    );
    expect(regels[0]).toMatchObject({ status: 'CORRUPT', sha256: '' });
  });
});

describe('VendorExportService — format + samenvatting', () => {
  it('formatManifest geeft één regel per bestand', async () => {
    const regels = await bouwManifest(
      [
        { pad: 'dossier.json', inhoud: '{}' },
        { pad: 'bijlagen/weg.jpg', inhoud: null },
      ],
      nodeHash
    );
    const txt = formatManifest(regels);
    const lines = txt.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('ONTBREEKT');
    expect(lines[1]).toContain('bijlagen/weg.jpg');
  });

  it('vatManifestSamen telt OK/ontbreekt/corrupt', async () => {
    const regels = await bouwManifest(
      [
        { pad: 'a', inhoud: '1' },
        { pad: 'b', inhoud: null },
        { pad: 'c', inhoud: '3', status: 'CORRUPT' },
      ],
      nodeHash
    );
    expect(vatManifestSamen(regels)).toEqual({ ok: 1, ontbreekt: 1, corrupt: 1, totaal: 3 });
  });
});
