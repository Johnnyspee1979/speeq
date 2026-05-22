/**
 * OfflineDossierExporter — Week 7 van de Offline-Mode roadmap.
 *
 * Genereert een print-klaar borgingsdossier ZONDER backend-aanroep.
 * Werkt op de bouwplaats, zelfs in de kelder.
 *
 * Aanpak (pragmatisch — geen extra dependency nodig):
 *   1. Hergebruik bestaande BorgingsDossierService.generateDossierHtml
 *      (genereert HTML met inline base64-afbeeldingen).
 *   2. Open in een nieuw venster + trigger window.print() → de
 *      gebruiker kiest "Bewaar als PDF" in de browser-dialoog.
 *   3. Alternatief: directe file-download als .html (klant kan
 *      later in elke browser openen en printen).
 *
 * Waarom geen pdf-lib? Toevoegen kost ~250KB bundle + extra integratie.
 * De HTML-export is functioneel equivalent en werkt overal.
 *
 * Branding wordt opgehaald uit OfflineBrandingCache wanneer beschikbaar —
 * werkt dus ook als de cloud-branding niet ophaalbaar is. Zie
 * TenantBrandingService voor de in-memory cache-laag.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (§7).
 */

import type { StoredWkbEvidence } from '../types/Evidence';
import {
  loadEvidenceImages,
  generateDossierHtml,
  type DossierMeta,
  type DossierSignatures,
  type FloorPlanAnnotation,
} from './BorgingsDossierService';
import { readCachedBranding } from './OfflineBrandingCache';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OfflineExportResult =
  | { ok: true; opened: 'print-window' | 'download' }
  | { ok: false; error: string };

export interface OfflineExportInput {
  evidence: StoredWkbEvidence[];
  projectId: string;
  projectName: string;
  meta?: DossierMeta;
  signatures?: DossierSignatures;
  floorPlanAnnotations?: FloorPlanAnnotation[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeFilename(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\-_\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'borgingsdossier'
  );
}

/**
 * Vul ontbrekende `aannemer` aan vanuit offline-cache. Branding-logo +
 * kleur worden door generateDossierHtml intern via getBrandingSync()
 * gelezen — die service heeft al een eigen cache-laag.
 */
async function patchMetaWithOfflineBranding(meta: DossierMeta = {}): Promise<DossierMeta> {
  if (meta.aannemer) return meta;
  const cached = await readCachedBranding();
  if (!cached?.companyName) return meta;
  return { ...meta, aannemer: cached.companyName };
}

// ─── Main exports ───────────────────────────────────────────────────────────

/**
 * Open een nieuw browser-venster met het borgingsdossier en trigger
 * automatisch de print-dialoog. Gebruiker kiest "Bewaar als PDF".
 *
 * Werkt offline omdat alle afbeeldingen base64-ingebakken zijn.
 */
export async function exportDossierPrintWindow(
  input: OfflineExportInput,
): Promise<OfflineExportResult> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Print-export werkt alleen in een browser-context.' };
  }

  try {
    const patchedMeta = await patchMetaWithOfflineBranding(input.meta);
    const imageMap = await loadEvidenceImages(input.evidence);
    const html = generateDossierHtml(
      input.evidence,
      input.projectId,
      input.projectName,
      imageMap,
      patchedMeta,
      input.signatures ?? {},
      input.floorPlanAnnotations ?? [],
    );

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      // Pop-up blocker — val terug op file-download
      return downloadHtmlString(html, input.projectName, patchedMeta);
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wacht tot afbeeldingen geladen zijn vóór print-dialoog
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          /* gebruiker handelt zelf af */
        }
      }, 200);
    });

    return { ok: true, opened: 'print-window' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Download het HTML-dossier als bestand. Bruikbaar als de print-window
 * is geblokkeerd of als gebruiker liever lokaal opslaat.
 */
async function downloadHtmlString(
  html: string,
  projectName: string,
  meta: DossierMeta,
): Promise<OfflineExportResult> {
  if (typeof document === 'undefined') {
    return { ok: false, error: 'Download werkt alleen in een browser-context.' };
  }

  try {
    const baseName = meta.aannemer ?? projectName ?? 'borgingsdossier';
    const filename = `${escapeFilename(baseName)}-${todayIsoDate()}.html`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { ok: true, opened: 'download' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Public download-API — bouwt eerst de HTML, dan triggert download.
 */
export async function exportDossierAsHtmlDownload(
  input: OfflineExportInput,
): Promise<OfflineExportResult> {
  try {
    const patchedMeta = await patchMetaWithOfflineBranding(input.meta);
    const imageMap = await loadEvidenceImages(input.evidence);
    const html = generateDossierHtml(
      input.evidence,
      input.projectId,
      input.projectName,
      imageMap,
      patchedMeta,
      input.signatures ?? {},
      input.floorPlanAnnotations ?? [],
    );
    return downloadHtmlString(html, input.projectName, patchedMeta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
