/**
 * ExportService — exporteer bewijs data als CSV of JSON
 * voor gebruik in Excel, rapportagetools of klant-portalen.
 *
 * CSV download via Blob URL (web-only).
 */

export interface ExportEvidenceRow {
  id: string;
  projectId: string | null;
  inspectionPointId: string | null;
  timestamp: string | null;
  aiStatus: string | null;
  aiNotes: string | null;
  fieldNote: string | null;
  userId: string | null;
  latitude: number | null;
  longitude: number | null;
  mediaUri: string | null;
  etage?: string | null;
  ruimtenummer?: string | null;
  binnenbuiten?: string | null;
  locatieDetail?: string | null;
  floorPlanId?: string | null;
  pinX?: number | null;
  pinY?: number | null;
}

/** Escape een CSV-veld (quotes, komma's). */
function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Genereer CSV-string voor evidence. */
export function evidenceToCsv(rows: ExportEvidenceRow[]): string {
  const headers = [
    'ID', 'Project', 'Borgingspunt', 'Tijdstip', 'Status', 'AI Notities',
    'Veldnotitie', 'Gebruiker', 'Latitude', 'Longitude',
    'Etage', 'Ruimtenummer', 'Binnen/Buiten', 'Locatie Detail',
    'Tekening ID', 'Pin X', 'Pin Y', 'Foto URL',
  ];

  const headerLine = headers.join(',');
  const dataLines = rows.map(r => [
    r.id,
    r.projectId,
    r.inspectionPointId,
    r.timestamp,
    r.aiStatus,
    r.aiNotes,
    r.fieldNote,
    r.userId,
    r.latitude,
    r.longitude,
    r.etage ?? '',
    r.ruimtenummer ?? '',
    r.binnenbuiten ?? '',
    r.locatieDetail ?? '',
    r.floorPlanId ?? '',
    r.pinX ?? '',
    r.pinY ?? '',
    r.mediaUri,
  ].map(escapeCsv).join(','));

  return [headerLine, ...dataLines].join('\n');
}

/** Download een CSV-string als bestand in de browser. */
export function downloadCsv(content: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const bom = '\uFEFF'; // UTF-8 BOM voor Excel compatibiliteit
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download evidence als JSON-bestand. */
export function downloadJson(data: unknown, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Genereer een bestandsnaam voor de export. */
export function makeExportFilename(projectId: string, ext: 'csv' | 'json'): string {
  const d = new Date().toISOString().slice(0, 10);
  return `wkb-bewijs_${projectId}_${d}.${ext}`;
}
