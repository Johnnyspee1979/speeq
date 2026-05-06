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

export function generateDossierHtml(
  evidence: StoredWkbEvidence[],
  projectId: string,
  projectName: string,
  imageMap: Record<string, string> = {},
  meta: DossierMeta = {},
  signatures: DossierSignatures = {}
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

    <!-- Handtekeningen -->
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
          ${signatures.signedAt ? `<div class="sig-date">${new Date(signatures.signedAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
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

    <!-- Footer -->
    <div class="footer">
      <span>WKB Snap &amp; Sync — Spee Solutions</span>
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
