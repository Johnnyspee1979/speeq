/**
 * @jest-environment jsdom
 *
 * Unit-tests voor OfflineDossierExporter — print-klaar borgingsdossier zónder
 * backend (werkt offline; HTML met inline base64-afbeeldingen).
 *
 * We draaien in jsdom en mocken BorgingsDossierService (loadEvidenceImages,
 * generateDossierHtml) + OfflineBrandingCache (readCachedBranding), en sturen
 * window.open / URL.createObjectURL zelf aan. We borgen:
 *   - exportDossierPrintWindow: opent een print-venster (ok/print-window),
 *     vult ontbrekende `aannemer` uit de offline-cache, valt bij een geblokkeerde
 *     pop-up terug op download, en geeft ok:false bij een fout;
 *   - exportDossierAsHtmlDownload: bouwt een nette bestandsnaam en triggert een
 *     <a download>-klik via een object-URL.
 */

const mockLoadEvidenceImages = jest.fn((..._a: unknown[]) => Promise.resolve(new Map()));
const mockGenerateDossierHtml = jest.fn((..._a: unknown[]) => '<html>dossier</html>');
let mockCachedBranding: { companyName?: string } | null = null;
const mockReadCachedBranding = jest.fn(() => Promise.resolve(mockCachedBranding));

jest.mock('../BorgingsDossierService', () => ({
  loadEvidenceImages: (...a: unknown[]) => mockLoadEvidenceImages(...a),
  generateDossierHtml: (...a: unknown[]) => mockGenerateDossierHtml(...a),
}));

jest.mock('../OfflineBrandingCache', () => ({
  readCachedBranding: () => mockReadCachedBranding(),
}));

import {
  exportDossierPrintWindow,
  exportDossierAsHtmlDownload,
} from '../OfflineDossierExporter';

const baseInput = () => ({
  evidence: [] as any[],
  projectId: 'p-1',
  projectName: 'Project Eén',
});

const fakePrintWindow = () => ({
  document: { write: jest.fn(), close: jest.fn() },
  addEventListener: jest.fn(),
  focus: jest.fn(),
  print: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCachedBranding = null;
  mockLoadEvidenceImages.mockResolvedValue(new Map());
  mockGenerateDossierHtml.mockReturnValue('<html>dossier</html>');
  (globalThis as any).URL = {
    createObjectURL: jest.fn(() => 'blob://x'),
    revokeObjectURL: jest.fn(),
  };
});

afterEach(() => jest.restoreAllMocks());

describe('exportDossierPrintWindow', () => {
  it('opent een print-venster en geeft opened:print-window', async () => {
    const pw = fakePrintWindow();
    jest.spyOn(window, 'open').mockReturnValue(pw as any);

    const res = await exportDossierPrintWindow(baseInput());
    expect(res).toEqual({ ok: true, opened: 'print-window' });
    expect(pw.document.write).toHaveBeenCalledWith('<html>dossier</html>');
    expect(pw.document.close).toHaveBeenCalledTimes(1);
    expect(pw.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
  });

  it('vult ontbrekende aannemer uit de offline-cache', async () => {
    mockCachedBranding = { companyName: 'Bouw BV' };
    jest.spyOn(window, 'open').mockReturnValue(fakePrintWindow() as any);

    await exportDossierPrintWindow(baseInput());
    // meta is het 5e argument (index 4) van generateDossierHtml
    const metaArg = mockGenerateDossierHtml.mock.calls[0][4] as { aannemer?: string };
    expect(metaArg.aannemer).toBe('Bouw BV');
  });

  it('laat een bestaande aannemer ongemoeid (geen cache-lookup)', async () => {
    jest.spyOn(window, 'open').mockReturnValue(fakePrintWindow() as any);
    await exportDossierPrintWindow({ ...baseInput(), meta: { aannemer: 'Eigen NV' } });
    const metaArg = mockGenerateDossierHtml.mock.calls[0][4] as { aannemer?: string };
    expect(metaArg.aannemer).toBe('Eigen NV');
    expect(mockReadCachedBranding).not.toHaveBeenCalled();
  });

  it('valt terug op download als de pop-up is geblokkeerd', async () => {
    jest.spyOn(window, 'open').mockReturnValue(null);
    const res = await exportDossierPrintWindow(baseInput());
    expect(res).toEqual({ ok: true, opened: 'download' });
    expect((URL as any).createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('geeft ok:false bij een fout tijdens het bouwen', async () => {
    jest.spyOn(window, 'open').mockReturnValue(fakePrintWindow() as any);
    mockLoadEvidenceImages.mockRejectedValue(new Error('beelden kapot'));
    const res = await exportDossierPrintWindow(baseInput());
    expect(res).toEqual({ ok: false, error: 'beelden kapot' });
  });
});

describe('exportDossierAsHtmlDownload', () => {
  it('bouwt een nette bestandsnaam en triggert een <a download>-klik', async () => {
    const realCreate = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    jest.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCreate(tag);
      if (tag === 'a') anchor = el as HTMLAnchorElement;
      return el;
    });

    const res = await exportDossierAsHtmlDownload({
      ...baseInput(),
      meta: { aannemer: 'Bouw & Co!!' },
    });

    expect(res).toEqual({ ok: true, opened: 'download' });
    expect(anchor).toBeDefined();
    // special chars gestript, spaties → '-', datum-suffix, .html
    expect(anchor!.download).toMatch(/^Bouw-Co-\d{4}-\d{2}-\d{2}\.html$/);
    expect((URL as any).createObjectURL).toHaveBeenCalledTimes(1);
    expect((URL as any).revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('geeft ok:false bij een fout tijdens het bouwen', async () => {
    mockLoadEvidenceImages.mockRejectedValue(new Error('oei'));
    const res = await exportDossierAsHtmlDownload(baseInput());
    expect(res).toEqual({ ok: false, error: 'oei' });
  });
});
