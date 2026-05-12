/**
 * QRStickerService — genereer een print-klaar A4 vel met QR-stickers
 * per borgingspunt van een project.
 *
 * De QR code bevat een deep-link URL zodat de vakman na scannen direct
 * op het juiste borgingspunt uitkomt in de PWA.
 *
 * QR-code generatie via https://api.qrserver.com (gratis, geen API-key nodig).
 * Bij afdrukken worden de afbeeldingen inline geladen vanuit de browser cache.
 */

import { getBrandingSync } from './TenantBrandingService';

function pdfBrandLabel(): string {
  return getBrandingSync().companyName ?? '';
}

export interface StickerTask {
  inspectionPointId: string;
  label: string;
  categoryIcon: string;
  discipline: string;
}

export interface QRStickerSheetOptions {
  projectId: string;
  projectName: string;
  baseUrl?: string;    // PWA base URL — default: window.location.origin
  tasks: StickerTask[];
}

/** Genereer de deep-link URL die in de QR code staat. */
export function buildTaskUrl(baseUrl: string, projectId: string, inspectionPointId: string): string {
  return `${baseUrl}/?project=${encodeURIComponent(projectId)}&task=${encodeURIComponent(inspectionPointId)}`;
}

/** Genereer de QR-code afbeeldings-URL (api.qrserver.com). */
export function buildQRImageUrl(data: string, size = 140): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=4&ecc=M`;
}

/** Genereer en open het sticker-vel als nieuw venster (afdrukbaar). */
export function printQRStickerSheet(options: QRStickerSheetOptions): void {
  if (typeof window === 'undefined') return;
  const base = options.baseUrl ?? window.location.origin;
  const html = generateQRStickerHtml(options, base);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Auto-print na laden
  win.onload = () => win.print();
}

/** Genereer de HTML-string voor het sticker-vel. */
export function generateQRStickerHtml(options: QRStickerSheetOptions, base: string): string {
  const { projectId, projectName, tasks } = options;

  const stickerItems = tasks.map(task => {
    const url = buildTaskUrl(base, projectId, task.inspectionPointId);
    const qrUrl = buildQRImageUrl(url, 130);
    return `
      <div class="sticker">
        <div class="sticker-header">
          <span class="sticker-icon">${task.categoryIcon}</span>
          <span class="sticker-disc">${task.discipline}</span>
        </div>
        <img class="sticker-qr" src="${qrUrl}" alt="QR ${task.inspectionPointId}" loading="lazy" />
        <div class="sticker-label">${task.label}</div>
        <div class="sticker-id">${task.inspectionPointId}</div>
      </div>`;
  }).join('');

  const now = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>QR-stickers — ${projectName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #fff;
    padding: 12mm;
    color: #111;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #111;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .page-title { font-size: 18px; font-weight: 800; }
  .page-sub   { font-size: 11px; color: #666; margin-top: 2px; }
  .page-date  { font-size: 10px; color: #888; }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .sticker {
    border: 1.5px solid #ddd;
    border-radius: 8px;
    padding: 10px 8px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    page-break-inside: avoid;
    background: #fff;
  }
  .sticker-header {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    margin-bottom: 6px;
  }
  .sticker-icon  { font-size: 16px; }
  .sticker-disc  { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.8px; }
  .sticker-qr    { width: 100px; height: 100px; display: block; }
  .sticker-label { font-size: 9.5px; font-weight: 700; text-align: center; margin-top: 6px; line-height: 1.3; max-width: 120px; }
  .sticker-id    { font-size: 7.5px; color: #888; margin-top: 3px; font-family: monospace; }

  .footer {
    margin-top: 16px;
    border-top: 1px solid #eee;
    padding-top: 8px;
    font-size: 9px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }

  @media print {
    body { padding: 8mm; }
    .no-print { display: none !important; }
    @page { size: A4; margin: 8mm; }
  }
</style>
</head>
<body>

<div class="no-print" style="background:#f0f9ff;border:1px solid #3b82f6;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
  <span style="font-size:13px;color:#1d4ed8;font-weight:600">📄 QR-sticker vel klaar om af te drukken</span>
  <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🖨️ Afdrukken</button>
</div>

<div class="page-header">
  <div>
    <div class="page-title">📐 WKB Borgingspunt stickers — ${projectName}</div>
    <div class="page-sub">Scan de QR-code om direct naar het borgingspunt te navigeren in de WKB app</div>
  </div>
  <div class="page-date">Aangemaakt: ${now}</div>
</div>

<div class="grid">
  ${stickerItems}
</div>

<div class="footer">
  <span>${pdfBrandLabel()}</span>
  <span>Project: ${projectId} · ${tasks.length} borgingspunten</span>
</div>

</body>
</html>`;
}
