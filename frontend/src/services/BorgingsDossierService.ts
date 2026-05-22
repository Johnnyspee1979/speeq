/**
 * BorgingsDossierService — genereert een print-klaar HTML borgingsdossier.
 *
 * v2 verbeteringen:
 *  - Foto's als base64 ingebakken (werkt offline + in nieuw tabblad)
 *  - Inhoudsopgave met ankerkoppelingen
 *  - Projectgegevens (aannemer, adres, vergunning)
 *  - Paginanummering via CSS counter
 *  - Loading state terwijl afbeeldingen worden geladen
 */

import type { StoredWkbEvidence } from '../types/Evidence';
import { getBrandingSync, getBranding } from './TenantBrandingService';

/**
 * Tenant-aware brand label voor PDF-footer.
 * - Klant-naam aanwezig → toon klant-naam (eventueel + "Powered by SpeeQ" weglaten)
 * - Geen klant-naam → leeg, zodat SpeeQ niet in de klant-context blijft hangen
 */
function pdfBrandLabel(): string {
  const b = getBrandingSync();
  return b.companyName ?? '';
}

// ────────────────────────────────────────────────
// Base64 converter
// ────────────────────────────────────────────────

async function uriToBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Laadt alle evidence-afbeeldingen parallel als base64. */
export async function loadEvidenceImages(
  evidence: StoredWkbEvidence[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    evidence
      .filter((e) => Boolean(e.mediaUri))
      .map(async (e) => {
        const b64 = await uriToBase64(e.mediaUri!);
        return b64 ? ([e.id, b64] as [string, string]) : null;
      })
  );
  return Object.fromEntries(entries.filter(Boolean) as [string, string][]);
}

// ────────────────────────────────────────────────
// HTML generator
// ────────────────────────────────────────────────

export interface DossierMeta {
  aannemer?: string;
  adres?: string;
  vergunning?: string;
  kwaliteitsborger?: string;
}

export interface FloorPlanAnnotationPin {
  x: number;
  y: number;
  pointId: string;
  aiStatus: string | null;
}

export interface FloorPlanAnnotation {
  name: string;
  imageBase64: string;
  pins: FloorPlanAnnotationPin[];
}

export interface DossierSignatures {
  /** base64 PNG data URL van handtekening projectleider */
  projectleider?: string;
  projectleiderNaam?: string;
  /** base64 PNG data URL van handtekening opdrachtgever */
  opdrachtgever?: string;
  opdrachtgeverNaam?: string;
  /** ISO timestamp van ondertekening */
  signedAt?: string;
}

function pinColorHex(aiStatus: string | null): string {
  switch (aiStatus) {
    case 'PASSED': return '#059669';
    case 'NEEDS_REVIEW': return '#d97706';
    case 'FAILED': return '#ef4444';
    default: return '#9ca3af';
  }
}

export function generateDossierHtml(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  imageMap: Record<string, string> = {},
  meta: DossierMeta = {},
  signatures: DossierSignatures = {},
  floorPlanAnnotations: FloorPlanAnnotation[] = []
): string {
  const now = new Date().toLocaleString('nl-NL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // Groepeer per inspectionPointId
  const groups = new Map<string, StoredWkbEvidence[]>();
  for (const item of evidence) {
    const key = item.inspectionPointId ?? 'onbekend';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const totalCount = evidence.length;
  const syncedCount = evidence.filter((e) => e.syncStatus === 'SYNCED').length;
  const aiOkCount = evidence.filter((e) =>
    ['PASSED', 'APPROVED', 'OK'].includes((e.aiStatus ?? '').toUpperCase())
  ).length;
  const pendingCount = totalCount - syncedCount;

  const aiStatusBadge = (status?: string | null) => {
    const s = (status ?? '').toUpperCase();
    if (['PASSED', 'APPROVED', 'OK'].includes(s))
      return `<span class="badge badge-ok">✓ AI akkoord</span>`;
    if (['NEEDS_REVIEW', 'WARNING'].includes(s))
      return `<span class="badge badge-warn">⚠ Review</span>`;
    if (['FAILED', 'REJECTED'].includes(s))
      return `<span class="badge badge-fail">✗ Afgekeurd</span>`;
    return `<span class="badge badge-pending">○ Pending</span>`;
  };

  const syncBadge = (status: string) => {
    if (status === 'SYNCED') return `<span class="badge badge-ok">☁ Cloud</span>`;
    if (status === 'FAILED') return `<span class="badge badge-fail">✗ Sync fout</span>`;
    return `<span class="badge badge-pending">⟳ Lokaal</span>`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('nl-NL', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  const safeId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, '-');

  // ── Inhoudsopgave ──────────────────────────────
  const tocItems = Array.from(groups.entries())
    .map(([pointId, items]) => {
      const hasOk = items.some((e) =>
        ['PASSED', 'APPROVED', 'OK'].includes((e.aiStatus ?? '').toUpperCase())
      );
      const hasWarn = items.some((e) =>
        ['NEEDS_REVIEW', 'WARNING'].includes((e.aiStatus ?? '').toUpperCase())
      );
      const icon = items.length === 0 ? '○' : hasWarn ? '⚠' : hasOk ? '✓' : '○';
      const color = items.length === 0 ? '#9ca3af' : hasWarn ? '#d97706' : hasOk ? '#059669' : '#9ca3af';
      return `<li style="color:${color}">
        <a href="#${safeId(pointId)}" style="color:inherit;text-decoration:none;">
          ${icon} ${pointId}
        </a>
        <span style="color:#9ca3af;font-size:10px;margin-left:6px;">${items.length} foto${items.length !== 1 ? "'s" : ''}</span>
      </li>`;
    })
    .join('');

  // ── Evidence secties ──────────────────────────
  const sections = Array.from(groups.entries())
    .map(([pointId, items]) => {
      const rows = items
        .map((item) => {
          const lat = item.latitude?.toFixed(5) ?? '-';
          const lon = item.longitude?.toFixed(5) ?? '-';
          const date = item.timestamp ? formatDate(item.timestamp) : '-';
          const imgSrc = item.id ? imageMap[item.id] : null;

          return `
            <div class="evidence-row">
              <div class="photo-box">
                ${imgSrc
                  ? `<img src="${imgSrc}" alt="${pointId}" />`
                  : item.mediaUri
                  ? `<div class="photo-missing" style="font-size:10px;padding:4px;">📷 Foto niet geladen</div>`
                  : `<div class="photo-missing">📷 Geen foto</div>`
                }
              </div>
              <div class="evidence-meta">
                <div class="meta-line"><span class="meta-icon">🕐</span>${date}</div>
                <div class="meta-line"><span class="meta-icon">📍</span>${lat}, ${lon}${item.gpsAccuracy ? ` ±${Math.round(item.gpsAccuracy)}m` : ''}</div>
                ${item.weatherLabel ? `<div class="meta-line"><span class="meta-icon">🌤</span>${item.weatherLabel}</div>` : ''}
                ${item.fieldNote ? `<div class="meta-line"><span class="meta-icon">📝</span>${item.fieldNote}</div>` : ''}
                ${item.stopMomentConfirmed != null ? `<div class="meta-line"><span class="meta-icon">${item.stopMomentConfirmed ? '✓' : '✗'}</span>Stopmoment ${item.stopMomentConfirmed ? 'bevestigd' : 'niet bevestigd'}</div>` : ''}
                ${item.locationVerified != null ? `<div class="meta-line"><span class="meta-icon">${item.locationVerified ? '✓' : '⚠'}</span>Locatie ${item.locationVerified ? 'geverifieerd' : 'buiten zone'}</div>` : ''}
                <div class="badge-row">
                  ${aiStatusBadge(item.aiStatus)}
                  ${syncBadge(item.syncStatus)}
                </div>
                <div class="evidence-id">${item.id}</div>
              </div>
            </div>`;
        })
        .join('');

      return `
        <div class="section" id="${safeId(pointId)}">
          <div class="section-header">
            <span class="section-id">${pointId}</span>
            <span class="section-count">${items.length} foto${items.length !== 1 ? "'s" : ''}</span>
          </div>
          ${rows}
        </div>`;
    })
    .join('');

  // ── Projectgegevens regels ────────────────────
  const metaLines = [
    meta.aannemer ? `<div class="meta-info-row"><b>Aannemer:</b> ${meta.aannemer}</div>` : '',
    meta.adres ? `<div class="meta-info-row"><b>Adres:</b> ${meta.adres}</div>` : '',
    meta.vergunning ? `<div class="meta-info-row"><b>Vergunning:</b> ${meta.vergunning}</div>` : '',
    meta.kwaliteitsborger ? `<div class="meta-info-row"><b>Kwaliteitsborger:</b> ${meta.kwaliteitsborger}</div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WKB Borgingsdossier — ${projectId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #f5f5f5;
    }
    .page { background: #fff; max-width: 960px; margin: 0 auto; padding: 40px; }

    /* Print button */
    .print-bar {
      position: sticky;
      top: 0;
      background: #fff;
      border-bottom: 1px solid #e5e5e5;
      padding: 10px 0 10px;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10;
    }
    .btn-print {
      background: #e63946; color: #fff; border: none;
      padding: 10px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 800; cursor: pointer;
      letter-spacing: 0.3px;
    }
    .btn-print:hover { background: #c1121f; }

    /* Cover */
    .cover {
      border-bottom: 3px solid #e63946;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .cover-tag {
      font-size: 10px; font-weight: 800; letter-spacing: 3px;
      color: #e63946; text-transform: uppercase; margin-bottom: 8px;
    }
    .cover-title { font-size: 28px; font-weight: 900; color: #111; letter-spacing: -0.5px; margin-bottom: 4px; }
    .cover-sub { font-size: 14px; color: #555; margin-bottom: 16px; }
    .cover-stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat-box { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; min-width: 90px; }
    .stat-value { font-size: 22px; font-weight: 900; color: #111; }
    .stat-label { font-size: 10px; color: #888; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .meta-info-row { font-size: 12px; color: #555; margin-top: 4px; }

    /* TOC */
    .toc { margin-bottom: 28px; background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 10px; padding: 18px 20px; }
    .toc h2 { font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .toc ol { padding-left: 18px; }
    .toc li { font-size: 12px; margin-bottom: 5px; line-height: 1.4; }

    /* Section */
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      background: #111; color: #fff;
      padding: 10px 14px; border-radius: 8px 8px 0 0;
      font-weight: 800; font-size: 13px;
    }
    .section-id { font-family: monospace; }
    .section-count { font-size: 11px; opacity: 0.6; font-weight: 500; }

    /* Evidence row */
    .evidence-row {
      display: flex; gap: 16px; padding: 14px;
      border: 1px solid #e5e5e5; border-top: none;
      background: #fff;
    }
    .evidence-row:last-child { border-radius: 0 0 8px 8px; }
    .evidence-row:not(:last-child) { border-bottom: 1px dashed #e5e5e5; }
    .photo-box {
      flex-shrink: 0; width: 160px; height: 120px;
      border-radius: 6px; overflow: hidden;
      background: #f0f0f0; border: 1px solid #ddd;
      display: flex; align-items: center; justify-content: center;
    }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .photo-missing { color: #aaa; font-size: 11px; text-align: center; padding: 8px; }
    .evidence-meta { flex: 1; }
    .meta-line {
      display: flex; align-items: flex-start; gap: 6px;
      margin-bottom: 4px; font-size: 12px; color: #333; line-height: 1.4;
    }
    .meta-icon { font-size: 12px; flex-shrink: 0; width: 16px; }
    .badge-row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
    .badge-ok    { background: #d1fae5; color: #065f46; }
    .badge-warn  { background: #fef3c7; color: #92400e; }
    .badge-fail  { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #f3f4f6; color: #6b7280; }
    .evidence-id { font-family: monospace; font-size: 9px; color: #bbb; margin-top: 6px; }

    /* Handtekening sectie */
    .sig-section {
      margin-top: 36px; padding: 20px;
      border: 1px solid #e5e5e5; border-radius: 10px;
      background: #fafafa;
    }
    .sig-title {
      font-size: 10px; font-weight: 800; letter-spacing: 2px;
      text-transform: uppercase; color: #888; margin-bottom: 16px;
    }
    .sig-grid { display: flex; gap: 24px; flex-wrap: wrap; }
    .sig-box { flex: 1; min-width: 200px; }
    .sig-label { font-size: 10px; color: #888; font-weight: 700; margin-bottom: 6px; }
    .sig-img {
      width: 100%; height: 90px; border: 1px solid #ddd; border-radius: 6px;
      object-fit: contain; background: #fff;
    }
    .sig-name { font-size: 11px; color: #555; margin-top: 5px; font-weight: 600; }
    .sig-date { font-size: 10px; color: #aaa; margin-top: 2px; }
    .sig-empty {
      width: 100%; height: 90px; border: 1px dashed #ddd; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      color: #ccc; font-size: 11px;
    }

    /* Footer */
    .footer {
      margin-top: 36px; padding-top: 14px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px; color: #aaa;
      display: flex; justify-content: space-between;
    }

    /* Print */
    @media print {
      body { background: #fff; }
      .page { padding: 20px; max-width: 100%; }
      .print-bar { display: none !important; }
      .section { page-break-inside: avoid; }
      .cover { page-break-after: avoid; }
      @page { margin: 15mm; size: A4; }
      @page :first { margin-top: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Print balk (verborgen bij printen) -->
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">📄 PDF opslaan / Afdrukken</button>
      <span style="font-size:12px;color:#888">${totalCount} borgingspunten · ${groups.size} locaties · gegenereerd ${now}</span>
    </div>

    <!-- Cover -->
    <div class="cover">
      ${getBrandingSync().logoUrl ? `<img src="${getBrandingSync().logoUrl}" alt="Logo" style="height:48px;max-width:240px;object-fit:contain;margin-bottom:18px;display:block" />` : ''}
      <div class="cover-tag">WKB Borgingsdossier</div>
      <div class="cover-title">${projectName}</div>
      <div class="cover-sub">Project ${projectId} &nbsp;·&nbsp; ${now}</div>
      <div class="cover-stats">
        <div class="stat-box">
          <div class="stat-value">${totalCount}</div>
          <div class="stat-label">Foto's totaal</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${groups.size}</div>
          <div class="stat-label">Borgingspunten</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#059669">${syncedCount}</div>
          <div class="stat-label">Cloud veilig</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#2563eb">${aiOkCount}</div>
          <div class="stat-label">AI akkoord</div>
        </div>
        ${pendingCount > 0 ? `<div class="stat-box">
          <div class="stat-value" style="color:#d97706">${pendingCount}</div>
          <div class="stat-label">Lokaal</div>
        </div>` : ''}
      </div>
      ${metaLines ? `<div style="margin-top:10px">${metaLines}</div>` : ''}
    </div>

    <!-- Inhoudsopgave -->
    ${groups.size > 0 ? `
    <div class="toc">
      <h2>Inhoudsopgave</h2>
      <ol>${tocItems}</ol>
    </div>` : ''}

    <!-- Evidence per borgingspunt -->
    ${sections.length > 0
      ? sections
      : '<p style="color:#888;padding:32px;text-align:center;">Nog geen borgingspunten vastgelegd in dit project.</p>'
    }

    <!-- Bouwtekening locaties -->
    ${floorPlanAnnotations.length > 0 ? `
    <div class="floor-section">
      <h2>📐 Locaties op tekening</h2>
      ${floorPlanAnnotations.map(fp => `
        <div class="floor-plan-block">
          <h3>${fp.name}</h3>
          <div style="position:relative;display:inline-block;width:100%">
            <img src="${fp.imageBase64}" style="width:100%;display:block;border-radius:8px" />
            <svg style="position:absolute;top:0;left:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              ${fp.pins.map(p => `
                <circle cx="${(p.x * 100).toFixed(2)}" cy="${(p.y * 100).toFixed(2)}" r="1.8"
                  fill="${pinColorHex(p.aiStatus)}" stroke="white" stroke-width="0.4" opacity="0.9" />
              `).join('')}
            </svg>
          </div>
          <div style="font-size:11px;color:#888;margin-top:6px">
            ${fp.pins.length} pin${fp.pins.length !== 1 ? 's' : ''} op deze tekening
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- Handtekeningen -->
    <div class="sig-section">
      <div class="sig-title">Ondertekening oplevering</div>
      <div class="sig-grid">
        <div class="sig-box">
          <div class="sig-label">PROJECTLEIDER / AANNEMER</div>
          ${signatures.projectleider
            ? `<img src="${signatures.projectleider}" class="sig-img" alt="Handtekening projectleider" />`
            : `<div class="sig-empty">Handtekening: __________________________</div>
               <div class="sig-empty" style="margin-top:8px">Naam: __________________________</div>
               <div class="sig-empty" style="margin-top:8px">Datum: __________________________</div>`}
          ${signatures.projectleiderNaam ? `<div class="sig-name">${signatures.projectleiderNaam}</div>` : ''}
          ${signatures.signedAt ? `<div class="sig-date">${new Date(signatures.signedAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
        </div>
        <div class="sig-box">
          <div class="sig-label">OPDRACHTGEVER</div>
          ${signatures.opdrachtgever
            ? `<img src="${signatures.opdrachtgever}" class="sig-img" alt="Handtekening opdrachtgever" />`
            : `<div class="sig-empty">Handtekening: __________________________</div>
               <div class="sig-empty" style="margin-top:8px">Naam: __________________________</div>
               <div class="sig-empty" style="margin-top:8px">Datum: __________________________</div>`}
          ${signatures.opdrachtgeverNaam ? `<div class="sig-name">${signatures.opdrachtgeverNaam}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>${pdfBrandLabel()}</span>
      <span>Dossier ${projectId} · ${now}</span>
    </div>

  </div>
</body>
</html>`;
}

// ────────────────────────────────────────────────
// Export — async (laadt eerst alle foto's)
// ────────────────────────────────────────────────

export async function exportDossierAsPdf(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  meta: DossierMeta = {},
  signatures: DossierSignatures = {}
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Vers ophalen, zodat de tenant-branding in de footer up-to-date is.
  await getBranding({ force: false }).catch(() => {});

  // Laad alle afbeeldingen als base64
  const imageMap = await loadEvidenceImages(evidence);

  const html = generateDossierHtml(evidence, projectId, projectName, imageMap, meta, signatures);

  const w = window.open('', '_blank', 'width=980,height=720');

  if (!w) {
    // Pop-up geblokkeerd — fallback via blob URL
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }

  w.document.write(html);
  w.document.close();
  w.addEventListener('load', () => {
    // Kleine delay voor image rendering
    setTimeout(() => w.print(), 500);
  });
}

// ────────────────────────────────────────────────
// Sprint 4 — Officieel WKB-rapport (Gemeente / Kwaliteitsborger)
//
// Drie formats:
//  - INTERNAL     : alles, inclusief afgekeurd / pending (interne controle)
//  - MUNICIPALITY : alles + volledige metadata-tabel (bevoegd gezag)
//  - AUDITOR      : alléén PASSED bewijs (kwaliteitsborger oplevering)
// ────────────────────────────────────────────────

export type WkbExportFormat = 'INTERNAL' | 'MUNICIPALITY' | 'AUDITOR';

const FORMAT_LABEL: Record<WkbExportFormat, string> = {
  INTERNAL: 'Intern dossier',
  MUNICIPALITY: 'Gemeente / bevoegd gezag',
  AUDITOR: 'Kwaliteitsborger oplevering',
};

const FORMAT_TAG: Record<WkbExportFormat, string> = {
  INTERNAL: 'Intern — alle bewijzen',
  MUNICIPALITY: 'Officieel — bevoegd gezag',
  AUDITOR: 'Oplevering — alleen akkoord',
};

/**
 * Filtert evidence op basis van het gekozen exportformat.
 *  - AUDITOR: alleen items met aiStatus PASSED / APPROVED / OK
 *  - INTERNAL & MUNICIPALITY: ongefilterd
 */
export function filterEvidenceForExport(
  evidence: StoredWkbEvidence[],
  format: WkbExportFormat
): StoredWkbEvidence[] {
  if (format !== 'AUDITOR') return evidence;
  return evidence.filter((e) =>
    ['PASSED', 'APPROVED', 'OK'].includes((e.aiStatus ?? '').toUpperCase())
  );
}

/**
 * generateOfficialWkbReport — produceert een gemeente-grade HTML rapport.
 * Per EvidenceRow worden de WKB-kritieke metadata expliciet als tabelkolom
 * geprint:  timestamp · gps_accuracy · exif_hash · exif_verified ·
 *           ai_status · floor_plan_id · pin_x · pin_y
 */
export function generateOfficialWkbReport(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  imageMap: Record<string, string> = {},
  meta: DossierMeta = {},
  signatures: DossierSignatures = {},
  floorPlanAnnotations: FloorPlanAnnotation[] = [],
  format: WkbExportFormat = 'MUNICIPALITY'
): string {
  const now = new Date().toLocaleString('nl-NL', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('nl-NL', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      return iso;
    }
  };

  const truncateHash = (h?: string | null) => {
    if (!h) return '—';
    if (h.length <= 16) return h;
    return `${h.slice(0, 8)}…${h.slice(-6)}`;
  };

  const safeId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, '-');

  const totalCount = evidence.length;
  const syncedCount = evidence.filter((e) => e.syncStatus === 'SYNCED').length;
  const exifVerifiedCount = evidence.filter((e) => e.exifVerified === true).length;
  const passedCount = evidence.filter((e) =>
    ['PASSED', 'APPROVED', 'OK'].includes((e.aiStatus ?? '').toUpperCase())
  ).length;

  // ── WKB compliance tabel rows ─────────────────
  const tableRows = evidence
    .map((item, idx) => {
      const ts = formatTimestamp(item.timestamp);
      const gps = item.gpsAccuracy != null ? `±${item.gpsAccuracy.toFixed(1)} m` : '—';
      const hash = truncateHash(item.exifHash);
      const exifOk = item.exifVerified === true ? '✓' : item.exifVerified === false ? '✗' : '—';
      const exifColor = item.exifVerified === true ? '#059669' : item.exifVerified === false ? '#ef4444' : '#9ca3af';
      const ai = (item.aiStatus ?? 'PENDING').toUpperCase();
      const aiColor =
        ai === 'PASSED' || ai === 'APPROVED' || ai === 'OK'
          ? '#059669'
          : ai === 'NEEDS_REVIEW' || ai === 'WARNING'
          ? '#d97706'
          : ai === 'FAILED' || ai === 'REJECTED'
          ? '#ef4444'
          : '#6b7280';
      const floorRef = item.floorPlanId ? safeId(item.floorPlanId).slice(0, 8) : '—';
      const pinX = item.pinX != null ? item.pinX.toFixed(3) : '—';
      const pinY = item.pinY != null ? item.pinY.toFixed(3) : '—';
      const lat = item.latitude?.toFixed(5) ?? '—';
      const lon = item.longitude?.toFixed(5) ?? '—';

      return `
        <tr>
          <td class="row-num">${idx + 1}</td>
          <td class="mono small">${item.inspectionPointId ?? '—'}</td>
          <td class="mono">${ts}</td>
          <td>${lat}, ${lon}</td>
          <td>${gps}</td>
          <td class="mono small" title="${item.exifHash ?? ''}">${hash}</td>
          <td style="color:${exifColor};font-weight:800;text-align:center">${exifOk}</td>
          <td><span class="ai-pill" style="background:${aiColor}1a;color:${aiColor};border-color:${aiColor}33">${ai}</span></td>
          <td class="mono small">${floorRef}</td>
          <td class="mono small">${pinX}</td>
          <td class="mono small">${pinY}</td>
        </tr>`;
    })
    .join('');

  // ── Foto bijlage (alleen bij MUNICIPALITY/INTERNAL — AUDITOR is al gefilterd) ──
  const photoBlocks = evidence
    .map((item, idx) => {
      const imgSrc = item.id ? imageMap[item.id] : null;
      return `
        <div class="photo-card">
          <div class="photo-header">
            <span class="photo-num">#${idx + 1}</span>
            <span class="photo-pid">${item.inspectionPointId ?? '—'}</span>
            <span class="photo-time">${formatTimestamp(item.timestamp)}</span>
          </div>
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${item.inspectionPointId ?? ''}" />`
            : `<div class="photo-empty">📷 Geen foto beschikbaar</div>`}
          <div class="photo-meta">
            <div><b>Hash:</b> <span class="mono">${item.exifHash ?? '—'}</span></div>
            <div><b>Locatie:</b> ${item.latitude?.toFixed(5) ?? '—'}, ${item.longitude?.toFixed(5) ?? '—'}</div>
            ${item.fieldNote ? `<div><b>Notitie:</b> ${item.fieldNote}</div>` : ''}
          </div>
        </div>`;
    })
    .join('');

  // ── Projectgegevens regels ────────────────────
  const metaLines = [
    meta.aannemer ? `<div class="meta-info-row"><b>Aannemer:</b> ${meta.aannemer}</div>` : '',
    meta.adres ? `<div class="meta-info-row"><b>Adres:</b> ${meta.adres}</div>` : '',
    meta.vergunning ? `<div class="meta-info-row"><b>Vergunning:</b> ${meta.vergunning}</div>` : '',
    meta.kwaliteitsborger ? `<div class="meta-info-row"><b>Kwaliteitsborger:</b> ${meta.kwaliteitsborger}</div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WKB Officieel rapport — ${projectId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px; color: #1a1a1a; background: #f5f5f5;
    }
    .page { background: #fff; max-width: 1100px; margin: 0 auto; padding: 36px 32px; }
    .mono { font-family: 'SF Mono', Menlo, Consolas, monospace; }
    .small { font-size: 10px; }

    .print-bar {
      position: sticky; top: 0; background: #fff;
      border-bottom: 1px solid #e5e5e5;
      padding: 10px 0; margin-bottom: 22px;
      display: flex; align-items: center; gap: 12px; z-index: 10;
    }
    .btn-print {
      background: #111827; color: #fff; border: none;
      padding: 9px 18px; border-radius: 8px;
      font-size: 13px; font-weight: 800; cursor: pointer;
    }
    .btn-print:hover { background: #000; }

    .cover { border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 24px; }
    .cover-tag {
      font-size: 10px; font-weight: 800; letter-spacing: 3px;
      color: #111827; text-transform: uppercase; margin-bottom: 6px;
    }
    .cover-title { font-size: 26px; font-weight: 900; color: #111; letter-spacing: -0.4px; margin-bottom: 4px; }
    .cover-sub { font-size: 13px; color: #555; margin-bottom: 14px; }
    .format-pill {
      display: inline-block; background: #111827; color: #fff;
      padding: 4px 12px; border-radius: 100px; font-size: 10px;
      font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
      margin-bottom: 10px;
    }
    .meta-info-row { font-size: 11px; color: #555; margin-top: 3px; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px; margin: 14px 0 6px;
    }
    .stat-box {
      background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px;
      padding: 10px 12px;
    }
    .stat-value { font-size: 20px; font-weight: 900; color: #111; }
    .stat-label { font-size: 9px; color: #888; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 2px; }

    h2.section-title {
      font-size: 13px; font-weight: 800; letter-spacing: 1.5px;
      text-transform: uppercase; color: #111;
      margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #111;
    }

    table.wkb-table {
      width: 100%; border-collapse: collapse; font-size: 10px;
      margin-bottom: 18px;
    }
    table.wkb-table th {
      background: #111827; color: #fff; padding: 8px 6px;
      font-weight: 800; text-align: left; font-size: 9px;
      letter-spacing: 0.8px; text-transform: uppercase;
      border: 1px solid #111827;
    }
    table.wkb-table td {
      padding: 6px 6px; border: 1px solid #e5e5e5;
      vertical-align: top; line-height: 1.35;
    }
    table.wkb-table tr:nth-child(even) td { background: #fafafa; }
    .row-num { text-align: center; color: #888; font-weight: 700; width: 28px; }
    .ai-pill {
      display: inline-block; padding: 2px 8px; border-radius: 100px;
      font-size: 9px; font-weight: 800; letter-spacing: 0.5px;
      border: 1px solid;
    }

    .photos-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 14px; margin-bottom: 18px;
    }
    .photo-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; }
    .photo-header {
      background: #f8f8f8; padding: 6px 10px; border-bottom: 1px solid #e5e5e5;
      display: flex; gap: 10px; align-items: center; font-size: 10px;
    }
    .photo-num { font-weight: 900; color: #111827; }
    .photo-pid { font-family: monospace; color: #555; flex: 1; }
    .photo-time { color: #888; font-size: 9px; }
    .photo-card img { width: 100%; height: 220px; object-fit: cover; display: block; }
    .photo-empty { height: 120px; display: flex; align-items: center; justify-content: center; color: #aaa; }
    .photo-meta { padding: 8px 10px; font-size: 10px; color: #444; line-height: 1.5; }
    .photo-meta b { color: #111; font-weight: 700; }

    .floor-plan-block { margin-top: 18px; page-break-inside: avoid; }
    .floor-plan-block h3 { font-size: 12px; margin-bottom: 6px; }

    .sig-section {
      margin-top: 28px; padding: 18px; border: 1px solid #e5e5e5;
      border-radius: 10px; background: #fafafa;
    }
    .sig-title { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 14px; }
    .sig-grid { display: flex; gap: 24px; flex-wrap: wrap; }
    .sig-box { flex: 1; min-width: 200px; }
    .sig-label { font-size: 10px; color: #888; font-weight: 700; margin-bottom: 6px; }
    .sig-img { width: 100%; height: 80px; border: 1px solid #ddd; border-radius: 6px; object-fit: contain; background: #fff; }
    .sig-empty { width: 100%; height: 80px; border: 1px dashed #ddd; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 11px; }
    .sig-name { font-size: 11px; color: #555; margin-top: 5px; font-weight: 600; }

    .footer {
      margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e5e5;
      font-size: 9px; color: #aaa;
      display: flex; justify-content: space-between;
    }

    @media print {
      body { background: #fff; }
      .page { padding: 16px 14px; max-width: 100%; }
      .print-bar { display: none !important; }
      table.wkb-table { font-size: 8.5px; }
      .photos-grid { grid-template-columns: repeat(2, 1fr); }
      .photo-card { page-break-inside: avoid; }
      @page { margin: 12mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">📄 PDF opslaan / Afdrukken</button>
      <span style="font-size:11px;color:#888">${FORMAT_LABEL[format]} · ${totalCount} bewijzen · gegenereerd ${now}</span>
    </div>

    <div class="cover">
      <div class="format-pill">${FORMAT_TAG[format]}</div>
      <div class="cover-tag">WKB Officieel rapport</div>
      <div class="cover-title">${projectName}</div>
      <div class="cover-sub">Project ${projectId} &nbsp;·&nbsp; ${now}</div>
      ${metaLines ? `<div style="margin-top:8px">${metaLines}</div>` : ''}

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${totalCount}</div>
          <div class="stat-label">Bewijzen totaal</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#059669">${passedCount}</div>
          <div class="stat-label">AI akkoord</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#2563eb">${syncedCount}</div>
          <div class="stat-label">Cloud gesynced</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#7c3aed">${exifVerifiedCount}</div>
          <div class="stat-label">EXIF geverifieerd</div>
        </div>
      </div>
    </div>

    <h2 class="section-title">WKB Compliance Tabel</h2>
    ${totalCount > 0 ? `
    <table class="wkb-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Borgingspunt</th>
          <th>Timestamp</th>
          <th>GPS coord.</th>
          <th>GPS nauwkeurig.</th>
          <th>EXIF hash</th>
          <th>EXIF ✓</th>
          <th>AI status</th>
          <th>Tekening</th>
          <th>Pin X</th>
          <th>Pin Y</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>` : '<p style="color:#888;padding:18px;text-align:center;">Geen bewijzen geselecteerd voor dit format.</p>'}

    ${totalCount > 0 ? `
    <h2 class="section-title">Foto bijlage</h2>
    <div class="photos-grid">${photoBlocks}</div>` : ''}

    ${floorPlanAnnotations.length > 0 ? `
    <h2 class="section-title">📐 Locaties op tekening</h2>
    ${floorPlanAnnotations.map(fp => `
      <div class="floor-plan-block">
        <h3>${fp.name}</h3>
        <div style="position:relative;display:inline-block;width:100%">
          <img src="${fp.imageBase64}" style="width:100%;display:block;border-radius:8px" />
          <svg style="position:absolute;top:0;left:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${fp.pins.map(p => `
              <circle cx="${(p.x * 100).toFixed(2)}" cy="${(p.y * 100).toFixed(2)}" r="1.8"
                fill="${pinColorHex(p.aiStatus)}" stroke="white" stroke-width="0.4" opacity="0.9" />
            `).join('')}
          </svg>
        </div>
        <div style="font-size:11px;color:#888;margin-top:6px">${fp.pins.length} pin${fp.pins.length !== 1 ? 's' : ''} op deze tekening</div>
      </div>
    `).join('')}` : ''}

    ${(signatures.projectleider || signatures.opdrachtgever) ? `
    <div class="sig-section">
      <div class="sig-title">Ondertekening oplevering</div>
      <div class="sig-grid">
        <div class="sig-box">
          <div class="sig-label">PROJECTLEIDER / AANNEMER</div>
          ${signatures.projectleider
            ? `<img src="${signatures.projectleider}" class="sig-img" alt="Handtekening projectleider" />`
            : `<div class="sig-empty">Nog niet ondertekend</div>`}
          ${signatures.projectleiderNaam ? `<div class="sig-name">${signatures.projectleiderNaam}</div>` : ''}
        </div>
        <div class="sig-box">
          <div class="sig-label">OPDRACHTGEVER</div>
          ${signatures.opdrachtgever
            ? `<img src="${signatures.opdrachtgever}" class="sig-img" alt="Handtekening opdrachtgever" />`
            : `<div class="sig-empty">Nog niet ondertekend</div>`}
          ${signatures.opdrachtgeverNaam ? `<div class="sig-name">${signatures.opdrachtgeverNaam}</div>` : ''}
        </div>
      </div>
    </div>` : ''}

    <div class="footer">
      <span>${[pdfBrandLabel(), FORMAT_LABEL[format]].filter(Boolean).join(' · ')}</span>
      <span>Officieel rapport ${projectId} · ${now}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * exportWkbReportAsPdf — opent het officiële rapport in een nieuw venster
 * en triggert print(). Filtert evidence automatisch op basis van het format.
 */
export async function exportWkbReportAsPdf(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  format: WkbExportFormat,
  meta: DossierMeta = {},
  signatures: DossierSignatures = {},
  floorPlanAnnotations: FloorPlanAnnotation[] = []
): Promise<void> {
  if (typeof window === 'undefined') return;

  const filtered = filterEvidenceForExport(evidence, format);
  const imageMap = await loadEvidenceImages(filtered);

  const html = generateOfficialWkbReport(
    filtered,
    projectId,
    projectName,
    imageMap,
    meta,
    signatures,
    floorPlanAnnotations,
    format
  );

  const w = window.open('', '_blank', 'width=1100,height=780');

  if (!w) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }

  w.document.write(html);
  w.document.close();
  w.addEventListener('load', () => {
    setTimeout(() => w.print(), 600);
  });
}

// ────────────────────────────────────────────────
// Upload HTML dossier naar Supabase Storage
// en geeft de publieke URL terug (voor e-mail link)
// ────────────────────────────────────────────────

import { supabase } from '../lib/supabase';

export async function uploadDossierHtml(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  meta: DossierMeta = {},
  signatures: DossierSignatures = {}
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const imageMap = await loadEvidenceImages(evidence);
    const html = generateDossierHtml(evidence, projectId, projectName, imageMap, meta, signatures);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const fileName = `dossiers/borgingsdossier_${projectId}_${Date.now()}.html`;

    const { error } = await supabase.storage
      .from('wkb-evidence')
      .upload(fileName, blob, { contentType: 'text/html', upsert: true });

    if (error) {
      console.error('Dossier upload fout:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('wkb-evidence').getPublicUrl(fileName);
    return data.publicUrl ?? null;
  } catch (err) {
    console.error('Dossier upload mislukt:', err);
    return null;
  }
}

// ────────────────────────────────────────────────
// Sprint 3 — Dossier Lock (WKB bewaarplicht)
// Een afgesloten dossier is onveranderbaar.
// ────────────────────────────────────────────────

export type DossierStatus = 'OPEN' | 'LOCKED';

export interface DossierRow {
  id: string;
  projectId: string;
  status: DossierStatus;
  pdfUrl: string | null;
  signedByPl: string | null;
  signedByOg: string | null;
  signedAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
}

/**
 * Maak (of vind) een open dossier voor dit project.
 * Wordt aangeroepen vóór generateDossierHtml zodat we evidence kunnen koppelen.
 */
export async function getOrCreateOpenDossier(projectId: string): Promise<DossierRow | null> {
  try {
    // Bestaand OPEN dossier?
    const { data: existing } = await supabase
      .from('dossiers')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return mapDossierRow(existing);

    // Nieuw aanmaken
    const { data: created, error } = await supabase
      .from('dossiers')
      .insert({ project_id: projectId, status: 'OPEN' })
      .select()
      .single();

    if (error || !created) {
      console.error('getOrCreateOpenDossier insert error:', error);
      return null;
    }
    return mapDossierRow(created);
  } catch (err) {
    console.error('getOrCreateOpenDossier mislukt:', err);
    return null;
  }
}

/**
 * Koppel alle evidence van dit project aan het dossier zodat ze straks
 * mee gelocked worden. Wordt aangeroepen bij het ondertekenen.
 */
export async function attachEvidenceToDossier(
  dossierId: string,
  projectId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('evidence')
    .update({ dossier_id: dossierId })
    .eq('project_id', projectId)
    .is('dossier_id', null)
    .select('id');

  if (error) {
    console.error('attachEvidenceToDossier error:', error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * lockDossier — sluit het dossier af en maakt alle gekoppelde evidence
 * onveranderbaar. Roept de SQL-functie public.lock_dossier(uuid) aan
 * die in dezelfde transactie evidence.is_locked = true zet.
 *
 * Deze actie is ONOMKEERBAAR — een gelocked dossier kan niet meer geopend worden.
 *
 * @param dossierId  UUID van het dossier
 * @param pdfUrl     publieke URL van het ondertekende PDF (optioneel)
 * @param signedByPl naam van de projectleider die ondertekende
 * @param signedByOg naam van de opdrachtgever die ondertekende
 */
export async function lockDossier(
  dossierId: string,
  options: {
    pdfUrl?: string | null;
    signedByPl?: string | null;
    signedByOg?: string | null;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Schrijf eerst de hand­tekening-info weg (mag nog want status = OPEN)
    if (options.pdfUrl || options.signedByPl || options.signedByOg) {
      const { error: updErr } = await supabase
        .from('dossiers')
        .update({
          pdf_url: options.pdfUrl ?? null,
          signed_by_pl: options.signedByPl ?? null,
          signed_by_og: options.signedByOg ?? null,
          signed_at: new Date().toISOString(),
        })
        .eq('id', dossierId)
        .eq('status', 'OPEN');

      if (updErr) {
        return { success: false, error: `Handtekening opslaan mislukt: ${updErr.message}` };
      }
    }

    // 2. Roep de SQL-lock functie aan (lockt evidence + dossier in één transactie)
    const { error: rpcErr } = await supabase.rpc('lock_dossier', {
      p_dossier_id: dossierId,
    });

    if (rpcErr) {
      return { success: false, error: `Dossier afsluiten mislukt: ${rpcErr.message}` };
    }

    console.log(`🔒 Dossier ${dossierId} succesvol afgesloten en read-only gemaakt.`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Check of het dossier al gelocked is (handig voor UI-state).
 */
export async function isDossierLocked(dossierId: string): Promise<boolean> {
  const { data } = await supabase
    .from('dossiers')
    .select('status')
    .eq('id', dossierId)
    .single();
  return data?.status === 'LOCKED';
}

function mapDossierRow(row: any): DossierRow {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    pdfUrl: row.pdf_url ?? null,
    signedByPl: row.signed_by_pl ?? null,
    signedByOg: row.signed_by_og ?? null,
    signedAt: row.signed_at ?? null,
    lockedAt: row.locked_at ?? null,
    lockedBy: row.locked_by ?? null,
    createdAt: row.created_at,
  };
}
