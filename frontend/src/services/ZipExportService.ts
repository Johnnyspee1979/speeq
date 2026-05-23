/**
 * ZipExportService — exporteert een volledig borgingsdossier als ZIP.
 *
 * Mappenstructuur in de ZIP:
 *   ProjectNaam_dossier_2025-05-02/
 *     ├── OVERZICHT.txt
 *     ├── kik-wapening-001/
 *     │   ├── 2025-05-02_14-32_foto_abc123.jpg
 *     │   └── 2025-05-02_14-32_notitie.txt
 *     ├── brandwering-002/
 *     │   └── ...
 *     └── ...
 */

import JSZip from 'jszip';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  id: string;
  inspection_point_id: string;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string;
  ai_status: string | null;
  ai_notes: string | null;
  field_note: string | null;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ZipExportProgress {
  phase: 'ophalen' | 'fotos-laden' | 'inpakken' | 'klaar' | 'fout';
  current: number;
  total: number;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converteert een timestamp naar een bestandsvriendelijke string */
function stampToFilename(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

/** Maakt een mapnaam veilig voor bestandssystemen */
function safeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

/** Download een URL als ArrayBuffer */
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** Geeft een leesbare status-tekst voor een ai_status waarde */
function statusLabel(status: string | null): string {
  switch (status) {
    case 'PASSED':       return '✅ Goedgekeurd';
    case 'FAILED':       return '❌ Afgekeurd';
    case 'NEEDS_REVIEW': return '⚠️ Review vereist';
    case 'PENDING':      return '⏳ In behandeling';
    default:             return '○ Onbekend';
  }
}

// ─── Hoofd-export functie ─────────────────────────────────────────────────────

/**
 * Haalt alle evidence op voor een project en maakt een ZIP.
 *
 * @param projectId      Supabase project UUID
 * @param projectName    Zichtbare naam voor de mappen in de ZIP
 * @param onProgress     Optionele callback voor voortgang
 */
export async function exportProjectAsZip(
  projectId: string,
  projectName: string,
  onProgress?: (p: ZipExportProgress) => void
): Promise<void> {

  const report = (phase: ZipExportProgress['phase'], current: number, total: number, message: string) => {
    onProgress?.({ phase, current, total, message });
  };

  // ── 1. Evidence ophalen ────────────────────────────────────────────────────
  report('ophalen', 0, 0, 'Evidence ophalen uit database…');

  const { data: rows, error } = await supabase
    .from('evidence')
    .select('id, inspection_point_id, media_uri, photo_uri, timestamp, ai_status, ai_notes, field_note, user_id, latitude, longitude')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: true });

  if (error) {
    report('fout', 0, 0, `Database fout: ${error.message}`);
    throw error;
  }

  const evidence: EvidenceRow[] = rows ?? [];
  const total = evidence.length;

  if (total === 0) {
    report('fout', 0, 0, 'Geen bewijsmateriaal gevonden voor dit project.');
    throw new Error('Geen evidence gevonden');
  }

  report('fotos-laden', 0, total, `${total} bestanden downloaden…`);

  // ── 2. ZIP opbouwen ────────────────────────────────────────────────────────
  const zip = new JSZip();
  const rootFolder = safeName(projectName);
  const root = zip.folder(rootFolder)!;

  // Groepeer op borgingspunt
  const byPoint = new Map<string, EvidenceRow[]>();
  for (const row of evidence) {
    const key = row.inspection_point_id ?? 'onbekend';
    if (!byPoint.has(key)) byPoint.set(key, []);
    byPoint.get(key)!.push(row);
  }

  // OVERZICHT.txt
  const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let overzicht = `BORGINGSDOSSIER OVERZICHT\n`;
  overzicht += `Project  : ${projectName}\n`;
  overzicht += `Gegenereerd: ${today}\n`;
  overzicht += `Totaal foto's: ${total}\n\n`;
  overzicht += `${'─'.repeat(50)}\n\n`;

  for (const [pointId, items] of byPoint.entries()) {
    const passed  = items.filter(i => i.ai_status === 'PASSED').length;
    const failed  = items.filter(i => i.ai_status === 'FAILED').length;
    const review  = items.filter(i => i.ai_status === 'NEEDS_REVIEW').length;
    overzicht += `${pointId}\n`;
    overzicht += `  Foto's   : ${items.length}\n`;
    overzicht += `  ✅ OK    : ${passed}\n`;
    if (failed  > 0) overzicht += `  ❌ Afgekeurd: ${failed}\n`;
    if (review  > 0) overzicht += `  ⚠️ Review  : ${review}\n`;
    overzicht += `\n`;
  }

  root.file('OVERZICHT.txt', overzicht);

  // ── 3. Per borgingspunt — fotos + notities ─────────────────────────────────
  let done = 0;

  for (const [pointId, items] of byPoint.entries()) {
    const folder = root.folder(safeName(pointId))!;

    for (const item of items) {
      const stamp    = stampToFilename(item.timestamp);
      const shortId  = item.id.slice(0, 8);
      const photoUrl = item.media_uri ?? item.photo_uri ?? null;

      // Foto downloaden
      if (photoUrl) {
        const buf = await fetchAsArrayBuffer(photoUrl);
        if (buf) {
          folder.file(`${stamp}_foto_${shortId}.jpg`, buf);
        }
      }

      // Notitie-bestand als er content is
      const hasContent =
        item.field_note ||
        item.ai_notes ||
        item.ai_status ||
        item.latitude;

      if (hasContent) {
        let note = `Borgingspunt : ${pointId}\n`;
        note += `Tijdstip     : ${new Date(item.timestamp).toLocaleString('nl-NL')}\n`;
        note += `Status       : ${statusLabel(item.ai_status)}\n`;
        if (item.field_note)  note += `\nNotitie vakman:\n${item.field_note}\n`;
        if (item.ai_notes)    note += `\nAI beoordeling:\n${item.ai_notes}\n`;
        if (item.latitude && item.longitude) {
          note += `\nGPS locatie: ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}\n`;
          note += `Maps: https://maps.google.com/?q=${item.latitude},${item.longitude}\n`;
        }
        folder.file(`${stamp}_notitie_${shortId}.txt`, note);
      }

      done++;
      report('fotos-laden', done, total, `Foto ${done} van ${total} verwerkt…`);
    }
  }

  // ── 4. ZIP genereren en downloaden ────────────────────────────────────────
  report('inpakken', total, total, 'ZIP inpakken…');

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Browser-download triggeren
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${safeName(projectName)}_dossier_${dateStr}.zip`;

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  report('klaar', total, total, `✅ ${fileName} gedownload (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
}
