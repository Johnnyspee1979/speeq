/**
 * BonScannerService — OCR + opslag van bonnen, leveringsbrieven, certificaten.
 *
 * Flow:
 *   foto (File)
 *     → Tesseract.js OCR (Nederlands + Engels)
 *     → type-detector (kop-woorden)
 *     → veld-extractor (leverancier, datum, bedrag)
 *     → upload foto naar Supabase Storage
 *     → insert rij in project_documents tabel
 */

import { supabase } from '../lib/supabase';
import { resolveStorageUrl } from '../lib/storageUrl';

// Bonnen gaan normaal naar 'project-documents'. Valt die upload weg, dan een
// fallback naar 'floor-plans'. Omdat de DB geen bucket-kolom heeft, prefixen we
// een fallback-referentie zodat het tekenen bij het ophalen de juiste bucket kiest.
const FALLBACK_BUCKET = 'floor-plans';
const FALLBACK_PREFIX = 'floor-plans:';

/** Teken een opgeslagen photo_url-referentie tot een toonbare URL. */
async function resolveDocumentUrl(stored: string): Promise<string> {
  if (stored.startsWith(FALLBACK_PREFIX)) {
    const path = stored.slice(FALLBACK_PREFIX.length);
    return (await resolveStorageUrl(FALLBACK_BUCKET, path)) ?? path;
  }
  return (await resolveStorageUrl(STORAGE_BUCKET, stored)) ?? stored;
}

export type DocType =
  | 'BON'
  | 'LEVERINGSBON'
  | 'CERTIFICAAT'
  | 'FACTUUR'
  | 'WERKBON'
  | 'OVERIG';

export interface ProjectDocument {
  id: string;
  projectId: string;
  docType: DocType;
  title: string | null;
  photoUrl: string;
  ocrText: string | null;
  ocrConfidence: number | null;
  detectedFields: Record<string, string> | null;
  createdAt: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  docType: DocType;
  detectedFields: Record<string, string>;
}

// ──────────────────────────────────────────────────────────────────────────
// Type-detectie op basis van trefwoorden (NL + EN)
// ──────────────────────────────────────────────────────────────────────────

const TYPE_KEYWORDS: Record<DocType, string[]> = {
  LEVERINGSBON: ['leveringsbon', 'pakbon', 'afleverbon', 'delivery note', 'levering'],
  CERTIFICAAT: ['certificaat', 'certificate', 'keurmerk', 'iso', 'attest', 'kiwa', 'komo'],
  FACTUUR: ['factuur', 'invoice', 'btw', 'totaal incl', 'rekening', 'iban'],
  WERKBON: ['werkbon', 'werkorder', 'urenbon', 'manhours', 'arbeidsbon'],
  BON: ['kassabon', 'bon ', 'receipt', 'kassa'],
  OVERIG: [],
};

export function detectDocType(text: string): DocType {
  const lower = text.toLowerCase();
  let best: DocType = 'OVERIG';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [DocType, string[]][]) {
    const score = keywords.reduce((acc, k) => (lower.includes(k) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }
  // Fallback: als 'er staat €' of 'btw' → factuur, anders bon
  if (best === 'OVERIG') {
    if (/€\s?\d|btw|incl\.|excl\./i.test(text)) return 'BON';
  }
  return best;
}

// ──────────────────────────────────────────────────────────────────────────
// Veld-extractie: leverancier (eerste regel meestal), datum, bedrag
// ──────────────────────────────────────────────────────────────────────────

export function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Leverancier = eerste niet-lege regel (vaak bedrijfsnaam in kop)
  if (lines[0] && lines[0].length < 60) {
    fields.leverancier = lines[0];
  }

  // Datum: dd-mm-yyyy of dd/mm/yyyy of dd-mm-yy
  const dateMatch = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
  if (dateMatch) fields.datum = dateMatch[1];

  // Bedrag: € 1.234,56 of €1234.56
  const amountMatch = text.match(/€\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
  if (amountMatch) fields.bedrag = `€ ${amountMatch[1]}`;

  // Factuurnummer / bonnummer
  const numMatch = text.match(/(?:factuurnr|bonnr|factuur(?:\s?nummer)?|nr\.?)\s*[:#]?\s*([A-Z0-9-]{3,20})/i);
  if (numMatch) fields.nummer = numMatch[1];

  return fields;
}

// ──────────────────────────────────────────────────────────────────────────
// Image preprocessing — grijswaarden + contrast voor betere OCR
// ──────────────────────────────────────────────────────────────────────────

/**
 * Preprocess image voor OCR:
 *   1. Resize naar max 1600px (sneller, niet te veel detail-verlies)
 *   2. Grijswaarden conversie
 *   3. Contrast boost (helpt vooral bij thermische bonnen)
 * Geeft een Blob terug die direct in Tesseract gevoerd kan worden.
 */
async function preprocessForOcr(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_DIM = 1600;
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file as Blob);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // Pixel-by-pixel: grijswaarden + contrast boost
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const contrast = 1.4; // 40% meer contrast
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < data.length; i += 4) {
          // luminance (Rec. 709)
          const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          // contrast
          const adjusted = Math.max(0, Math.min(255, contrast * gray + intercept));
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file as Blob);
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file as Blob); // fallback: gebruik origineel
      };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────
// OCR via Google Cloud Vision (primair) + Tesseract.js (fallback)
// ──────────────────────────────────────────────────────────────────────────

/** Blob → base64 (zonder data:image/... prefix) — gebruikt FileReader (native, snel). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** OCR via GPT-4o Vision edge function (krachtigste optie). Throws bij fout. */
async function runOcrViaCloudVision(file: File | Blob): Promise<OcrResult> {
  // Preprocessing: kleiner formaat → snellere call, lagere kosten
  let processed: Blob;
  try {
    processed = await preprocessForOcr(file);
  } catch {
    processed = file as Blob;
  }
  const imageBase64 = await blobToBase64(processed);

  // Hard timeout van 20s zodat de UI nooit oneindig blijft hangen
  // (b.v. wanneer OPENAI_API_KEY ontbreekt of GPT-4o traag is).
  const visionCall = supabase.functions.invoke('ocr-vision', {
    body: { imageBase64 },
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Vision timeout na 12s')), 12000),
  );
  const { data, error } = (await Promise.race([visionCall, timeoutPromise])) as {
    data: unknown;
    error: { message?: string } | null;
  };

  if (error) throw new Error(error.message ?? 'Vision call failed');
  if (!data || typeof data !== 'object') throw new Error('Vision response leeg');

  const visionData = data as {
    text?: string;
    confidence?: number;
    fields?: Record<string, string>;
  };
  const text = visionData.text ?? '';
  const confidence = visionData.confidence ?? 0.95;

  // GPT-4o geeft direct gestructureerde velden terug — die hebben voorrang.
  // Fallback: lokale regex-extractor als fields leeg zijn.
  const visionFields = visionData.fields ?? {};
  const localFields = extractFields(text);
  const detectedFields: Record<string, string> = { ...localFields, ...visionFields };

  // docType uit GPT-4o als die het terugstuurt, anders detecteren
  const gptType = (visionFields.type ?? '').toUpperCase();
  const validTypes: DocType[] = ['BON', 'LEVERINGSBON', 'CERTIFICAAT', 'FACTUUR', 'WERKBON', 'OVERIG'];
  const docType = (validTypes.includes(gptType as DocType) ? gptType : detectDocType(text)) as DocType;

  // 'type' niet als veld tonen — dat is intern
  delete detectedFields.type;

  return { text: text.trim(), confidence, docType, detectedFields };
}

/** OCR via Tesseract.js — offline fallback. */
async function runOcrViaTesseract(file: File | Blob): Promise<OcrResult> {
  const Tesseract = await import('tesseract.js');

  let processed: File | Blob = file;
  try {
    processed = await preprocessForOcr(file);
  } catch {
    processed = file;
  }

  const result = await Tesseract.recognize(processed, 'nld+eng', {});

  const text = (result.data?.text ?? '').trim();
  const confidence = (result.data?.confidence ?? 0) / 100;
  const docType = detectDocType(text);
  const detectedFields = extractFields(text);

  return { text, confidence, docType, detectedFields };
}

/**
 * Hoofd-OCR-functie: probeert GPT-4o Vision (veel accurater op bonnen + slimme
 * veld-extractie), valt automatisch terug op Tesseract bij netwerk-/key-/
 * quota-fout zodat de app blijft werken.
 */
export async function runOcr(file: File | Blob): Promise<OcrResult> {
  try {
    const visionResult = await runOcrViaCloudVision(file);
    if (visionResult.text && visionResult.text.length >= 3) {
      return visionResult;
    }
    console.warn('[BonScanner] Vision gaf lege tekst — geen tekst opgeslagen');
  } catch (err) {
    console.warn('[BonScanner] Vision faalde — geen tekst opgeslagen:', err);
  }
  // Geen Tesseract-fallback meer: was 11MB download + minuten op mobiel.
  // Foto blijft hoofdbron, OCR is bonus.
  return { text: '', confidence: 0, docType: 'OVERIG', detectedFields: {} };
}

// ──────────────────────────────────────────────────────────────────────────
// Upload + insert
// ──────────────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'project-documents';

export async function saveScannedDocument(args: {
  projectId: string;
  file: File | Blob;
  fileName?: string;
  title?: string | null;
  ocr: OcrResult;
}): Promise<ProjectDocument | null> {
  try {
    const fileName = args.fileName ?? `bon_${Date.now()}.jpg`;
    const path = `${args.projectId}/${Date.now()}_${fileName}`;

    // Upload foto naar Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, args.file, {
        upsert: false,
        contentType: (args.file as File).type || 'image/jpeg',
      });

    if (uploadError) {
      // Fallback bucket: floor-plans (bestaat zeker)
      const fallbackPath = `documents/${args.projectId}/${Date.now()}_${fileName}`;
      const { error: fallbackError } = await supabase.storage
        .from('floor-plans')
        .upload(fallbackPath, args.file, {
          upsert: false,
          contentType: (args.file as File).type || 'image/jpeg',
        });
      if (fallbackError) {
        console.error('BonScannerService: beide buckets faalden', uploadError, fallbackError);
        return null;
      }
      // Bewaar een gemarkeerd fallback-PAD; resolveDocumentUrl tekent het later.
      return await insertRow(args, `${FALLBACK_PREFIX}${fallbackPath}`);
    }

    // Bewaar het PAD (niet een publieke URL). Bij het ophalen tekent
    // resolveDocumentUrl het tot een kortlevende signed URL.
    return await insertRow(args, path);
  } catch (err) {
    console.error('BonScannerService: unexpected error', err);
    return null;
  }
}

async function insertRow(
  args: { projectId: string; title?: string | null; ocr: OcrResult },
  photoUrl: string
): Promise<ProjectDocument | null> {
  const { data: row, error } = await supabase
    .from('project_documents')
    .insert({
      project_id: args.projectId,
      doc_type: args.ocr.docType,
      title:
        args.title ??
        args.ocr.detectedFields.leverancier ??
        args.ocr.detectedFields.nummer ??
        null,
      photo_url: photoUrl,
      ocr_text: args.ocr.text || null,
      ocr_confidence: args.ocr.confidence,
      detected_fields: args.ocr.detectedFields,
    })
    .select()
    .single();

  if (error || !row) {
    console.error('BonScannerService: insert error', error);
    return null;
  }

  return rowToDoc(row);
}

async function rowToDoc(row: Record<string, unknown>): Promise<ProjectDocument> {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    docType: (row.doc_type as DocType) ?? 'OVERIG',
    title: (row.title as string) ?? null,
    photoUrl: await resolveDocumentUrl(String(row.photo_url)),
    ocrText: (row.ocr_text as string) ?? null,
    ocrConfidence: (row.ocr_confidence as number) ?? null,
    detectedFields: (row.detected_fields as Record<string, string>) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getDocumentsForProject(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return Promise.all(data.map(rowToDoc));
}

export async function deleteDocument(id: string): Promise<void> {
  await supabase.from('project_documents').delete().eq('id', id);
}

// ──────────────────────────────────────────────────────────────────────────
// PDF-export (HTML → window.print) — zelfde patroon als BorgingsDossier
// ──────────────────────────────────────────────────────────────────────────

export function openDocumentAsPrintablePdf(doc: ProjectDocument): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Kon nieuw venster niet openen. Sta pop-ups toe.');
    return;
  }
  const fieldsHtml = doc.detectedFields
    ? Object.entries(doc.detectedFields)
        .map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`)
        .join('')
    : '';
  const ocr = escapeHtml(doc.ocrText ?? '');
  const confidence = doc.ocrConfidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  // Lage zekerheid? Verberg de OCR-tekst standaard achter een knop.
  const lowConfidence = confidence < 0.55;
  const ocrSectionHtml = !ocr
    ? ''
    : lowConfidence
    ? `
      <div class="ocr-warn">
        ⚠️ OCR-zekerheid is laag (${confidencePct}%). De automatisch gelezen tekst kan
        onleesbaar zijn — gebruik vooral de foto hierboven.
        <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">Toon ruwe OCR-tekst</summary>
          <pre>${ocr}</pre>
        </details>
      </div>`
    : `
      <h3>OCR-tekst <span style="font-weight:400;color:#666;font-size:13px">(zekerheid ${confidencePct}%)</span></h3>
      <pre>${ocr}</pre>`;

  w.document.write(`<!doctype html>
<html lang="nl"><head><meta charset="utf-8"/>
<title>${escapeHtml(doc.docType)} — ${escapeHtml(doc.title ?? '')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; max-width: 900px; margin: 0 auto; color: #111; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  .photo-wrap { background: #f7f7f8; border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin-bottom: 18px; text-align: center; }
  .photo { width: 100%; max-width: 850px; height: auto; border-radius: 8px; display: block; margin: 0 auto; }
  .photo-caption { color: #555; font-size: 13px; margin-top: 10px; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  td:first-child { width: 30%; color: #555; }
  pre { background: #f7f7f8; border: 1px solid #ddd; border-radius: 8px; padding: 12px; white-space: pre-wrap; word-wrap: break-word; font-size: 12px; line-height: 1.5; color: #444; }
  .ocr-warn { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px; color: #78350f; font-size: 14px; line-height: 1.5; }
  .ocr-warn pre { background: #fff; margin-top: 8px; }
  .btn { background: #16a34a; color: white; padding: 12px 22px; border: 0; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 700; }
  .btn-row { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  .btn.secondary { background: #fff; color: #111; border: 1px solid #ddd; }
  @media print { .btn, .btn-row { display: none; } body { padding: 0; max-width: 100%; } .photo-wrap { background: transparent; padding: 0; border: 0; } .photo { max-width: 100%; } }
</style></head>
<body>
  <h1>${escapeHtml(doc.docType)}${doc.title ? ` — ${escapeHtml(doc.title)}` : ''}</h1>
  <div class="meta">Project ${escapeHtml(doc.projectId)} · ${new Date(doc.createdAt).toLocaleString('nl-NL')}</div>

  <div class="photo-wrap">
    <img src="${escapeHtml(doc.photoUrl)}" alt="Document foto" class="photo"/>
    <div class="photo-caption">📷 Originele foto van de bon — gebruik dit als hoofdbron voor controle</div>
  </div>

  ${fieldsHtml ? `<h3>Automatisch herkend</h3><table>${fieldsHtml}</table>` : ''}
  ${ocrSectionHtml}

  <div class="btn-row">
    <button class="btn" onclick="window.print()">📄 PDF opslaan / Afdrukken</button>
    <button class="btn secondary" onclick="window.open('${escapeHtml(doc.photoUrl)}', '_blank')">🔍 Foto in nieuw tabblad</button>
  </div>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
