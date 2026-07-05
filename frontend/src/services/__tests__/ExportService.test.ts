/**
 * @jest-environment jsdom
 *
 * Unit-tests voor ExportService — exporteer bewijs als CSV/JSON.
 *
 * Pure, deterministische logica. We borgen:
 *   - evidenceToCsv: kopregel + één regel per rij, juiste kolomvolgorde,
 *     null → leeg, optionele velden default leeg, en CSV-escaping (komma's,
 *     quotes verdubbeld, newlines tussen quotes);
 *   - downloadCsv/downloadJson: bouwen een Blob, maken een object-URL, klikken
 *     een download-anchor en ruimen de URL weer op;
 *   - makeExportFilename: `wkb-bewijs_<project>_<datum>.<ext>`.
 */

import {
  type ExportEvidenceRow,
  evidenceToCsv,
  downloadCsv,
  downloadJson,
  makeExportFilename,
} from '../ExportService';

const row = (over: Partial<ExportEvidenceRow> = {}): ExportEvidenceRow => ({
  id: 'e1',
  projectId: 'p-1',
  inspectionPointId: 'WAPENING-1',
  timestamp: '2026-01-15T09:30:00Z',
  aiStatus: 'PASSED',
  aiNotes: null,
  fieldNote: null,
  userId: 'u1',
  latitude: 52.07,
  longitude: 4.3,
  mediaUri: null,
  ...over,
});

describe('evidenceToCsv', () => {
  it('zet een kopregel en één regel per rij in de juiste kolomvolgorde', () => {
    const csv = evidenceToCsv([row({ etage: '1', ruimtenummer: '12', pinX: 0.5 })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'ID,Project,Borgingspunt,Tijdstip,Status,AI Notities,Veldnotitie,Gebruiker,' +
        'Latitude,Longitude,Etage,Ruimtenummer,Binnen/Buiten,Locatie Detail,' +
        'Tekening ID,Pin X,Pin Y,Foto URL',
    );
    const cells = lines[1].split(',');
    expect(cells[0]).toBe('e1');
    expect(cells[1]).toBe('p-1');
    expect(cells[2]).toBe('WAPENING-1');
    expect(cells[10]).toBe('1');   // Etage
    expect(cells[11]).toBe('12');  // Ruimtenummer
    expect(cells[15]).toBe('0.5'); // Pin X
  });

  it('maakt null en ontbrekende optionele velden leeg', () => {
    const csv = evidenceToCsv([row({ aiNotes: null, mediaUri: null })]);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[5]).toBe('');  // AI Notities (null)
    expect(cells[12]).toBe(''); // Binnen/Buiten (optioneel, ontbreekt)
    expect(cells[17]).toBe(''); // Foto URL (null)
  });

  it('escaped komma\'s, quotes en newlines', () => {
    const csv = evidenceToCsv([
      row({ aiNotes: 'te weinig, dekking', fieldNote: 'hij zei "ok"', locatieDetail: 'lijn 1\nlijn 2' }),
    ]);
    const dataLine = csv.split('\n').slice(1).join('\n'); // newline-veld zit binnen quotes
    expect(dataLine).toContain('"te weinig, dekking"');
    expect(dataLine).toContain('"hij zei ""ok"""');
    expect(dataLine).toContain('"lijn 1\nlijn 2"');
  });
});

describe('downloadCsv / downloadJson', () => {
  let createdAnchor: any;
  let createElementSpy: jest.SpyInstance;

  beforeEach(() => {
    createdAnchor = { href: '', download: '', click: jest.fn() };
    createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) =>
        tag === 'a' ? createdAnchor : ({} as any),
      );
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);
    (globalThis as any).URL = {
      createObjectURL: jest.fn(() => 'blob:fake'),
      revokeObjectURL: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloadCsv bouwt een blob, klikt het anchor en ruimt de URL op', () => {
    downloadCsv('a,b\n1,2', 'export.csv');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('text/csv');
    expect(createdAnchor.download).toBe('export.csv');
    expect(createdAnchor.href).toBe('blob:fake');
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(createElementSpy).toHaveBeenCalledWith('a');
  });

  it('downloadJson serialiseert naar een application/json blob', () => {
    downloadJson({ a: 1 }, 'data.json');
    const blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blob.type).toContain('application/json');
    expect(createdAnchor.download).toBe('data.json');
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
  });
});

describe('makeExportFilename', () => {
  it('bouwt wkb-bewijs_<project>_<datum>.<ext>', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(makeExportFilename('p-1', 'csv')).toBe(`wkb-bewijs_p-1_${today}.csv`);
    expect(makeExportFilename('p-1', 'json')).toBe(`wkb-bewijs_p-1_${today}.json`);
  });
});
