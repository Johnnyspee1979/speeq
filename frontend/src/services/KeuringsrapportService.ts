/**
 * KeuringsrapportService — genereert een formeel WKB-keuringsrapport.
 *
 * Het rapport voldoet aan de WKB-borgingsplicht (Wkb art. 2.17 / BKL art. 7.16):
 *  - Cover met projectgegevens
 *  - Samenvatting per categorie
 *  - Per borgingspunt: meest recente foto + status + notities
 *  - Niet-akkoord items bovenaan (risicogestuurd)
 *  - Digitale handtekening vak
 *
 * Output: HTML-string → window.print() of blob-download als PDF
 */

export interface KeuringsrapportEvidence {
  id: string;
  inspectionPointId: string | null;
  mediaUri: string | null;
  timestamp: string | null;
  aiStatus: string | null;
  aiNotes: string | null;
  fieldNote: string | null;
  userId: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface KeuringsrapportOptions {
  projectName: string;
  projectAddress?: string | null;
  initiatorName?: string | null;
  kadastrale?: string | null;
  projectId: string;
  evidence: KeuringsrapportEvidence[];
  kwaliteitsborger?: string;
  uitvoerder?: string;
  signatures?: {
    kwaliteitsborger?: string | null;    // base64 data URL
    uitvoerder?: string | null;
    datum?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function statusLabel(status: string | null): { label: string; color: string; bg: string } {
  switch (status) {
    case 'PASSED':       return { label: 'Akkoord',   color: '#065f46', bg: '#d1fae5' };
    case 'FAILED':       return { label: 'Afgekeurd', color: '#991b1b', bg: '#fee2e2' };
    case 'NEEDS_REVIEW': return { label: 'Review',    color: '#92400e', bg: '#fef3c7' };
    default:             return { label: 'Pending',   color: '#374151', bg: '#f3f4f6' };
  }
}

function statusOrder(status: string | null): number {
  if (status === 'FAILED')       return 0;
  if (status === 'NEEDS_REVIEW') return 1;
  if (status === 'PENDING' || status == null) return 2;
  return 3;
}

// Group evidence by borgingspunt, take the latest per point
function groupByBorgingspunt(evidence: KeuringsrapportEvidence[]) {
  const map = new Map<string, KeuringsrapportEvidence>();
  for (const e of evidence) {
    const key = e.inspectionPointId ?? 'onbekend';
    const existing = map.get(key);
    if (!existing || (e.timestamp ?? '') > (existing.timestamp ?? '')) {
      map.set(key, e);
    }
  }
  return Array.from(map.entries())
    .map(([id, ev]) => ({ borgingspuntId: id, latest: ev }))
    .sort((a, b) => statusOrder(a.latest.aiStatus) - statusOrder(b.latest.aiStatus));
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

export function generateKeuringsrapportHtml(opts: KeuringsrapportOptions): string {
  const today = opts.signatures?.datum ?? new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());

  const grouped = groupByBorgingspunt(opts.evidence);
  const totaal    = grouped.length;
  const akkoord   = grouped.filter(g => g.latest.aiStatus === 'PASSED').length;
  const afgekeurd = grouped.filter(g => g.latest.aiStatus === 'FAILED').length;
  const review    = grouped.filter(g => g.latest.aiStatus === 'NEEDS_REVIEW').length;
  const pending   = totaal - akkoord - afgekeurd - review;
  const pct       = totaal > 0 ? Math.round((akkoord / totaal) * 100) : 0;

  const borgingspuntRows = grouped.map(({ borgingspuntId, latest }) => {
    const s = statusLabel(latest.aiStatus);
    const uri = latest.mediaUri ?? '';
    const imgTag = uri
      ? `<img src="${uri}" alt="Bewijs" class="bp-photo" onerror="this.style.display='none'" />`
      : `<div class="bp-no-photo">📷 Geen foto</div>`;

    return `
      <div class="borgingspunt ${latest.aiStatus === 'FAILED' ? 'bp-failed' : latest.aiStatus === 'NEEDS_REVIEW' ? 'bp-review' : ''}">
        <div class="bp-header">
          <div class="bp-id">${borgingspuntId}</div>
          <div class="bp-badge" style="background:${s.bg};color:${s.color}">${s.label}</div>
        </div>
        ${imgTag}
        <table class="bp-table">
          <tr><td class="bp-label">Tijdstip</td><td>${fmtDate(latest.timestamp)}</td></tr>
          ${latest.latitude != null ? `<tr><td class="bp-label">GPS</td><td>${latest.latitude.toFixed(5)}, ${latest.longitude?.toFixed(5)}</td></tr>` : ''}
          ${latest.aiNotes ? `<tr><td class="bp-label">AI-bevinding</td><td>${latest.aiNotes}</td></tr>` : ''}
          ${latest.fieldNote ? `<tr><td class="bp-label">Veldnotitie</td><td>${latest.fieldNote}</td></tr>` : ''}
          ${latest.userId ? `<tr><td class="bp-label">Geüpload door</td><td>${latest.userId}</td></tr>` : ''}
        </table>
      </div>
    `;
  }).join('');

  const sigBlock = (label: string, name?: string, sig?: string | null) => `
    <div class="sig-block">
      <div class="sig-label">${label}</div>
      ${sig ? `<img src="${sig}" class="sig-img" alt="Handtekening" />` : '<div class="sig-line"></div>'}
      <div class="sig-name">${name ?? '________________'}</div>
      <div class="sig-date">${today}</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WKB Keuringsrapport — ${opts.projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }

    /* Print */
    @media print {
      .no-print { display: none !important; }
      .borgingspunt { break-inside: avoid; }
      @page { margin: 20mm 15mm; }
    }

    /* Cover */
    .cover { padding: 40px 32px; border-bottom: 4px solid #A40D2F; margin-bottom: 24px; }
    .cover-brand { font-size: 10pt; font-weight: 800; letter-spacing: 2px; color: #A40D2F; text-transform: uppercase; margin-bottom: 8px; }
    .cover-title { font-size: 22pt; font-weight: 900; color: #0B0F19; margin-bottom: 4px; line-height: 1.2; }
    .cover-sub   { font-size: 13pt; color: #555; margin-bottom: 20px; }
    .cover-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    .cover-table td { padding: 6px 10px; border: 1px solid #e5e7eb; }
    .cover-table td:first-child { font-weight: 700; background: #f9fafb; width: 160px; }
    .cover-art { font-size: 9pt; color: #888; margin-top: 16px; }

    /* Samenvatting */
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 0 32px 24px; }
    .summary-card { border-radius: 8px; padding: 14px; text-align: center; border: 1px solid #e5e7eb; }
    .summary-num  { font-size: 24pt; font-weight: 900; }
    .summary-lbl  { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-top: 4px; }

    /* Borgingspunten */
    .section-title { font-size: 10pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
      color: #888; padding: 0 32px; margin: 24px 0 12px; }
    .borgingspunt { margin: 0 32px 16px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .borgingspunt.bp-failed { border-color: #fca5a5; }
    .borgingspunt.bp-review { border-color: #fcd34d; }
    .bp-header { display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .bp-id { font-weight: 800; font-size: 12pt; }
    .bp-badge { font-size: 9pt; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
    .bp-photo { width: 100%; max-height: 260px; object-fit: cover; display: block; }
    .bp-no-photo { padding: 32px; text-align: center; color: #999; font-size: 14pt; background: #f3f4f6; }
    .bp-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .bp-table tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }
    .bp-table td { padding: 6px 14px; }
    .bp-label { font-weight: 700; color: #555; width: 130px; }

    /* Handtekeningen */
    .signatures { display: flex; gap: 32px; padding: 32px; border-top: 2px solid #e5e7eb; margin-top: 32px; }
    .sig-block { flex: 1; }
    .sig-label { font-size: 9pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-bottom: 16px; }
    .sig-img   { height: 60px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 8px; }
    .sig-line  { height: 1px; background: #374151; margin-bottom: 8px; margin-top: 60px; }
    .sig-name  { font-weight: 700; font-size: 10pt; }
    .sig-date  { font-size: 9pt; color: #888; margin-top: 2px; }

    /* Print knop */
    .print-bar { background: #0B0F19; color: #fff; padding: 12px 32px; display: flex; align-items: center; justify-content: space-between; }
    .print-btn { background: #A40D2F; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 800; font-size: 11pt; cursor: pointer; }
    .wkb-ref { font-size: 9pt; color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>

  <!-- Print balk -->
  <div class="print-bar no-print">
    <span class="wkb-ref">WKB Keuringsrapport · Wkb art. 2.17 · ${today}</span>
    <button class="print-btn" onclick="window.print()">🖨️ Afdrukken / PDF opslaan</button>
  </div>

  <!-- Cover -->
  <div class="cover">
    <div class="cover-brand">WKB Snap &amp; Sync · Spee Solutions</div>
    <div class="cover-title">${opts.projectName}</div>
    <div class="cover-sub">WKB Keuringsrapport</div>
    <table class="cover-table">
      ${opts.projectAddress ? `<tr><td>Adres</td><td>${opts.projectAddress}</td></tr>` : ''}
      ${opts.initiatorName  ? `<tr><td>Initiatiefnemer / OG</td><td>${opts.initiatorName}</td></tr>` : ''}
      ${opts.kadastrale     ? `<tr><td>Kadastraal</td><td>${opts.kadastrale}</td></tr>` : ''}
      <tr><td>Datum rapportage</td><td>${today}</td></tr>
      ${opts.kwaliteitsborger ? `<tr><td>Kwaliteitsborger</td><td>${opts.kwaliteitsborger}</td></tr>` : ''}
      ${opts.uitvoerder       ? `<tr><td>Uitvoerder / WV</td><td>${opts.uitvoerder}</td></tr>` : ''}
      <tr><td>Totaal borgingspunten</td><td><strong>${totaal}</strong></td></tr>
    </table>
    <div class="cover-art">Gegenereerd door WKB Snap &amp; Sync (Spee Solutions) · Referentie: ${opts.projectId}</div>
  </div>

  <!-- Samenvatting -->
  <div class="summary">
    <div class="summary-card" style="border-color:#d1fae5;background:#f0fdf4">
      <div class="summary-num" style="color:#059669">${akkoord}</div>
      <div class="summary-lbl">Akkoord</div>
    </div>
    <div class="summary-card" style="border-color:#fee2e2;background:#fef2f2">
      <div class="summary-num" style="color:#dc2626">${afgekeurd}</div>
      <div class="summary-lbl">Afgekeurd</div>
    </div>
    <div class="summary-card" style="border-color:#fef3c7;background:#fffbeb">
      <div class="summary-num" style="color:#d97706">${review}</div>
      <div class="summary-lbl">Review</div>
    </div>
    <div class="summary-card" style="border-color:#e5e7eb;background:#f9fafb">
      <div class="summary-num" style="color:#6b7280">${pct}%</div>
      <div class="summary-lbl">Akkoord %</div>
    </div>
  </div>

  <!-- Borgingspunten -->
  <div class="section-title">Borgingspunten (${totaal}) — niet-akkoord eerst</div>
  ${borgingspuntRows}

  <!-- Handtekeningen -->
  <div class="signatures">
    ${sigBlock('Kwaliteitsborger', opts.kwaliteitsborger, opts.signatures?.kwaliteitsborger)}
    ${sigBlock('Uitvoerder / WV',  opts.uitvoerder,       opts.signatures?.uitvoerder)}
  </div>

</body>
</html>`;
}

/** Open het rapport in een nieuw venster en activeer de print-dialog. */
export function printKeuringsrapport(html: string): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Download het rapport als HTML-bestand (fallback als print niet werkt). */
export function downloadKeuringsrapport(html: string, projectId: string): void {
  if (typeof window === 'undefined') return;
  const d = new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wkb-keuringsrapport_${projectId}_${d}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
