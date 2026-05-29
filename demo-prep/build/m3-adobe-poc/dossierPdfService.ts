/**
 * Dossier PDF Service
 *
 * Genereert een WKB-bouwdossier-PDF voor een gegeven dossier_id.
 * Twee paden:
 *   - 'local'  : HTML → PDF via headless Chrome / puppeteer (geen externe API)
 *   - 'adobe'  : Word template → PDF via Adobe PDF Services Document Generation
 *
 * De service slaat het resultaat op in Supabase Storage en update `dossiers.pdf_url`.
 *
 * Gebruik:
 *   import { generateDossierPdf } from './dossierPdfService';
 *   const pdfUrl = await generateDossierPdf(dossierId, { renderer: 'adobe' });
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Optionele imports — we laden ze alleen als nodig
let puppeteer: any;
let handlebars: any;
let pdfServicesSdk: any;

// ---------------------------------------------------------------------------
// Configuratie
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const PDF_SERVICES_CLIENT_ID = process.env.PDF_SERVICES_CLIENT_ID ?? '';
const PDF_SERVICES_CLIENT_SECRET = process.env.PDF_SERVICES_CLIENT_SECRET ?? '';

const TEMPLATE_HTML_PATH = path.resolve(__dirname, '../../demo-prep/build/m2-template/WKB-Dossier-template.html');
const TEMPLATE_DOCX_PATH = path.resolve(__dirname, '../../demo-prep/build/m2-template/WKB-Dossier.docx');

const BUCKET = 'wkb-evidence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RendererType = 'local' | 'adobe' | 'auto';

export interface GenerateOptions {
  renderer?: RendererType;          // 'auto' kiest adobe als credentials aanwezig, anders local
  dryRun?: boolean;                  // genereer maar upload niet
  outputDir?: string;                // lokale output-map voor dry-runs
}

interface EvidenceRow {
  id: number;
  inspection_point_id: string;
  photo_uri: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  exif_verified: boolean;
  exif_hash: string;
  field_note: string;
  ai_status: string;
  ai_confidence: number;
  ai_notes: string;
  review_status: string;
  reviewed_at: string | null;
  discipline_id: string;
  etage: string;
  ruimtenummer: string;
  binnenbuiten: string;
  pin_x: number | null;
  pin_y: number | null;
}

// ---------------------------------------------------------------------------
// Hoofd-functie
// ---------------------------------------------------------------------------

export async function generateDossierPdf(
  dossierId: string,
  options: GenerateOptions = {}
): Promise<string> {
  const renderer = pickRenderer(options.renderer ?? 'auto');
  console.log(`[dossier:${dossierId}] Renderer: ${renderer}`);

  // 1. Data ophalen
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const payload = await buildPayload(supabase, dossierId);
  console.log(`[dossier:${dossierId}] Payload: ${payload.evidence.length} evidence rows`);

  // 2. PDF genereren
  let pdfBuffer: Buffer;
  if (renderer === 'adobe') {
    pdfBuffer = await renderViaAdobe(payload);
  } else {
    pdfBuffer = await renderViaPuppeteer(payload);
  }
  console.log(`[dossier:${dossierId}] PDF gegenereerd: ${pdfBuffer.length} bytes`);

  // 3. Dry-run: schrijf naar disk en stop
  if (options.dryRun) {
    const outDir = options.outputDir ?? '/tmp';
    const outPath = path.join(outDir, `dossier-${dossierId}.pdf`);
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`[dossier:${dossierId}] DRY RUN — opgeslagen op ${outPath}`);
    return `file://${outPath}`;
  }

  // 4. Upload naar Supabase Storage
  const objectPath = `dossiers/${payload.tenant.id}/${dossierId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload faalde: ${uploadError.message}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  console.log(`[dossier:${dossierId}] Uploaded: ${publicUrl}`);

  // 5. Update dossiers.pdf_url
  const { error: updateError } = await supabase
    .from('dossiers')
    .update({
      pdf_url: publicUrl,
      status: 'pending_signature',
      updated_at: new Date().toISOString(),
    })
    .eq('id', dossierId);

  if (updateError) {
    throw new Error(`Dossier update faalde: ${updateError.message}`);
  }

  return publicUrl;
}

// ---------------------------------------------------------------------------
// Renderer-keuze
// ---------------------------------------------------------------------------

function pickRenderer(requested: RendererType): 'local' | 'adobe' {
  if (requested === 'local') return 'local';
  if (requested === 'adobe') {
    if (!PDF_SERVICES_CLIENT_ID || !PDF_SERVICES_CLIENT_SECRET) {
      console.warn('Adobe credentials ontbreken, fallback naar local renderer');
      return 'local';
    }
    return 'adobe';
  }
  // auto
  return (PDF_SERVICES_CLIENT_ID && PDF_SERVICES_CLIENT_SECRET) ? 'adobe' : 'local';
}

// ---------------------------------------------------------------------------
// Payload-bouwer: haalt alle data uit Supabase
// ---------------------------------------------------------------------------

async function buildPayload(supabase: SupabaseClient, dossierId: string): Promise<any> {
  // Dossier + project
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('*, project:project_id(*)')
    .eq('id', dossierId)
    .single();

  if (dossierErr || !dossier) {
    throw new Error(`Dossier ${dossierId} niet gevonden: ${dossierErr?.message}`);
  }

  // Tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('company_id', dossier.tenant_id)
    .single();

  // Evidence (approved + finalized)
  const { data: evidence } = await supabase
    .from('evidence')
    .select('*')
    .eq('project_id', dossier.project_id)
    .in('review_status', ['APPROVED', 'FINALIZED'])
    .order('discipline_id', { ascending: true })
    .order('timestamp', { ascending: true });

  // Floor plan
  const { data: floorPlan } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('project_id', dossier.project_id)
    .limit(1)
    .maybeSingle();

  // Hash van de evidence-set (voor verzegeling)
  const evidenceIds = (evidence ?? []).map(e => e.id).sort().join(',');
  const hash = crypto.createHash('sha256').update(evidenceIds + dossierId).digest('hex');

  return {
    dossier: {
      id: dossierId,
      hash,
    },
    tenant: {
      id: tenant?.company_id,
      name: tenant?.name,
      logo_url: tenant?.logo_url,
      primary_color: tenant?.primary_color,
      pdf_footer_text: tenant?.pdf_footer_text ?? '',
    },
    project: dossier.project,
    kwaliteitsborger: {
      name: 'TBD — uit profiles op project.kwaliteitsborger_id',
    },
    evidence: (evidence ?? []).map(formatEvidenceForTemplate),
    floor_plan: floorPlan,
    signature: {
      pl_name: dossier.signed_by_pl ?? 'Nog niet ondertekend',
      pl_role: 'Projectleider',
      og_name: dossier.signed_by_og ?? 'Nog niet ondertekend',
      og_role: 'Opdrachtgever',
    },
    signed: {
      pl_at: dossier.signed_at ?? '—',
      og_at: dossier.signed_at ?? '—',
    },
    generation: {
      timestamp: new Date().toLocaleString('nl-NL'),
    },
  };
}

function formatEvidenceForTemplate(e: EvidenceRow): any {
  return {
    ...e,
    title_or_discipline: e.discipline_id ?? e.inspection_point_id,
    ai_status_lower: (e.ai_status ?? '').toLowerCase().replace('_', '-'),
    ai_confidence_pct: Math.round((e.ai_confidence ?? 0) * 100),
    exif_hash_short: (e.exif_hash ?? '').slice(0, 12),
    reviewer_name: 'Projectleider', // TBD: join op profiles
  };
}

// ---------------------------------------------------------------------------
// Renderer Pad A: HTML → PDF via Puppeteer (geen Adobe)
// ---------------------------------------------------------------------------

async function renderViaPuppeteer(payload: any): Promise<Buffer> {
  if (!puppeteer) {
    try { puppeteer = require('puppeteer'); }
    catch {
      throw new Error("'puppeteer' niet geïnstalleerd. Run: npm install puppeteer handlebars");
    }
  }
  if (!handlebars) {
    try { handlebars = require('handlebars'); }
    catch {
      throw new Error("'handlebars' niet geïnstalleerd. Run: npm install handlebars");
    }
  }

  // Template laden en compileren
  const templateSrc = fs.readFileSync(TEMPLATE_HTML_PATH, 'utf-8');
  const template = handlebars.compile(templateSrc);
  const html = template(payload);

  // PDF renderen
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
      printBackground: true,
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Renderer Pad B: Word template → PDF via Adobe PDF Services
// ---------------------------------------------------------------------------

async function renderViaAdobe(payload: any): Promise<Buffer> {
  if (!pdfServicesSdk) {
    try { pdfServicesSdk = require('@adobe/pdfservices-node-sdk'); }
    catch {
      throw new Error("'@adobe/pdfservices-node-sdk' niet geïnstalleerd. Run: npm install @adobe/pdfservices-node-sdk");
    }
  }

  const {
    ServicePrincipalCredentials,
    PDFServices,
    MimeType,
    OutputFormat,
    DocumentMergeJob,
    DocumentMergeParams,
  } = pdfServicesSdk;

  // Credentials
  const credentials = new ServicePrincipalCredentials({
    clientId: PDF_SERVICES_CLIENT_ID,
    clientSecret: PDF_SERVICES_CLIENT_SECRET,
  });
  const pdfServices = new PDFServices({ credentials });

  // Upload Word-template
  if (!fs.existsSync(TEMPLATE_DOCX_PATH)) {
    throw new Error(
      `Word template niet gevonden: ${TEMPLATE_DOCX_PATH}\n` +
      `Maak deze op basis van demo-prep/build/m2-template/WKB-Dossier-template.html`
    );
  }
  const templateStream = fs.createReadStream(TEMPLATE_DOCX_PATH);
  const templateAsset = await pdfServices.upload({
    readStream: templateStream,
    mimeType: MimeType.DOCX,
  });

  // Merge-job
  const params = new DocumentMergeParams({
    jsonDataForMerge: payload,
    outputFormat: OutputFormat.PDF,
  });
  const job = new DocumentMergeJob({ inputAsset: templateAsset, params });
  const pollingURL = await pdfServices.submit({ job });
  const result = await pdfServices.getJobResult({
    pollingURL,
    resultType: pdfServicesSdk.DocumentMergeResult,
  });

  // Resultaat downloaden
  const resultAsset = result.result.asset;
  const streamAsset = await pdfServices.getContent({ asset: resultAsset });

  return await streamToBuffer(streamAsset.readStream);
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
