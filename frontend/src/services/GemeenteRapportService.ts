/**
 * GemeenteRapportService — Dossier Bevoegd Gezag voor gemeente
 *
 * Genereert het formele gereedmeldingsdocument conform:
 *  - Wet Kwaliteitsborging voor het bouwen (Wkb) art. 2.17
 *  - Besluit kwaliteitsborging voor het bouwen (BKL) art. 7.16
 *  - Gevolgklasse 1 verklaring
 *
 * Inhoud:
 *  1. Cover met projectgegevens + vergunningsnummer
 *  2. Gereedmelding verklaring (wettelijke tekst)
 *  3. Samenvatting borgingspunten per discipline
 *  4. Afwijkingen & maatregelen (FAILED / NEEDS_REVIEW items)
 *  5. Verklaring kwaliteitsborger (met ondertekening)
 *  6. Bijlagen checklist
 */

export interface GemeenteEvidenceItem {
  id: string;
  inspectionPointId: string | null;
  discipline?: string | null;
  mediaUri: string | null;
  timestamp: string | null;
  aiStatus: string | null;
  aiNotes: string | null;
  fieldNote: string | null;
  userId: string | null;
}

export interface GemeenteRapportOptions {
  projectName: string;
  projectAddress: string;
  initiatorName: string;         // opdrachtgever / initiatiefnemer
  vergunningNummer?: string;     // omgevingsvergunning nummer
  kadastrale?: string;
  gevolgklasse?: string;         // default 'Gevolgklasse 1'
  bouwmeldingDatum?: string;     // datum bouwmelding bij bevoegd gezag
  gereedmeldingDatum?: string;   // datum gereedmelding (default today)
  projectId: string;
  evidence: GemeenteEvidenceItem[];
  kwaliteitsborger?: string;     // naam kwaliteitsborger
  kwaliteitsborgerOrg?: string;  // organisatienaam
  uitvoerder?: string;
  signatures?: {
    kwaliteitsborger?: string | null; // base64
    uitvoerder?: string | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(iso));
  } catch { return iso; }
}

function fmtDateTime(iso: string | null): string {
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
    case 'NEEDS_REVIEW': return { label: 'Nader onderzoek', color: '#92400e', bg: '#fef3c7' };
    default:             return { label: 'Openstaand', color: '#374151', bg: '#f3f4f6' };
  }
}

function getAfwijkingen(evidence: GemeenteEvidenceItem[]): GemeenteEvidenceItem[] {
  return evidence.filter(e => e.aiStatus === 'FAILED' || e.aiStatus === 'NEEDS_REVIEW');
}

// Latest evidence per borgingspunt
function latestPerPoint(evidence: GemeenteEvidenceItem[]) {
  const map = new Map<string, GemeenteEvidenceItem>();
  for (const e of evidence) {
    const key = e.inspectionPointId ?? e.id;
    const ex = map.get(key);
    if (!ex || (e.timestamp ?? '') > (ex.timestamp ?? '')) map.set(key, e);
  }
  return Array.from(map.values());
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

export function generateGemeenteRapportHtml(opts: GemeenteRapportOptions): string {
  const today = new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());

  const gereedDatum = fmtDate(opts.gereedmeldingDatum) === '—' ? today : fmtDate(opts.gereedmeldingDatum);
  const gevolgklasse = opts.gevolgklasse ?? 'Gevolgklasse 1';
  const latest = latestPerPoint(opts.evidence);

  const totaal    = latest.length;
  const akkoord   = latest.filter(e => e.aiStatus === 'PASSED').length;
  const afgekeurd = latest.filter(e => e.aiStatus === 'FAILED').length;
  const review    = latest.filter(e => e.aiStatus === 'NEEDS_REVIEW').length;
  const pct       = totaal > 0 ? Math.round((akkoord / totaal) * 100) : 0;

  const afwijkingen = getAfwijkingen(latest);

  const afwijkingRows = afwijkingen.map((e, i) => {
    const s = statusLabel(e.aiStatus);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${e.inspectionPointId ?? '—'}</td>
        <td>${e.discipline ?? '—'}</td>
        <td><span class="badge" style="background:${s.bg};color:${s.color}">${s.label}</span></td>
        <td>${e.aiNotes ?? e.fieldNote ?? '—'}</td>
        <td>${fmtDateTime(e.timestamp)}</td>
      </tr>
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
  <title>Dossier Bevoegd Gezag — ${opts.projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }

    @media print {
      .no-print { display: none !important; }
      .page-break { break-before: page; }
      @page { margin: 20mm 15mm; size: A4; }
    }

    /* Print bar */
    .print-bar { background: #1e3a5f; color: #fff; padding: 12px 32px;
      display: flex; align-items: center; justify-content: space-between; }
    .print-btn { background: #c8102e; color: #fff; border: none; padding: 8px 20px;
      border-radius: 8px; font-weight: 800; font-size: 11pt; cursor: pointer; }
    .wkb-ref { font-size: 9pt; color: rgba(255,255,255,0.7); }

    /* Cover */
    .cover { padding: 40px 40px 32px; border-bottom: 5px solid #1e3a5f; }
    .cover-overheid { font-size: 9pt; font-weight: 900; letter-spacing: 3px; color: #c8102e;
      text-transform: uppercase; margin-bottom: 6px; }
    .cover-title { font-size: 24pt; font-weight: 900; color: #0B0F19; line-height: 1.2; margin-bottom: 4px; }
    .cover-doc  { font-size: 14pt; color: #1e3a5f; font-weight: 700; margin-bottom: 24px; }
    .cover-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
    .cover-table td { padding: 7px 12px; border: 1px solid #d1d5db; }
    .cover-table td:first-child { font-weight: 800; background: #f8fafc; width: 200px; color: #374151; }
    .legal-ref { font-size: 9pt; color: #6b7280; padding: 12px 0 0;
      border-top: 1px solid #e5e7eb; }

    /* Sections */
    .section { padding: 28px 40px; border-bottom: 1px solid #e5e7eb; }
    .section-header { font-size: 10pt; font-weight: 900; letter-spacing: 2px;
      text-transform: uppercase; color: #1e3a5f; margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px; }
    .section-num { background: #1e3a5f; color: #fff; width: 24px; height: 24px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: 900; flex-shrink: 0; }

    /* Verklaring */
    .verklaring-box { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 10px;
      padding: 20px 24px; font-size: 10.5pt; line-height: 1.7; color: #1e3a5f; }
    .verklaring-box strong { color: #1e40af; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; margin-top: 4px; }
    .stat-card  { border-radius: 8px; padding: 14px 10px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-num   { font-size: 22pt; font-weight: 900; }
    .stat-lbl   { font-size: 8pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; margin-top: 4px; }
    .progress-bar { height: 10px; background: #e5e7eb; border-radius: 99px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; background: #059669; border-radius: 99px; transition: width 0.5s; }

    /* Afwijkingen tabel */
    table.afw { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 8px; }
    table.afw th { background: #1e3a5f; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; }
    table.afw td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    table.afw tr:nth-child(even) td { background: #f8fafc; }
    .badge { font-size: 8.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
    .no-afwijkingen { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
      padding: 16px; text-align: center; color: #065f46; font-weight: 700; }

    /* Bijlagen */
    .bijlage-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .bijlage-list li { display: flex; align-items: center; gap: 10px; font-size: 10pt; }
    .bijlage-list .check { color: #059669; font-weight: 900; font-size: 14pt; }
    .bijlage-list .cross { color: #dc2626; font-weight: 900; font-size: 14pt; }

    /* Signatures */
    .signatures { display: flex; gap: 32px; padding: 32px 40px; }
    .sig-block { flex: 1; }
    .sig-label { font-size: 9pt; font-weight: 900; letter-spacing: 1.5px;
      text-transform: uppercase; color: #6b7280; margin-bottom: 16px; }
    .sig-img   { height: 60px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 8px; }
    .sig-line  { height: 1px; background: #374151; margin: 60px 0 8px; }
    .sig-name  { font-weight: 700; font-size: 10pt; }
    .sig-date  { font-size: 9pt; color: #6b7280; margin-top: 2px; }

    .footer { padding: 16px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb;
      font-size: 8.5pt; color: #9ca3af; }
  </style>
</head>
<body>

  <!-- Print bar -->
  <div class="print-bar no-print">
    <span class="wkb-ref">Dossier Bevoegd Gezag · Wkb art. 2.17 · BKL art. 7.16 · ${today}</span>
    <button class="print-btn" onclick="window.print()">🖨️ Afdrukken / PDF opslaan</button>
  </div>

  <!-- COVER ──────────────────────────────────────────────────────────────── -->
  <div class="cover">
    <div class="cover-overheid">Wet Kwaliteitsborging voor het Bouwen</div>
    <div class="cover-title">${opts.projectName}</div>
    <div class="cover-doc">Dossier Bevoegd Gezag — Gereedmelding</div>
    <table class="cover-table">
      <tr><td>Projectadres</td><td>${opts.projectAddress}</td></tr>
      <tr><td>Initiatiefnemer / OG</td><td>${opts.initiatorName}</td></tr>
      ${opts.vergunningNummer ? `<tr><td>Omgevingsvergunning</td><td>${opts.vergunningNummer}</td></tr>` : ''}
      ${opts.kadastrale ? `<tr><td>Kadastraal perceel</td><td>${opts.kadastrale}</td></tr>` : ''}
      <tr><td>Gevolgklasse</td><td><strong>${gevolgklasse}</strong></td></tr>
      ${opts.bouwmeldingDatum ? `<tr><td>Datum bouwmelding</td><td>${fmtDate(opts.bouwmeldingDatum)}</td></tr>` : ''}
      <tr><td>Datum gereedmelding</td><td><strong>${gereedDatum}</strong></td></tr>
      ${opts.kwaliteitsborger ? `<tr><td>Kwaliteitsborger</td><td>${opts.kwaliteitsborger}${opts.kwaliteitsborgerOrg ? ` (${opts.kwaliteitsborgerOrg})` : ''}</td></tr>` : ''}
      ${opts.uitvoerder ? `<tr><td>Uitvoerder / WV</td><td>${opts.uitvoerder}</td></tr>` : ''}
      <tr><td>Referentie WKB SS</td><td>${opts.projectId}</td></tr>
    </table>
    <div class="legal-ref">
      Opgemaakt conform Wet Kwaliteitsborging voor het bouwen (Stb. 2019, 382) en
      Besluit kwaliteitsborging voor het bouwen (BKL). Van toepassing op bouwwerken
      van ${gevolgklasse} als bedoeld in art. 2.17 Wkb en art. 7.16 BKL.
    </div>
  </div>

  <!-- SECTIE 1: Gereedmelding verklaring ─────────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">1</div>
      Gereedmelding verklaring
    </div>
    <div class="verklaring-box">
      Ondergetekende, optredend als <strong>kwaliteitsborger</strong> in de zin van de
      Wet Kwaliteitsborging voor het bouwen, verklaart hierbij dat het bouwwerk
      <strong>${opts.projectName}</strong>, gelegen aan ${opts.projectAddress},
      is gebouwd in overeenstemming met de technische voorschriften uit het
      Besluit bouwwerken leefomgeving (Bbl), voor zover van toepassing op een
      bouwwerk van ${gevolgklasse}.<br /><br />
      De kwaliteitsborging is uitgevoerd conform de goedgekeurde borgingstool
      van WKB Snap &amp; Sync (Spee Solutions). De borgingspunten zijn
      systematisch gecontroleerd, gefotografeerd en beoordeeld. Dit dossier
      bevoegd gezag omvat alle bewijsstukken die zijn verzameld gedurende de
      bouwperiode.<br /><br />
      <strong>Datum gereedmelding:</strong> ${gereedDatum}
    </div>
  </div>

  <!-- SECTIE 2: Samenvatting borgingspunten ─────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">2</div>
      Samenvatting borgingspunten
    </div>
    <div class="stats-grid">
      <div class="stat-card" style="border-color:#bfdbfe;background:#eff6ff">
        <div class="stat-num" style="color:#1d4ed8">${totaal}</div>
        <div class="stat-lbl">Totaal</div>
      </div>
      <div class="stat-card" style="border-color:#bbf7d0;background:#f0fdf4">
        <div class="stat-num" style="color:#059669">${akkoord}</div>
        <div class="stat-lbl">Akkoord</div>
      </div>
      <div class="stat-card" style="border-color:#fecaca;background:#fef2f2">
        <div class="stat-num" style="color:#dc2626">${afgekeurd}</div>
        <div class="stat-lbl">Afgekeurd</div>
      </div>
      <div class="stat-card" style="border-color:#fde68a;background:#fffbeb">
        <div class="stat-num" style="color:#d97706">${review}</div>
        <div class="stat-lbl">Nader onderzoek</div>
      </div>
      <div class="stat-card" style="border-color:#d1fae5;background:#ecfdf5">
        <div class="stat-num" style="color:#059669">${pct}%</div>
        <div class="stat-lbl">Akkoord %</div>
      </div>
    </div>
    <div class="progress-bar" style="margin-top:16px">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>
  </div>

  <!-- SECTIE 3: Afwijkingen & maatregelen ───────────────────────────────── -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">3</div>
      Afwijkingen &amp; maatregelen (${afwijkingen.length})
    </div>
    ${afwijkingen.length === 0
      ? `<div class="no-afwijkingen">✓ Geen afwijkingen geconstateerd — alle borgingspunten akkoord</div>`
      : `<table class="afw">
           <thead>
             <tr>
               <th>#</th><th>Borgingspunt</th><th>Discipline</th>
               <th>Status</th><th>Bevinding / maatregel</th><th>Tijdstip</th>
             </tr>
           </thead>
           <tbody>${afwijkingRows}</tbody>
         </table>`
    }
  </div>

  <!-- SECTIE 4: Verklaring kwaliteitsborger ─────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">4</div>
      Verklaring kwaliteitsborger
    </div>
    <div class="verklaring-box">
      De kwaliteitsborger verklaart dat:<br /><br />
      a) de borgingstool gedurende het gehele bouwproces is ingezet;<br />
      b) de stopmomenten zijn nageleefd;<br />
      c) de afwijkingen van de technische bouweisen zijn vermeld in dit dossier;<br />
      d) de getroffen maatregelen naar het oordeel van de kwaliteitsborger
         toereikend zijn om te voldoen aan de technische voorschriften;<br />
      e) het bouwwerk gereed is voor gebruik.
    </div>
  </div>

  <!-- SECTIE 5: Bijlagen checklist ──────────────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">5</div>
      Bijlagen checklist
    </div>
    <ul class="bijlage-list">
      <li><span class="check">✓</span> Borgingsdossier (foto-bewijzen per borgingspunt)</li>
      <li><span class="check">✓</span> Overzicht borgingspunten met AI-beoordeling</li>
      ${afwijkingen.length > 0
        ? `<li><span class="check">✓</span> Afwijkingenregister (sectie 3 dit document)</li>`
        : `<li><span class="check">✓</span> Verklaring geen afwijkingen</li>`
      }
      <li><span class="${opts.vergunningNummer ? 'check' : 'cross'}">${opts.vergunningNummer ? '✓' : '○'}</span>
        Omgevingsvergunning: ${opts.vergunningNummer ?? 'niet opgegeven'}</li>
      <li><span class="${opts.bouwmeldingDatum ? 'check' : 'cross'}">${opts.bouwmeldingDatum ? '✓' : '○'}</span>
        Bouwmelding d.d. ${fmtDate(opts.bouwmeldingDatum)}</li>
    </ul>
  </div>

  <!-- Handtekeningen ─────────────────────────────────────────────────────── -->
  <div class="signatures">
    ${sigBlock('Kwaliteitsborger', opts.kwaliteitsborger, opts.signatures?.kwaliteitsborger)}
    ${sigBlock('Uitvoerder / Werkvoorbereider', opts.uitvoerder, opts.signatures?.uitvoerder)}
  </div>

  <div class="footer">
    Gegenereerd door WKB Snap &amp; Sync · Spee Solutions · ${today} ·
    Projectreferentie: ${opts.projectId} ·
    Wkb art. 2.17 / BKL art. 7.16
  </div>

</body>
</html>`;
}

/** Open in nieuw venster met print dialog */
export function printGemeenteRapport(html: string): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=960,height=1200');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Download als HTML-bestand */
export function downloadGemeenteRapport(html: string, projectId: string): void {
  if (typeof window === 'undefined') return;
  const d = new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wkb-dossier-bevoegd-gezag_${projectId}_${d}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
