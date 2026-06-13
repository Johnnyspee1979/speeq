/**
 * dossierService — Adobe-dossiermotor.
 *
 * Genereert een professioneel PDF-dossier voor een Wkb-project uit een getagd
 * Word-sjabloon (Adobe Document Generation Tagger) + Supabase-data/foto's via de
 * Adobe Document Generation API.
 *
 * Flow van buildDossier(projectId):
 *   1. haal project + GOEDGEKEURDE evidence uit Supabase (echt schema: Engels)
 *   2. download elke foto, geschaald (max 1600px, q80) → base64 data-URI
 *      (originelen in bucket `wkb-evidence` blijven onaangeroerd)
 *   3. bouw JSON volgens docs/dossier-sjabloon.md
 *   4. Adobe Document Generation API: sjabloon + JSON → PDF
 *   5. upload PDF → bucket `dossiers` op pad `project_id/dossier-<ts>.pdf`
 *   6. schrijf nieuwste URL terug → projects.dossier_url
 *
 * Veilig bij storing: faalt Adobe (tijdelijk), dan logt de motor netjes en laat
 * het oude dossier staan — nooit een half PDF wegschrijven, nooit data wissen.
 *
 * Voegt alleen toe; raakt de bestaande pdfmake-generator
 * (generateBevoegdGezagDossier) niet aan.
 */

import type { Readable } from 'stream';

const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig, hasAdobeConfig } = require('../config');

const EVIDENCE_BUCKET = 'wkb-evidence';
const APPROVED_STATUSES = ['APPROVED', 'PASSED'];

type EvidenceRow = {
  id?: number | string | null;
  evidence_id?: string | null;
  field_note?: string | null;
  timestamp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  ai_status?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
};

type ProjectRow = {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  initiator_name?: string | null;
  aannemer_name?: string | null;
};

type BuildDossierResult =
  | { ok: true; url: string; path: string; evidenceCount: number }
  | { ok: false; reason: string; skipped?: boolean };

let supabaseClient: any | null = null;

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt in .env');
  }
  if (!supabaseClient) {
    supabaseClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }
  return supabaseClient;
};

// ── NL-notatie helpers ──────────────────────────────────────────────────────

const formatDateTimeNL = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLocation = (item: EvidenceRow): string => {
  if (item.latitude == null || item.longitude == null) return 'Geen GPS-locatie';
  const acc = item.gps_accuracy != null ? ` (±${Math.round(Number(item.gps_accuracy))} m)` : '';
  return `${item.latitude}, ${item.longitude}${acc}`;
};

// ── Foto downloaden + schalen → base64 data-URI ─────────────────────────────

/**
 * Maakt van een publieke object-URL een render-/transform-URL die de foto
 * server-side schaalt (max 1600px breed, kwaliteit 80). Werkt voor publieke
 * Supabase-buckets. Bij twijfel valt fetchPhotoBase64 terug op het origineel.
 */
const toTransformUrl = (publicUrl: string): string => {
  if (!publicUrl.includes('/storage/v1/object/public/')) return publicUrl;
  const rendered = publicUrl.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );
  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}width=1600&quality=80&resize=contain`;
};

/**
 * Opgeslagen foto-verwijzing → bruikbare URL voor download.
 *
 * Sinds de storage-hardening bewaart de app het opslag-PAD (bv.
 * `project/evidence.jpg`) en staat de `wkb-evidence`-bucket privé. Een kaal pad
 * is niet rechtstreeks op te halen; we tekenen het hier met service_role tot een
 * kortlevende signed URL (signen mag op een privé-bucket). Al-volledige of
 * externe verwijzingen (http/https/data/blob/file) gaan ongemoeid door.
 */
const PHOTO_SIGN_TTL_SECONDS = 600;

const resolveEvidencePhotoUrl = async (
  supabase: any,
  storedUri?: string | null
): Promise<string | null> => {
  const uri = String(storedUri ?? '').trim();
  if (!uri) return null;
  if (/^(https?:|data:|blob:|file:|local:)/i.test(uri)) return uri;
  try {
    const { data } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(uri, PHOTO_SIGN_TTL_SECONDS);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
};

const fetchAsBase64 = async (
  url: string
): Promise<{ base64: string; contentType: string } | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, contentType };
};

/**
 * Haalt de foto op als data-URI. Probeert eerst de geschaalde render-URL; lukt
 * dat niet, dan het origineel. Faalt alles, dan null — het bewijs-blok blijft
 * dan staan zonder foto (de motor crasht hier nooit op).
 */
const fetchPhotoBase64 = async (mediaUri?: string | null): Promise<string | null> => {
  const uri = String(mediaUri ?? '').trim();
  if (!uri) return null;

  try {
    const scaled = await fetchAsBase64(toTransformUrl(uri));
    if (scaled) return `data:${scaled.contentType};base64,${scaled.base64}`;
  } catch {
    // val terug op origineel
  }

  try {
    const original = await fetchAsBase64(uri);
    if (original) return `data:${original.contentType};base64,${original.base64}`;
  } catch {
    // niets meer te proberen
  }

  return null;
};

// ── Template-data bouwen (sleutels = docs/dossier-sjabloon.md) ───────────────

const buildTemplateData = async (
  supabase: any,
  project: ProjectRow | null,
  evidence: EvidenceRow[]
) => {
  const evidenceBlocks = [];
  for (const item of evidence) {
    const photoUrl = await resolveEvidencePhotoUrl(supabase, item.photo_uri ?? item.media_uri);
    const foto = await fetchPhotoBase64(photoUrl);
    evidenceBlocks.push({
      omschrijving: item.field_note ?? '',
      timestamp: formatDateTimeNL(item.timestamp),
      locatie: formatLocation(item),
      status: item.ai_status ?? '',
      // Adobe image-tag verwacht een data-URI; leeg laten als download faalde.
      foto: foto ?? '',
    });
  }

  return {
    project: {
      id: project?.id ?? '',
      naam: project?.name ?? '',
      adres: project?.address ?? '',
      opdrachtgever: project?.initiator_name ?? '',
      aannemer: project?.aannemer_name ?? '',
    },
    gegenereerd_op: formatDateTimeNL(new Date().toISOString()),
    evidence: evidenceBlocks,
  };
};

// ── Adobe Document Generation (lazy-required zodat tests kunnen mocken) ──────

/**
 * Voert de merge uit: Word-sjabloon (buffer) + JSON → PDF-buffer.
 * Lazy require van de SDK zodat de module laadt zonder de dependency en tests
 * de Adobe-call eenvoudig kunnen mocken.
 */
const runAdobeMerge = async (
  templateBuffer: Buffer,
  data: Record<string, unknown>
): Promise<Buffer> => {
  const {
    ServicePrincipalCredentials,
    PDFServices,
    MimeType,
    DocumentMergeParams,
    OutputFormat,
    DocumentMergeJob,
    DocumentMergeResult,
  } = require('@adobe/pdfservices-node-sdk');
  const { Readable } = require('stream');

  const credentials = new ServicePrincipalCredentials({
    clientId: backendConfig.pdfServicesClientId,
    clientSecret: backendConfig.pdfServicesClientSecret,
  });
  const pdfServices = new PDFServices({ credentials });

  const readStream: Readable = Readable.from(templateBuffer);
  const inputAsset = await pdfServices.upload({
    readStream,
    mimeType: MimeType.DOCX,
  });

  const params = new DocumentMergeParams({
    jsonDataForMerge: data,
    outputFormat: OutputFormat.PDF,
  });
  const job = new DocumentMergeJob({ inputAsset, params });

  const pollingURL = await pdfServices.submit({ job });
  const response = await pdfServices.getJobResult({
    pollingURL,
    resultType: DocumentMergeResult,
  });

  const resultAsset = response.result.asset;
  const streamAsset = await pdfServices.getContent({ asset: resultAsset });

  const chunks: Buffer[] = [];
  for await (const chunk of streamAsset.readStream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

// ── Hoofdfunctie ────────────────────────────────────────────────────────────

const buildDossier = async (projectId: string): Promise<BuildDossierResult> => {
  const pid = String(projectId ?? '').trim();
  if (!pid) return { ok: false, reason: 'projectId ontbreekt.' };

  if (!hasAdobeConfig()) {
    console.warn(
      '⏸️ Dossiermotor overgeslagen: Adobe-credentials (PDF_SERVICES_*) ontbreken.'
    );
    return { ok: false, reason: 'Adobe-credentials ontbreken.', skipped: true };
  }

  const supabase = getSupabaseAdminClient();

  // 1. Project ophalen.
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', pid)
    .maybeSingle();
  if (projectError) {
    return { ok: false, reason: `Project ophalen mislukt: ${projectError.message}` };
  }

  // 2. Goedgekeurd bewijs ophalen.
  const { data: evidence, error: evidenceError } = await supabase
    .from('evidence')
    .select('*')
    .eq('project_id', pid)
    .in('ai_status', APPROVED_STATUSES)
    .order('timestamp', { ascending: true });
  if (evidenceError) {
    return { ok: false, reason: `Bewijs ophalen mislukt: ${evidenceError.message}` };
  }

  const evidenceList = (evidence ?? []) as EvidenceRow[];

  // 3. Word-sjabloon downloaden uit de template-bucket.
  const { data: templateBlob, error: templateError } = await supabase.storage
    .from(backendConfig.dossierTemplateBucket)
    .download(backendConfig.dossierTemplatePath);
  if (templateError || !templateBlob) {
    return {
      ok: false,
      reason: `Word-sjabloon niet gevonden in bucket "${backendConfig.dossierTemplateBucket}/${backendConfig.dossierTemplatePath}": ${
        templateError?.message ?? 'onbekend'
      }`,
    };
  }
  const templateBuffer = Buffer.from(await templateBlob.arrayBuffer());

  // 4. JSON bouwen + Adobe-merge. Faalt Adobe → log + oude dossier blijft staan.
  let pdfBuffer: Buffer;
  try {
    const data = await buildTemplateData(supabase, (project ?? null) as ProjectRow | null, evidenceList);
    pdfBuffer = await runAdobeMerge(templateBuffer, data);
  } catch (error: any) {
    console.error(
      `❌ Adobe-dossiergeneratie mislukt voor project ${pid} (oud dossier blijft staan): ${
        error?.message ?? 'onbekende fout'
      }`
    );
    return { ok: false, reason: 'Adobe Document Generation API onbereikbaar of foutief.' };
  }

  // 5. Nieuwe PDF uploaden (nieuwe timestamp; oude blijft staan).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const objectPath = `${pid}/dossier-${stamp}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(backendConfig.dossierBucket)
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, reason: `Upload van dossier mislukt: ${uploadError.message}` };
  }

  // Bewaar het PAD in projects.dossier_url (niet een publieke URL); bij gebruik
  // wordt het pad getekend tot een kortlevende signed URL. Voor de respons
  // tekenen we hier alvast een signed URL (service_role; werkt op privé-bucket).
  const { data: signedData } = await supabase.storage
    .from(backendConfig.dossierBucket)
    .createSignedUrl(objectPath, 3600);
  const dossierUrl = signedData?.signedUrl ?? objectPath;

  // 6. PAD terugschrijven. Lukt dit niet (bv. kolom ontbreekt), dan blijft de
  //    PDF gewoon in de bucket staan — geen harde fout.
  const { error: updateError } = await supabase
    .from('projects')
    .update({ dossier_url: objectPath })
    .eq('id', pid);
  if (updateError) {
    console.warn(
      `⚠️ Dossier-PDF staat in de bucket, maar projects.dossier_url kon niet worden bijgewerkt: ${updateError.message}`
    );
  }

  console.log(
    `✅ Dossier gegenereerd voor project ${pid}: ${objectPath} (${evidenceList.length} bewijsblok(ken)).`
  );
  return { ok: true, url: dossierUrl, path: objectPath, evidenceCount: evidenceList.length };
};

module.exports = {
  buildDossier,
};
