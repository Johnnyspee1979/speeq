import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { resolveStorageUrl } from '../lib/storageUrl';
import { getOfflinePhotoBlob } from './OfflinePhotoStore';
import {
  getConsumerDossierDocuments,
  getConsumerDossierItems,
  getGereedmeldingItems,
  getPunchlistItems,
  getUnsyncedEvidence,
  markConsumerDossierDocumentsSynced,
  markConsumerDossierItemsSynced,
  markEvidenceSyncFailed,
  markEvidenceSyncedWithCloudId,
  markGereedmeldingItemsSynced,
  markPunchlistItemsSynced,
  getAllPresets,
  updateEvidenceAiStatus,
} from '../database/database';
import { requestCloudAiValidation, type CloudAiRequestTemplate } from './aiCloud';
import { getEvidenceComplianceContext } from './wkbCompliance';
import { findWkbTaskTemplateByInspectionPointId } from '../data/WkbTemplates';

const EVIDENCE_TABLE = 'evidence';
const PRESETS_TABLE = 'presets';
const PROJECT_CHECKLISTS_TABLE = 'project_checklists';
const CONSUMER_DOSSIER_DOCUMENTS_TABLE = 'consumer_dossier_documents';

/** Max keer dat een FAILED item automatisch opnieuw geprobeerd wordt. */
const MAX_SYNC_RETRIES = 3;

export type SyncResult = {
  status: 'skipped' | 'idle' | 'synced' | 'error';
  count: number;
  message?: string;
};

// 4. De Sync-Engine: Push offline data naar de Supabase Cloud
export const syncEvidenceToCloud = async (onProgress?: (msg: string) => void) => {
  try {
    if (!isSupabaseConfigured()) {
      return 0;
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const unsyncedData = await getUnsyncedEvidence();

    if (unsyncedData.length === 0) {
      return 0;
    }

    console.log(`Start Wkb-sync: ${unsyncedData.length} bestanden uploaden...`);
    onProgress?.(`Voorbereiden van ${unsyncedData.length} Wkb-bewijsstukken...`);
    let syncCount = 0;

    for (const item of unsyncedData) {
      try {
        onProgress?.(`Uploaden van beveiligd bewijs ${syncCount + 1}/${unsyncedData.length}...`);
        const complianceContext = getEvidenceComplianceContext(item.inspectionPointId);

        // Sprint 8 — directe Blob/ArrayBuffer upload, geen base64-roundtrip.
        // Voorheen: fetch → arrayBuffer → byte-loop → btoa → base64 → decode → upload.
        // Dat verdrievoudigde het RAM-gebruik per foto en stapelde op bij 150+ items
        // → OOM-crash op oudere Android-toestellen. Nu: één fetch().blob() (of native
        // base64 als laatste fallback).
        let uploadBody: Blob | ArrayBuffer;
        if (Platform.OS === 'web') {
          // 1) Probeer rechtstreeks de blob uit IndexedDB — geen extra fetch nodig.
          const stored = await getOfflinePhotoBlob(item.id).catch(() => null);
          if (stored) {
            uploadBody = stored;
          } else if (
            item.mediaUri.startsWith('blob:') ||
            item.mediaUri.startsWith('http') ||
            item.mediaUri.startsWith('data:')
          ) {
            const response = await fetch(item.mediaUri);
            uploadBody = await response.blob();
          } else {
            // Onbekend protocol op web — laatste redmiddel via native bridge.
            uploadBody = decode(await new File(item.mediaUri).base64());
          }
        } else {
          // Native (iOS/Android): file-path lezen met expo-file-system, decode → ArrayBuffer.
          uploadBody = decode(await new File(item.mediaUri).base64());
        }

        const fileId = item.id || `bewijs-${Date.now()}`;
        const safeFileId = fileId.replace(/[^a-zA-Z0-9-_]/g, '');
        const fileName = `wkb_foto_${safeFileId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('wkb-evidence')
          .upload(fileName, uploadBody, {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          throw new Error(`Storage upload gefaald: ${uploadError.message}`);
        }

        // Kortlevende signed URL — alleen nodig voor de cloud-AI-validatie
        // (die de foto fetcht). Werkt ook op een privé-bucket.
        const signedUrl =
          (await resolveStorageUrl('wkb-evidence', fileName)) ?? fileName;

        // Bewaar het PAD (niet een publieke URL). Bij het ophalen tekent
        // fetchEvidenceForReview() dit pad tot een kortlevende signed URL.
        const richPayload = {
          photo_uri: fileName,
          media_uri: fileName,
          latitude: item.latitude,
          longitude: item.longitude,
          gps_accuracy: item.gpsAccuracy ?? null,
          timestamp: item.timestamp,
          project_id: item.projectId,
          inspection_point_id: item.inspectionPointId,
          exif_hash: item.exifHash,
          exif_verified: item.exifVerified,
          user_id: item.userId ?? authUser?.id ?? null,
          field_note: item.fieldNote ?? null,
          etage: item.etage ?? null,
          huisnummer: item.huisnummer ?? null,
          ruimtenummer: item.ruimtenummer ?? null,
          binnenbuiten: item.binnenbuiten ?? null,
          locatie_detail: item.locatieDetail ?? null,
          weather_label: item.weatherLabel ?? null,
          discipline_id: complianceContext.disciplineId ?? null,
          dossier_scope: complianceContext.dossierScope ?? null,
          stop_moment_label: complianceContext.stopMoment ?? null,
          requires_measurement_tool: complianceContext.requiresMeasurementTool,
          stop_moment_confirmed: item.stopMomentConfirmed ?? null,
          measurement_tool_confirmed: item.measurementToolConfirmed ?? null,
          location_verified: item.locationVerified ?? null,
          location_spoof_risk: item.locationSpoofRisk ?? null,
          location_security_message: item.locationSecurityMessage ?? null,
          sync_status: item.syncStatus,
          ai_status: item.aiStatus ?? 'PENDING',
          ai_confidence: item.aiConfidence ?? null,
          ai_notes: item.aiNotes ?? null,
          floor_plan_id: item.floorPlanId ?? null,
          pin_x: item.pinX ?? null,
          pin_y: item.pinY ?? null,
          review_status: item.reviewStatus ?? null,
          reviewed_by: item.reviewedBy ?? null,
          reviewed_at: item.reviewedAt ?? null,
          review_note: item.reviewNote ?? null,
        };
        const legacyPayload = {
          photo_uri: fileName,
          latitude: item.latitude,
          longitude: item.longitude,
          timestamp: item.timestamp,
          project_id: item.projectId,
          inspection_point_id: item.inspectionPointId,
          user_id: item.userId ?? authUser?.id ?? null,
          ai_status: item.aiStatus ?? 'PENDING',
          ai_confidence: item.aiConfidence ?? null,
          ai_notes: item.aiNotes ?? null,
        };

        let insertedEvidence:
          | {
              id?: number;
            }
          | null = null;
        let dbError: { message: string } | null = null;

        for (const payload of [richPayload, legacyPayload]) {
          const response = await supabase
            .from(EVIDENCE_TABLE)
            .insert([payload])
            .select('id')
            .single();

          if (!response.error) {
            insertedEvidence = response.data;
            dbError = null;
            break;
          }

          dbError = response.error;
        }

          if (dbError) {
            throw new Error(`Database insert gefaald: ${dbError.message}`);
          }

          if (typeof item.rowId === 'number') {
            try {
              onProgress?.(`Generatieve AI analyseert ${item.inspectionPointId} op NEN-normeringen...`);
              const template = findWkbTaskTemplateByInspectionPointId(item.inspectionPointId);
              let aiTemplatePayload: CloudAiRequestTemplate | undefined;
              if (template) {
                aiTemplatePayload = {
                  id: template.id,
                  discipline: template.disciplineTitle,
                  title: template.title,
                  instruction: template.instruction,
                  requiresMeasurementTool: template.requiresMeasurementTool,
                  requiresTimer: template.requiresTimer,
                  aiValidationKey: template.aiValidationKey,
                  nenNorm: template.standards,
                };
              }

              const aiResponse = await requestCloudAiValidation({
                id: item.id,
                photo_uri: signedUrl,
                latitude: item.latitude,
                longitude: item.longitude,
                gps_accuracy: item.gpsAccuracy ?? null,
                timestamp: item.timestamp,
                project_id: item.projectId,
                inspection_point_id: item.inspectionPointId,
                user_id: item.userId ?? authUser?.id ?? null,
                exif_hash: item.exifHash,
                exif_verified: item.exifVerified,
                field_note: item.fieldNote ?? null,
                etage: item.etage ?? null,
                ruimtenummer: item.ruimtenummer ?? null,
                binnenbuiten: item.binnenbuiten ?? null,
                locatie_detail: item.locatieDetail ?? null,
                weather_label: item.weatherLabel ?? null,
                stop_moment_confirmed: item.stopMomentConfirmed ?? null,
                measurement_tool_confirmed: item.measurementToolConfirmed ?? null,
                location_verified: item.locationVerified ?? null,
                location_spoof_risk: item.locationSpoofRisk ?? null,
                location_security_message: item.locationSecurityMessage ?? null,
                template: aiTemplatePayload,
              });
              await updateEvidenceAiStatus(
                item.rowId,
                aiResponse.status,
                aiResponse.confidence,
                aiResponse.feedback
              );

              if (insertedEvidence?.id) {
                const { error: aiUpdateError } = await supabase
                  .from(EVIDENCE_TABLE)
                  .update({
                    ai_status: aiResponse.status,
                    ai_confidence: aiResponse.confidence,
                    ai_notes: aiResponse.feedback,
                  })
                  .eq('id', insertedEvidence.id);

                if (aiUpdateError) {
                  console.error('❌ Cloud AI status update faalde:', aiUpdateError);
                }
              }
            } catch (aiError) {
              console.error('❌ Cloud AI validatie faalde:', aiError);
            }

            await markEvidenceSyncedWithCloudId(item.rowId, insertedEvidence?.id ?? null);
          }

        console.log(`✅ Bewijs ID ${item.id ?? fileName} volledig geüpload!`);
        syncCount += 1;
      } catch (itemError) {
        const reason = itemError instanceof Error ? itemError.message : String(itemError);
        console.error(`❌ Fout bij item ${item.id ?? 'onbekend'}: ${reason}`);

        // Sprint 8 — WKB-lock: dossier is afgesloten. Geen retries; meteen FAILED.
        // Postgres-trigger `evidence_insert_lock_guard` (zie 20260511 migratie) gooit
        // 'WKB_LOCKED:' wanneer evidence van na `dossiers.locked_at` wordt ingebracht.
        // Doorgaan met retries zou batterij + cellulair verkwisten op iets dat
        // de DB juridisch nooit zal accepteren.
        if (reason.includes('WKB_LOCKED')) {
          console.warn(`🔒 Item ${item.id ?? 'onbekend'} geweigerd: dossier afgesloten`);
          if (typeof item.rowId === 'number') {
            await markEvidenceSyncFailed(item.rowId);
          }
          continue;
        }

        if (typeof item.rowId === 'number') {
          const retryCount = (item as any).syncRetryCount ?? 0;
          if (retryCount >= MAX_SYNC_RETRIES) {
            // Te vaak gefaald — markeer definitief als FAILED zodat vakman gewaarschuwd wordt
            console.warn(`⛔ Item ${item.id} heeft ${MAX_SYNC_RETRIES} pogingen gehad — definitief FAILED`);
            await markEvidenceSyncFailed(item.rowId);
          } else {
            // Nog retries over — houd PENDING maar verhoog teller
            console.warn(`🔄 Item ${item.id} retry ${retryCount + 1}/${MAX_SYNC_RETRIES}`);
            await markEvidenceSyncFailed(item.rowId); // update status; autoSync probeert opnieuw bij volgende run
          }
        }
      }
    }

    return syncCount;
  } catch (error) {
    console.error('❌ Fatale fout in de Sync-Engine:', error);
    return 0;
  }
};

// ─── Directe Supabase upload (bypasses lokale SQLite) ────────────────────────
// Gebruik op web voor onmiddellijke zichtbaarheid in het dashboard.
export const uploadEvidenceDirectly = async (
  evidence: import('../types/Evidence').WkbEvidence,
  photoUri: string
): Promise<{ supabaseId: number; storagePath: string } | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Foto ophalen als Blob/ArrayBuffer — geen base64 roundtrip nodig
    let uploadBody: ArrayBuffer | Blob;
    if (photoUri.startsWith('blob:') || photoUri.startsWith('http') || photoUri.startsWith('data:')) {
      const response = await fetch(photoUri);
      uploadBody = await response.blob();
    } else {
      // Native file path (iOS/Android) — lees als base64 via expo-file-system
      try {
        const b64 = await new (await import('expo-file-system')).File(photoUri).base64();
        uploadBody = decode(b64);
      } catch {
        const r = await fetch(photoUri);
        uploadBody = await r.blob();
      }
    }

    const safeId = (evidence.id ?? `direct-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    const fileName = `wkb_foto_${safeId}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('wkb-evidence')
      .upload(fileName, uploadBody, { contentType: 'image/jpeg' });

    if (uploadError) throw new Error(`Storage upload gefaald: ${uploadError.message}`);

    // Bewaar het PAD (niet een publieke URL). fetchEvidenceForReview() tekent
    // dit pad bij het ophalen tot een kortlevende signed URL.
    const { getEvidenceComplianceContext } = await import('./wkbCompliance');
    const complianceContext = getEvidenceComplianceContext(evidence.inspectionPointId);

    const payload = {
      photo_uri: fileName,
      media_uri: fileName,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      gps_accuracy: evidence.gpsAccuracy ?? null,
      timestamp: evidence.timestamp,
      project_id: evidence.projectId,
      inspection_point_id: evidence.inspectionPointId,
      exif_hash: evidence.exifHash,
      exif_verified: evidence.exifVerified,
      user_id: evidence.userId ?? authUser?.id ?? null,
      field_note: evidence.fieldNote ?? null,
      etage: evidence.etage ?? null,
      ruimtenummer: evidence.ruimtenummer ?? null,
      binnenbuiten: evidence.binnenbuiten ?? null,
      locatie_detail: evidence.locatieDetail ?? null,
      weather_label: evidence.weatherLabel ?? null,
      discipline_id: complianceContext.disciplineId ?? null,
      dossier_scope: complianceContext.dossierScope ?? null,
      stop_moment_label: complianceContext.stopMoment ?? null,
      requires_measurement_tool: complianceContext.requiresMeasurementTool,
      stop_moment_confirmed: evidence.stopMomentConfirmed ?? null,
      measurement_tool_confirmed: evidence.measurementToolConfirmed ?? null,
      location_verified: evidence.locationVerified ?? null,
      location_spoof_risk: evidence.locationSpoofRisk ?? null,
      location_security_message: evidence.locationSecurityMessage ?? null,
      sync_status: 'SYNCED',
      ai_status: 'PENDING',
      floor_plan_id: evidence.floorPlanId ?? null,
      pin_x: evidence.pinX ?? null,
      pin_y: evidence.pinY ?? null,
      review_status: evidence.reviewStatus ?? null,
      reviewed_by: evidence.reviewedBy ?? null,
      reviewed_at: evidence.reviewedAt ?? null,
      review_note: evidence.reviewNote ?? null,
    };

    const { data, error: dbError } = await supabase
      .from(EVIDENCE_TABLE)
      .insert([payload])
      .select('id')
      .single();

    if (dbError || !data) throw new Error(`Database insert gefaald: ${dbError?.message}`);

    console.log(`✅ Direct geüpload naar Supabase: ID ${(data as { id: number }).id}`);
    return { supabaseId: (data as { id: number }).id, storagePath: fileName };
  } catch (err) {
    console.error('❌ uploadEvidenceDirectly fout:', err);
    return null;
  }
};

export const syncEvidenceQueue = async (): Promise<SyncResult> => {
  if (!isSupabaseConfigured()) {
    return { status: 'skipped', count: 0, message: 'Supabase niet ingesteld' };
  }

  const pending = await getUnsyncedEvidence();
  if (pending.length === 0) {
    return { status: 'idle', count: 0 };
  }

  const syncedCount = await syncEvidenceToCloud();
  if (syncedCount === 0) {
    return {
      status: 'error',
      count: pending.length,
      message: 'Geen bewijsstukken konden worden gesynchroniseerd.',
    };
  }

  return { status: 'synced', count: syncedCount };
};

const syncChecklistRows = async (
  projectId: string,
  checklistType: 'PUNCHLIST' | 'GEREEDMELDING' | 'CONSUMER_DOSSIER',
  items: Array<{
    id: string;
    title: string;
    checked: boolean;
    updatedAt: string | null;
  }>
) => {
  if (items.length === 0) {
    return 0;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const payload = items.map((item) => ({
    project_id: projectId,
    checklist_type: checklistType,
    item_id: item.id,
    title: item.title,
    checked: item.checked,
    updated_at: item.updatedAt ?? new Date().toISOString(),
    user_id: authUser?.id ?? null,
  }));

  const { error } = await supabase.from(PROJECT_CHECKLISTS_TABLE).upsert(payload, {
    onConflict: 'project_id,checklist_type,item_id',
  });

  if (error) {
    throw new Error(`Checklist sync gefaald (${checklistType}): ${error.message}`);
  }

  return payload.length;
};

const syncConsumerDocumentRows = async (projectId: string) => {
  const documents = await getConsumerDossierDocuments(projectId);

  if (documents.length === 0) {
    return 0;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const payload = documents.map((item) => ({
    project_id: projectId,
    document_id: item.id,
    requirement_id: item.requirementId,
    title: item.title,
    category: item.category,
    reference_value: item.referenceValue,
    notes: item.notes,
    updated_at: item.updatedAt ?? new Date().toISOString(),
    user_id: authUser?.id ?? null,
  }));

  const { error } = await supabase
    .from(CONSUMER_DOSSIER_DOCUMENTS_TABLE)
    .upsert(payload, {
      onConflict: 'project_id,document_id',
    });

  if (error) {
    throw new Error(`Document sync gefaald: ${error.message}`);
  }

  return payload.length;
};

export const syncProjectDeliveryStateToCloud = async (
  projectId: string
): Promise<SyncResult> => {
  if (!isSupabaseConfigured()) {
    return { status: 'skipped', count: 0, message: 'Supabase niet ingesteld' };
  }

  try {
    const [punchlistItems, gereedmeldingItems, consumerDossierItems] = await Promise.all([
      getPunchlistItems(projectId),
      getGereedmeldingItems(projectId),
      getConsumerDossierItems(projectId),
    ]);

    const [punchlistCount, gereedmeldingCount, consumerChecklistCount, documentsCount] =
      await Promise.all([
        syncChecklistRows(projectId, 'PUNCHLIST', punchlistItems),
        syncChecklistRows(projectId, 'GEREEDMELDING', gereedmeldingItems),
        syncChecklistRows(projectId, 'CONSUMER_DOSSIER', consumerDossierItems),
        syncConsumerDocumentRows(projectId),
      ]);

    if (punchlistCount > 0) {
      await markPunchlistItemsSynced(projectId);
    }

    if (gereedmeldingCount > 0) {
      await markGereedmeldingItemsSynced(projectId);
    }

    if (consumerChecklistCount > 0) {
      await markConsumerDossierItemsSynced(projectId);
    }

    if (documentsCount > 0) {
      await markConsumerDossierDocumentsSynced(projectId);
    }

    const totalCount =
      punchlistCount + gereedmeldingCount + consumerChecklistCount + documentsCount;

    return totalCount === 0
      ? { status: 'idle', count: 0 }
      : { status: 'synced', count: totalCount };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Projectcontext kon niet naar de cloud worden gesynchroniseerd.';
    console.error('❌ Projectcontext sync mislukt:', error);
    return {
      status: 'error',
      count: 0,
      message,
    };
  }
};

export const syncPresetsToCloud = async (): Promise<number> => {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const presets = await getAllPresets();
  if (presets.length === 0) {
    return 0;
  }

  const { error } = await supabase.from(PRESETS_TABLE).upsert(presets, {
    onConflict: 'type,value',
  });

  if (error) {
    console.error('❌ Preset sync mislukt:', error.message);
    return 0;
  }

  return presets.length;
};
