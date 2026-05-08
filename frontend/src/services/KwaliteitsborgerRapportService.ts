/**
 * KwaliteitsborgerRapportService — Volledig technisch kwaliteitsrapport
 *
 * Bestemd voor: kwaliteitsborger intern gebruik + opleverdossier
 *
 * Inhoud:
 *  1. Cover met projectgegevens
 *  2. Uitvoeringsverklaring + stopmomenten status
 *  3. Technisch overzicht per discipline (constructie, installaties, bouwfysica etc.)
 *  4. Volledig fotoverzicht per borgingspunt (met GPS, tijdstip, AI-status)
 *  5. Risicobeoordeling tabel (FAILED + NEEDS_REVIEW gesorteerd)
 *  6. NEN-normen compliance tabel
 *  7. Handtekening kwaliteitsborger
 */

export interface KwbEvidenceItem {
  id: string;
  inspectionPointId: string | null;
  discipline?: string | null;
  mediaUri: string | null;
  timestamp: string | null;
  aiStatus: string | null;
  aiNotes: string | null;
  fieldNote: string | null;
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StopmomentItem {
  id: string;
  label: string;
  verplicht: boolean;
  akkoord: boolean;
  datum?: string | null;
  notitie?: string | null;
}

export interface KwaliteitsborgerRapportOptions {
  projectName: string;
  projectAddress: string;
  initiatorName?: string;
  vergunningNummer?: string;
  kadastrale?: string;
  gevolgklasse?: string;
  projectId: string;
  evidence: KwbEvidenceItem[];
  stopmomenten?: StopmomentItem[];
  kwaliteitsborger?: string;
  kwaliteitsborgerOrg?: string;
  uitvoerder?: string;
  rapportDatum?: string;
  nenStandards?: Array<{ code: string; omschrijving: string; gecontroleerd: boolean; opmerking?: string }>;
  signatures?: {
    kwaliteitsborger?: string | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DISCIPLINES: Array<{ id: string; label: string; icon: string }> = [
  { id: 'constructie',     label: 'Constructie',         icon: '🏗️' },
  { id: 'installatie',     label: 'Installaties',        icon: '⚙️' },
  { id: 'bouwfysica',      label: 'Bouwfysica',          icon: '🌡️' },
  { id: 'brandveiligheid', label: 'Brandveiligheid',     icon: '🔥' },
  { id: 'elektrotechniek', label: 'Elektrotechniek',     icon: '⚡' },
  { id: 'afbouw',          label: 'Afbouw',              icon: '🔨' },
  { id: 'overig',          label: 'Overig',              icon: '📋' },
];

const DEFAULT_NEN: Array<{ code: string; omschrijving: string }> = [
  { code: 'NEN 1006',  omschrijving: 'Drinkwaterinstallaties' },
  { code: 'NEN 3215',  omschrijving: 'Rioleringsinstallaties' },
  { code: 'NEN 1010',  omschrijving: 'Laagspanningsinstallaties' },
  { code: 'NEN 5077',  omschrijving: 'Geluidsisolatie' },
  { code: 'NEN 1087',  omschrijving: 'Ventilatie woonfuncties' },
  { code: 'NEN 2580',  omschrijving: 'Oppervlakten en inhoud' },
  { code: 'NEN 6068',  omschrijving: 'Bepaling van de rookdoorlatendheid' },
  { code: 'NEN 8700',  omschrijving: 'Beoordelingsrichtlijn bestaande bouw' },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(iso));
  } catch { return iso; }
}

function statusLabel(status: string | null): { label: string; color: string; bg: string; icon: string } {
  switch (status) {
    case 'PASSED':       return { label: 'Akkoord',           color: '#065f46', bg: '#d1fae5', icon: '✓' };
    case 'FAILED':       return { label: 'Afgekeurd',         color: '#991b1b', bg: '#fee2e2', icon: '✗' };
    case 'NEEDS_REVIEW': return { label: 'Nader onderzoek',   color: '#92400e', bg: '#fef3c7', icon: '⚠' };
    default:             return { label: 'Openstaand',        color: '#374151', bg: '#f3f4f6', icon: '○' };
  }
}

function statusOrder(s: string | null): number {
  if (s === 'FAILED') return 0;
  if (s === 'NEEDS_REVIEW') return 1;
  if (s === 'PENDING' || s == null) return 2;
  return 3;
}

function latestPerPoint(evidence: KwbEvidenceItem[]) {
  const map = new Map<string, KwbEvidenceItem>();
  for (const e of evidence) {
    const key = e.inspectionPointId ?? e.id;
    const ex = map.get(key);
    if (!ex || (e.timestamp ?? '') > (ex.timestamp ?? '')) map.set(key, e);
  }
  return Array.from(map.values()).sort((a, b) => statusOrder(a.aiStatus) - statusOrder(b.aiStatus));
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

export function generateKwaliteitsborgerRapportHtml(opts: KwaliteitsborgerRapportOptions): string {
  const today = new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());
  const rapportDatum = fmtDate(opts.rapportDatum) === '—' ? today : fmtDate(opts.rapportDatum);
  const gevolgklasse = opts.gevolgklasse ?? 'Gevolgklasse 1';

  const latest = latestPerPoint(opts.evidence);
  const totaal    = latest.length;
  const akkoord   = latest.filter(e => e.aiStatus === 'PASSED').length;
  const afgekeurd = latest.filter(e => e.aiStatus === 'FAILED').length;
  const review    = latest.filter(e => e.aiStatus === 'NEEDS_REVIEW').length;
  const pending   = totaal - akkoord - afgekeurd - review;
  const pct       = totaal > 0 ? Math.round((akkoord / totaal) * 100) : 0;

  // ── Discipline overzicht ──
  const disciplineBlocks = DISCIPLINES.map(disc => {
    const items = latest.filter(e =>
      (e.discipline ?? 'overig').toLowerCase().includes(disc.id) ||
      disc.id === 'overig' && !DISCIPLINES.slice(0,-1).some(d => (e.discipline ?? '').toLowerCase().includes(d.id))
    );
    if (items.length === 0) return '';
    const ok = items.filter(e => e.aiStatus === 'PASSED').length;
    const nok = items.filter(e => e.aiStatus === 'FAILED' || e.aiStatus === 'NEEDS_REVIEW').length;
    const pctDisc = items.length > 0 ? Math.round((ok / items.length) * 100) : 0;
    return `
      <div class="disc-card ${nok > 0 ? 'disc-card-warn' : 'disc-card-ok'}">
        <div class="disc-header">
          <span class="disc-icon">${disc.icon}</span>
          <span class="disc-name">${disc.label}</span>
          <span class="disc-count">${items.length} punten</span>
        </div>
        <div class="disc-bar-wrap">
          <div class="disc-bar"><div class="disc-fill ${nok > 0 ? 'disc-fill-warn' : ''}" style="width:${pctDisc}%"></div></div>
          <span class="disc-pct">${pctDisc}%</span>
        </div>
        ${nok > 0 ? `<div class="disc-nok">⚠ ${nok} punt${nok > 1 ? 'en' : ''} vereist aandacht</div>` : ''}
      </div>
    `;
  }).filter(Boolean).join('');

  // ── Stopmomenten ──
  const stopRows = (opts.stopmomenten ?? []).map(s => `
    <tr>
      <td>${s.label}</td>
      <td><span class="badge ${s.verplicht ? 'badge-required' : 'badge-optional'}">${s.verplicht ? 'Verplicht' : 'Aanbevolen'}</span></td>
      <td><span class="badge ${s.akkoord ? 'badge-ok' : 'badge-nok'}">${s.akkoord ? '✓ Akkoord' : '○ Openstaand'}</span></td>
      <td>${fmtDate(s.datum)}</td>
      <td>${s.notitie ?? '—'}</td>
    </tr>
  `).join('');

  // ── Risicobeoordeling ──
  const risicoItems = latest.filter(e => e.aiStatus === 'FAILED' || e.aiStatus === 'NEEDS_REVIEW');
  const risicoRows = risicoItems.map((e, i) => {
    const s = statusLabel(e.aiStatus);
    const risico = e.aiStatus === 'FAILED' ? 'Hoog' : 'Middel';
    const risicoColor = e.aiStatus === 'FAILED' ? '#dc2626' : '#d97706';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${e.inspectionPointId ?? '—'}</td>
        <td>${e.discipline ?? '—'}</td>
        <td><span class="badge" style="background:${s.bg};color:${s.color}">${s.icon} ${s.label}</span></td>
        <td><strong style="color:${risicoColor}">${risico}</strong></td>
        <td>${e.aiNotes ?? e.fieldNote ?? '—'}</td>
      </tr>
    `;
  }).join('');

  // ── Borgingspunt foto-kaarten ──
  const borgingspuntCards = latest.map(e => {
    const s = statusLabel(e.aiStatus);
    const img = e.mediaUri
      ? `<img src="${e.mediaUri}" class="bp-photo" alt="Bewijs" onerror="this.parentElement.innerHTML='<div class=bp-no-photo>📷 Foto niet beschikbaar</div>'" />`
      : `<div class="bp-no-photo">📷 Geen foto</div>`;
    return `
      <div class="bp-card ${e.aiStatus === 'FAILED' ? 'bp-failed' : e.aiStatus === 'NEEDS_REVIEW' ? 'bp-review' : ''}">
        <div class="bp-card-header">
          <span class="bp-id">${e.inspectionPointId ?? e.id.slice(0,8)}</span>
          <span class="badge" style="background:${s.bg};color:${s.color}">${s.icon} ${s.label}</span>
        </div>
        ${img}
        <div class="bp-meta">
          <span>🕐 ${fmtDateTime(e.timestamp)}</span>
          ${e.latitude != null ? `<span>📍 ${e.latitude.toFixed(4)}, ${e.longitude?.toFixed(4)}</span>` : ''}
          ${e.userId ? `<span>👷 ${e.userId}</span>` : ''}
        </div>
        ${e.aiNotes ? `<div class="bp-note">🤖 ${e.aiNotes}</div>` : ''}
        ${e.fieldNote ? `<div class="bp-note bp-field">📝 ${e.fieldNote}</div>` : ''}
      </div>
    `;
  }).join('');

  // ── NEN normen tabel ──
  const nenItems = opts.nenStandards ?? DEFAULT_NEN.map(n => ({ ...n, gecontroleerd: false }));
  const nenRows = nenItems.map(n => `
    <tr>
      <td><strong>${n.code}</strong></td>
      <td>${n.omschrijving}</td>
      <td><span class="badge ${n.gecontroleerd ? 'badge-ok' : 'badge-pending'}">${n.gecontroleerd ? '✓ Gecontroleerd' : '○ Te controleren'}</span></td>
      <td>${(n as any).opmerking ?? '—'}</td>
    </tr>
  `).join('');

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
  <title>Kwaliteitsborger Rapport — ${opts.projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #111; background: #fff; }

    @media print {
      .no-print { display: none !important; }
      .page-break { break-before: page; }
      .bp-card { break-inside: avoid; }
      @page { margin: 18mm 14mm; size: A4; }
    }

    /* Print bar */
    .print-bar { background: #134e4a; color: #fff; padding: 12px 32px;
      display: flex; align-items: center; justify-content: space-between; }
    .print-btn { background: #0f766e; color: #fff; border: none; padding: 8px 20px;
      border-radius: 8px; font-weight: 800; font-size: 11pt; cursor: pointer; }

    /* Cover */
    .cover { padding: 40px 40px 32px; border-bottom: 5px solid #0f766e; }
    .cover-brand { font-size: 9pt; font-weight: 900; letter-spacing: 3px;
      color: #0f766e; text-transform: uppercase; margin-bottom: 6px; }
    .cover-title  { font-size: 22pt; font-weight: 900; color: #0B0F19; margin-bottom: 4px; line-height: 1.2; }
    .cover-doc    { font-size: 13pt; color: #134e4a; font-weight: 700; margin-bottom: 20px; }
    .cover-table  { width: 100%; border-collapse: collapse; font-size: 10pt; }
    .cover-table td { padding: 7px 12px; border: 1px solid #d1d5db; }
    .cover-table td:first-child { font-weight: 800; background: #f0fdf4; width: 200px; }

    /* Sections */
    .section { padding: 28px 40px; border-bottom: 1px solid #e5e7eb; }
    .section-header { font-size: 10pt; font-weight: 900; letter-spacing: 2px;
      text-transform: uppercase; color: #134e4a; margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px; }
    .section-num { background: #134e4a; color: #fff; width: 24px; height: 24px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: 900; flex-shrink: 0; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
    .stat-card { border-radius: 8px; padding: 12px 8px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-num  { font-size: 20pt; font-weight: 900; }
    .stat-lbl  { font-size: 8pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; margin-top: 4px; }

    /* Discipline cards */
    .disc-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    .disc-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
    .disc-card-ok { border-color: #bbf7d0; background: #f0fdf4; }
    .disc-card-warn { border-color: #fde68a; background: #fffbeb; }
    .disc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .disc-icon { font-size: 16pt; }
    .disc-name { font-weight: 800; font-size: 11pt; flex: 1; }
    .disc-count { font-size: 9pt; color: #6b7280; }
    .disc-bar-wrap { display: flex; align-items: center; gap: 8px; }
    .disc-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
    .disc-fill { height: 100%; background: #059669; border-radius: 99px; }
    .disc-fill-warn { background: #d97706; }
    .disc-pct { font-size: 10pt; font-weight: 800; color: #374151; min-width: 36px; text-align: right; }
    .disc-nok { margin-top: 8px; font-size: 9pt; color: #92400e; font-weight: 700; }

    /* Tables */
    table.data { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 8px; }
    table.data th { background: #134e4a; color: #fff; padding: 8px 10px; text-align: left; font-size: 9pt; }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #f8fafc; }

    /* Badges */
    .badge { font-size: 8.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
    .badge-ok       { background: #d1fae5; color: #065f46; }
    .badge-nok      { background: #fee2e2; color: #991b1b; }
    .badge-warn     { background: #fef3c7; color: #92400e; }
    .badge-pending  { background: #f3f4f6; color: #374151; }
    .badge-required { background: #dbeafe; color: #1d4ed8; }
    .badge-optional { background: #f3f4f6; color: #6b7280; }

    /* Borgingspunt foto-kaarten */
    .bp-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .bp-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .bp-card.bp-failed { border-color: #fca5a5; }
    .bp-card.bp-review { border-color: #fcd34d; }
    .bp-card-header { display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .bp-id { font-weight: 800; font-size: 10pt; }
    .bp-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
    .bp-no-photo { padding: 24px; text-align: center; color: #9ca3af; font-size: 13pt; background: #f3f4f6; }
    .bp-meta { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 4px; font-size: 8.5pt; color: #6b7280; }
    .bp-note { padding: 4px 12px 8px; font-size: 9pt; color: #374151; }
    .bp-field { color: #1d4ed8; }

    /* Signatures */
    .signatures { display: flex; gap: 40px; padding: 32px 40px; }
    .sig-block { flex: 1; }
    .sig-label { font-size: 9pt; font-weight: 900; letter-spacing: 1.5px;
      text-transform: uppercase; color: #6b7280; margin-bottom: 16px; }
    .sig-img   { height: 60px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 8px; }
    .sig-line  { height: 1px; background: #374151; margin: 60px 0 8px; }
    .sig-name  { font-weight: 700; font-size: 10pt; }
    .sig-date  { font-size: 9pt; color: #6b7280; margin-top: 2px; }

    .footer { padding: 16px 40px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
      font-size: 8.5pt; color: #6b7280; }
  </style>
</head>
<body>

  <!-- Print bar -->
  <div class="print-bar no-print">
    <span style="font-size:9pt;color:rgba(255,255,255,0.7)">
      Kwaliteitsborger Technisch Rapport · ${rapportDatum} · ${opts.projectName}
    </span>
    <button class="print-btn" onclick="window.print()">🖨️ Afdrukken / PDF opslaan</button>
  </div>

  <!-- COVER ──────────────────────────────────────────────────────────────── -->
  <div class="cover">
    <div class="cover-brand">WKB Snap &amp; Sync · Technisch Kwaliteitsrapport</div>
    <div class="cover-title">${opts.projectName}</div>
    <div class="cover-doc">Kwaliteitsborger Eindrapport — ${gevolgklasse}</div>
    <table class="cover-table">
      <tr><td>Adres</td><td>${opts.projectAddress}</td></tr>
      ${opts.initiatorName ? `<tr><td>Initiatiefnemer</td><td>${opts.initiatorName}</td></tr>` : ''}
      ${opts.vergunningNummer ? `<tr><td>Vergunningnummer</td><td>${opts.vergunningNummer}</td></tr>` : ''}
      ${opts.kadastrale ? `<tr><td>Kadastraal</td><td>${opts.kadastrale}</td></tr>` : ''}
      <tr><td>Gevolgklasse</td><td><strong>${gevolgklasse}</strong></td></tr>
      ${opts.kwaliteitsborger ? `<tr><td>Kwaliteitsborger</td><td>${opts.kwaliteitsborger}${opts.kwaliteitsborgerOrg ? ` — ${opts.kwaliteitsborgerOrg}` : ''}</td></tr>` : ''}
      ${opts.uitvoerder ? `<tr><td>Uitvoerder / WV</td><td>${opts.uitvoerder}</td></tr>` : ''}
      <tr><td>Rapportdatum</td><td><strong>${rapportDatum}</strong></td></tr>
      <tr><td>Borgingspunten</td><td><strong>${totaal} totaal · ${akkoord} akkoord · ${pct}% voldoet</strong></td></tr>
    </table>
  </div>

  <!-- SECTIE 1: Samenvatting ─────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-header"><div class="section-num">1</div>Technische samenvatting</div>
    <div class="stats-grid">
      <div class="stat-card" style="border-color:#bfdbfe;background:#eff6ff">
        <div class="stat-num" style="color:#1d4ed8">${totaal}</div>
        <div class="stat-lbl">Totaal punten</div>
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
        <div class="stat-lbl">Nader ond.</div>
      </div>
      <div class="stat-card" style="border-color:#e5e7eb;background:#f9fafb">
        <div class="stat-num" style="color:#374151">${pending}</div>
        <div class="stat-lbl">Openstaand</div>
      </div>
    </div>
  </div>

  <!-- SECTIE 2: Discipline overzicht ─────────────────────────────────────── -->
  ${disciplineBlocks ? `
  <div class="section">
    <div class="section-header"><div class="section-num">2</div>Technisch overzicht per discipline</div>
    <div class="disc-grid">${disciplineBlocks}</div>
  </div>` : ''}

  <!-- SECTIE 3: Stopmomenten ─────────────────────────────────────────────── -->
  ${opts.stopmomenten && opts.stopmomenten.length > 0 ? `
  <div class="section">
    <div class="section-header"><div class="section-num">3</div>Stopmomenten status</div>
    <table class="data">
      <thead><tr><th>Stopmoment</th><th>Type</th><th>Status</th><th>Datum</th><th>Notitie</th></tr></thead>
      <tbody>${stopRows}</tbody>
    </table>
  </div>` : ''}

  <!-- SECTIE 4: Risicobeoordeling ────────────────────────────────────────── -->
  <div class="section page-break">
    <div class="section-header"><div class="section-num">4</div>Risicobeoordeling (${risicoItems.length} punten)</div>
    ${risicoItems.length === 0
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;color:#065f46;font-weight:700">✓ Geen risico-items — alle borgingspunten akkoord</div>`
      : `<table class="data">
           <thead><tr><th>#</th><th>Borgingspunt</th><th>Discipline</th><th>Status</th><th>Risico</th><th>Bevinding</th></tr></thead>
           <tbody>${risicoRows}</tbody>
         </table>`
    }
  </div>

  <!-- SECTIE 5: Volledig fotoverzicht ────────────────────────────────────── -->
  <div class="section page-break">
    <div class="section-header"><div class="section-num">5</div>Fotoverzicht borgingspunten (${totaal})</div>
    <div class="bp-grid">${borgingspuntCards}</div>
  </div>

  <!-- SECTIE 6: NEN-normen compliance ────────────────────────────────────── -->
  <div class="section page-break">
    <div class="section-header"><div class="section-num">6</div>NEN-normen compliance</div>
    <table class="data">
      <thead><tr><th>NEN-norm</th><th>Omschrijving</th><th>Status</th><th>Opmerking</th></tr></thead>
      <tbody>${nenRows}</tbody>
    </table>
  </div>

  <!-- Handtekening ───────────────────────────────────────────────────────── -->
  <div class="signatures">
    ${sigBlock('Kwaliteitsborger', opts.kwaliteitsborger, opts.signatures?.kwaliteitsborger)}
  </div>

  <div class="footer">
    Vertrouwelijk — Uitsluitend bestemd voor kwaliteitsborger en betrokken partijen ·
    WKB Snap &amp; Sync · Spee Solutions · ${today} · Ref: ${opts.projectId}
  </div>

</body>
</html>`;
}

/** Open in nieuw venster */
export function printKwaliteitsborgerRapport(html: string): void {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=960,height=1200');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Download als HTML */
export function downloadKwaliteitsborgerRapport(html: string, projectId: string): void {
  if (typeof window === 'undefined') return;
  const d = new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wkb-kwaliteitsborger-rapport_${projectId}_${d}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
