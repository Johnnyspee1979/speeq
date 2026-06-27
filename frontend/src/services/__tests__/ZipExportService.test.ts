/**
 * @jest-environment jsdom
 *
 * Unit-tests voor ZipExportService — exporteert een volledig borgingsdossier
 * als ZIP (mappenstructuur per borgingspunt + OVERZICHT.txt).
 *
 * We mocken JSZip, de Supabase-client, global.fetch en de browser-download-API's,
 * en borgen:
 *   - de happy-path bouwt een ZIP met OVERZICHT.txt, een foto- en notitie-bestand
 *     per borgingspunt, triggert een download en rapporteert tot fase 'klaar';
 *   - een database-fout en 'geen evidence' gooien én rapporteren fase 'fout';
 *   - de projectnaam wordt ge-sanitized in de download-bestandsnaam.
 */

const mockZipFiles: { folder: string; fn: string }[] = [];
const mockMakeFolder = (name: string): any => ({
  file: (fn: string, _content: unknown) => { mockZipFiles.push({ folder: name, fn }); },
  folder: (sub: string) => mockMakeFolder(sub),
});
const mockGenerateAsync = jest.fn((..._a: unknown[]) =>
  Promise.resolve({ size: 2 * 1024 * 1024 } as any),
);
jest.mock('jszip', () =>
  jest.fn().mockImplementation(() => ({
    folder: (name: string) => mockMakeFolder(name),
    generateAsync: (...a: unknown[]) => mockGenerateAsync(...a),
  })),
);

let mockEvidence: { data: unknown; error: unknown } = { data: [], error: null };
const mockBuilder: any = {
  select: () => mockBuilder,
  eq: () => mockBuilder,
  order: () => Promise.resolve(mockEvidence),
};
jest.mock('../../lib/supabase', () => ({
  supabase: { from: () => mockBuilder },
}));

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import { exportProjectAsZip } from '../ZipExportService';

const evRow = (over: Record<string, unknown> = {}) => ({
  id: 'abcd1234efgh',
  inspection_point_id: 'WAPENING-1',
  media_uri: 'https://x/p.jpg',
  photo_uri: null,
  timestamp: '2026-01-15T14:32:00Z',
  ai_status: 'PASSED',
  ai_notes: null,
  field_note: 'mooi strak',
  user_id: 'u1',
  latitude: 52.0705,
  longitude: 4.3007,
  ...over,
});

let createdAnchor: any;

beforeEach(() => {
  jest.clearAllMocks();
  mockZipFiles.length = 0;
  mockEvidence = { data: [], error: null };
  mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

  createdAnchor = { href: '', download: '', click: jest.fn() };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) =>
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

describe('exportProjectAsZip — happy path', () => {
  it('bouwt een ZIP met overzicht + foto/notitie en triggert de download', async () => {
    mockEvidence = { data: [evRow()], error: null };
    const onProgress = jest.fn();

    await exportProjectAsZip('p-1', 'Woning Spee', onProgress);

    // OVERZICHT.txt + foto + notitie aanwezig (tijd-deel TZ-afhankelijk → losse regex)
    const names = mockZipFiles.map((f) => f.fn);
    expect(names).toContain('OVERZICHT.txt');
    expect(names.some((n) => /^2026-01-15_\d{2}-\d{2}_foto_abcd1234\.jpg$/.test(n))).toBe(true);
    expect(names.some((n) => /^2026-01-15_\d{2}-\d{2}_notitie_abcd1234\.txt$/.test(n))).toBe(true);

    // foto is gedownload + ZIP gegenereerd
    expect(mockFetch).toHaveBeenCalledWith('https://x/p.jpg');
    expect(mockGenerateAsync).toHaveBeenCalledTimes(1);

    // download getriggerd
    expect(createdAnchor.download).toMatch(/^Woning Spee_dossier_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    expect((URL as any).createObjectURL).toHaveBeenCalledTimes(1);

    // eindfase = klaar
    const phases = onProgress.mock.calls.map((c) => (c[0] as any).phase);
    expect(phases[phases.length - 1]).toBe('klaar');
    expect(phases).toContain('ophalen');
    expect(phases).toContain('inpakken');
  });

  it('saneert de projectnaam in de download-bestandsnaam', async () => {
    mockEvidence = { data: [evRow()], error: null };
    await exportProjectAsZip('p-1', 'Spee/Co:1', jest.fn());
    expect(createdAnchor.download).toMatch(/^Spee-Co-1_dossier_/);
    expect(createdAnchor.download).not.toContain('/');
    expect(createdAnchor.download).not.toContain(':');
  });
});

describe('exportProjectAsZip — faalpaden', () => {
  it('gooit en rapporteert fase fout bij een database-fout', async () => {
    mockEvidence = { data: null, error: { message: 'rls denied' } };
    const onProgress = jest.fn();
    await expect(exportProjectAsZip('p-1', 'X', onProgress)).rejects.toMatchObject({
      message: 'rls denied',
    });
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1][0] as any;
    expect(last.phase).toBe('fout');
    expect(last.message).toContain('rls denied');
  });

  it('gooit en rapporteert fase fout wanneer er geen evidence is', async () => {
    mockEvidence = { data: [], error: null };
    const onProgress = jest.fn();
    await expect(exportProjectAsZip('p-1', 'X', onProgress)).rejects.toThrow('Geen evidence gevonden');
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1][0] as any;
    expect(last.phase).toBe('fout');
    // geen ZIP gegenereerd
    expect(mockGenerateAsync).not.toHaveBeenCalled();
  });
});
