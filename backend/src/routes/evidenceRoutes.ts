import type { Request, Response } from 'express';

const { Router } = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');
const { validateEvidenceWithAI } = require('../services/aiValidationService');
const { requireProjectTenantScope } = require('../middleware/requireProjectTenantScope');

dotenv.config();

type EvidenceUploadPayload = {
  id?: string;
  evidence_id?: string;
  projectId?: string;
  project_id?: string;
  inspectionPointId?: string;
  inspection_point_id?: string;
  timestamp?: string;
  latitude?: number | string;
  longitude?: number | string;
  gpsAccuracy?: number | string | null;
  gps_accuracy?: number | string | null;
  exifHash?: string;
  exif_hash?: string;
  exifVerified?: boolean | number | string | null;
  exif_verified?: boolean | number | string | null;
  fieldNote?: string | null;
  field_note?: string | null;
  stopMomentConfirmed?: boolean | number | string | null;
  stop_moment_confirmed?: boolean | number | string | null;
  measurementToolConfirmed?: boolean | number | string | null;
  measurement_tool_confirmed?: boolean | number | string | null;
  locationVerified?: boolean | number | string | null;
  location_verified?: boolean | number | string | null;
  locationSpoofRisk?: string | null;
  location_spoof_risk?: string | null;
  locationSecurityMessage?: string | null;
  location_security_message?: string | null;
};

type UploadedFile = {
  buffer: Buffer;
  mimetype?: string;
};

type MulterRequest = Request & {
  file?: UploadedFile;
};

const router = Router();

// Foto-uploads worden volledig in geheugen gebufferd; zonder limiet kan één
// grote upload het geheugen laten vollopen. 15 MB is ruim voldoende voor
// telefoonfoto's (typisch 2–8 MB). Alleen afbeeldingen toegestaan.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (typeof file?.mimetype === 'string' && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('ONLY_IMAGES'));
  },
});

// Wrappt multer zodat een te groot of niet-toegestaan bestand een nette
// Nederlandse foutmelding geeft i.p.v. een generieke 500.
const uploadPhoto = (req: Request, res: Response, next: () => void) => {
  upload.single('photo')(req, res, (err: any) => {
    if (!err) {
      next();
      return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'De foto is te groot (max 15 MB). Maak de foto kleiner en probeer opnieuw.',
      });
      return;
    }
    if (err?.message === 'ONLY_IMAGES') {
      res.status(415).json({
        error: 'Alleen afbeeldingen zijn toegestaan als bewijs.',
      });
      return;
    }
    res.status(400).json({ error: 'Uploaden van de foto is mislukt. Probeer het opnieuw.' });
  });
};

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

const parseEvidenceData = (rawValue: unknown): EvidenceUploadPayload => {
  if (typeof rawValue === 'string' && rawValue.trim()) {
    return JSON.parse(rawValue) as EvidenceUploadPayload;
  }

  if (rawValue && typeof rawValue === 'object') {
    return rawValue as EvidenceUploadPayload;
  }

  throw new Error('Foto of evidenceData ontbreekt in de request.');
};

const getStringField = (payload: EvidenceUploadPayload, keys: (keyof EvidenceUploadPayload)[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getNumberField = (
  payload: EvidenceUploadPayload,
  keys: (keyof EvidenceUploadPayload)[],
  fallback?: number | null
) => {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback ?? Number.NaN;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback ?? Number.NaN;
};

const getBooleanField = (
  payload: EvidenceUploadPayload,
  keys: (keyof EvidenceUploadPayload)[]
) => {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }
  }

  return false;
};

const getFileExtension = (mimeType?: string) => {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
};

// Herkent een 'ontbrekende kolom'-fout van PostgREST/Postgres. Alleen dán is de
// legacy-fallback (zónder de Wkb-verificatievelden) gerechtvaardigd; bij elke
// andere fout mag de insert niet stil die velden weglaten.
const isMissingColumnError = (
  error: { message?: string; code?: string } | null | undefined
) => {
  if (!error) return false;
  const message = String(error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    (message.includes('column') && message.includes('could not find'))
  );
};

router.post(
  '/upload',
  uploadPhoto,
  // Ná multer (evidenceData is dan beschikbaar), vóór de handler: project moet
  // bestaan én in de tenant van de ingelogde gebruiker vallen (audit 17 jul '26
  // — daarvoor kon elke ingelogde gebruiker naar elk project uploaden).
  requireProjectTenantScope,
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      if (!req.file || !req.body?.evidenceData) {
        res.status(400).json({ error: 'Foto of evidenceData ontbreekt in de request.' });
        return;
      }

      const evidenceData = parseEvidenceData(req.body.evidenceData);
      const evidenceId =
        getStringField(evidenceData, ['id', 'evidence_id']) || `bewijs-${Date.now()}`;
      // Geen 'onbekend-project'-fallback meer: bewijs zonder geldig project is
      // waardeloos in het Wkb-dossier én omzeilde de tenant-scope-check.
      const projectId = getStringField(evidenceData, ['projectId', 'project_id']);
      const inspectionPointId = getStringField(evidenceData, [
        'inspectionPointId',
        'inspection_point_id',
      ]);
      const timestamp =
        getStringField(evidenceData, ['timestamp']) || new Date().toISOString();
      const latitude = getNumberField(evidenceData, ['latitude']);
      const longitude = getNumberField(evidenceData, ['longitude']);
      const gpsAccuracy = getNumberField(
        evidenceData,
        ['gpsAccuracy', 'gps_accuracy'],
        null
      );
      const exifHash = getStringField(evidenceData, ['exifHash', 'exif_hash']);
      const exifVerified = getBooleanField(evidenceData, [
        'exifVerified',
        'exif_verified',
      ]);
      const fieldNote =
        getStringField(evidenceData, ['fieldNote', 'field_note']) || null;
      const stopMomentConfirmed = getBooleanField(evidenceData, [
        'stopMomentConfirmed',
        'stop_moment_confirmed',
      ]);
      const measurementToolConfirmed = getBooleanField(evidenceData, [
        'measurementToolConfirmed',
        'measurement_tool_confirmed',
      ]);
      const locationVerified = getBooleanField(evidenceData, [
        'locationVerified',
        'location_verified',
      ]);
      const locationSpoofRisk =
        getStringField(evidenceData, ['locationSpoofRisk', 'location_spoof_risk']) ||
        null;
      const locationSecurityMessage =
        getStringField(evidenceData, [
          'locationSecurityMessage',
          'location_security_message',
        ]) || null;

      if (!projectId) {
        res.status(400).json({ error: 'projectId ontbreekt in evidenceData.' });
        return;
      }

      if (!inspectionPointId) {
        res.status(400).json({ error: 'inspectionPointId ontbreekt in evidenceData.' });
        return;
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        res.status(400).json({ error: 'Latitude en longitude zijn verplicht.' });
        return;
      }

      console.log(`📥 Nieuw Wkb-bewijs ontvangen: ${evidenceId}`);

      const aiResult = await validateEvidenceWithAI(req.file.buffer, inspectionPointId);
      const supabase = getSupabaseAdminClient();

      const extension = getFileExtension(req.file.mimetype);
      const safeEvidenceId = evidenceId.replace(/[^a-zA-Z0-9-_]/g, '-');
      const safeProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, '-');
      // Collision-vrij pad + upsert:false: Wkb-bewijs is onveranderbaar. Zonder dit
      // kon een tweede upload met dezelfde evidence_id de originele (mogelijk al
      // goedgekeurde) foto stil overschrijven, terwijl de oude DB-rij met zijn
      // exif_hash naar hetzelfde pad bleef wijzen — het origineel was dan weg.
      const fileName = `${safeProjectId}/${safeEvidenceId}-${Date.now()}.${extension}`;

      const { error: storageError } = await supabase.storage
        .from('wkb-evidence')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype || 'image/jpeg',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Supabase Storage fout: ${storageError.message}`);
      }

      // Bewaar het PAD (niet een publieke URL). De frontend tekent dit pad bij
      // het ophalen (fetchEvidenceForReview) tot een kortlevende signed URL.
      // Voor de respons tekenen we hier alvast een signed URL (service_role).
      const { data: signedData } = await supabase.storage
        .from('wkb-evidence')
        .createSignedUrl(fileName, 3600);

      const mediaUrl = signedData?.signedUrl ?? fileName;
      const aiFindingsText = aiResult.findings.join(' | ');

      // tenant_id komt uit de scope-check (requireProjectTenantScope) — de
      // productie-DB heeft de kolom (RLS tenant-fence); in een verouderde
      // omgeving zonder kolom vangt de bestaande legacy-fallback dit op.
      const tenantId =
        (req as MulterRequest & { projectTenantScope?: { tenantId: string | null } })
          .projectTenantScope?.tenantId ?? null;

      const richPayload = {
        evidence_id: evidenceId,
        project_id: projectId,
        tenant_id: tenantId,
        inspection_point_id: inspectionPointId,
        media_uri: fileName,
        photo_uri: fileName,
        timestamp,
        latitude,
        longitude,
        gps_accuracy: gpsAccuracy,
        exif_hash: exifHash || null,
        exif_verified: exifVerified,
        field_note: fieldNote,
        stop_moment_confirmed: stopMomentConfirmed,
        measurement_tool_confirmed: measurementToolConfirmed,
        location_verified: locationVerified,
        location_spoof_risk: locationSpoofRisk,
        location_security_message: locationSecurityMessage,
        ai_status: aiResult.status,
        ai_confidence: aiResult.confidence,
        ai_notes: aiFindingsText,
      };

      const legacyPayload = {
        photo_uri: fileName,
        timestamp,
        latitude,
        longitude,
        project_id: projectId,
        inspection_point_id: inspectionPointId,
        ai_status: aiResult.status,
        ai_confidence: aiResult.confidence,
        ai_notes: aiFindingsText,
      };

      let insertedEvidence:
        | {
            id?: number;
          }
        | null = null;
      let dbError: { message: string } | null = null;

      for (const [attempt, payload] of [richPayload, legacyPayload].entries()) {
        const response = await supabase
          .from('evidence')
          .insert([payload])
          .select('id')
          .single();

        if (!response.error) {
          insertedEvidence = response.data;
          dbError = null;
          break;
        }

        dbError = response.error;

        // Val alleen terug op het legacy-payload (zónder exif_hash, gps_accuracy en
        // de verificatievlaggen) wanneer de rijke insert faalde op een ontbrekende
        // kolom. Bij elke andere fout niet stil verificatievelden weglaten → falen.
        if (attempt === 0) {
          if (!isMissingColumnError(response.error)) {
            break;
          }
          console.warn(
            'Rijke evidence-insert faalde op een ontbrekende kolom; val terug op het legacy-payload zonder Wkb-verificatievelden. Voeg de ontbrekende kolommen toe aan de evidence-tabel. Detail:',
            response.error.message
          );
        }
      }

      if (dbError) {
        throw new Error(`Supabase DB fout: ${dbError.message}`);
      }

      console.log(`✅ Bewijs ${evidenceId} succesvol verwerkt en AI beoordeeld!`);
      res.status(200).json({
        message: 'Upload & AI-validatie succesvol',
        evidenceId,
        cloudRecordId: insertedEvidence?.id ?? null,
        mediaUrl,
        aiResult,
      });
    } catch (error: any) {
      console.error('❌ Fout in de evidence upload route:', error?.message ?? error);
      res.status(500).json({
        error: error?.message ?? 'Interne serverfout bij het verwerken van het Wkb-bewijs.',
      });
    }
  }
);

module.exports = router;
