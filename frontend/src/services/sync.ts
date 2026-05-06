import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { BACKEND_URL } from '../config/app';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
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

        // Blob-URLs (mobiele PWA) en http-URLs: expo-file-system kan deze niet lezen.
        // Gebruik fetch + ArrayBuffer voor de base64-conversie.
        let base64: string;
        if (item.mediaUri.startsWith('blob:') || item.mediaUri.startsWith('http')) {
          const response = await fetch(item.mediaUri);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          base64 = btoa(binary);
        } else {
          base64 = await new File(item.mediaUri).base64();
        }

        const fileId = item.id || `bewijs-${Date.now()}`;
        const safeFileId = fileId.replace(/[^a-zA-Z0-9-_]/g, '');
        const fileName = `wkb_foto_${safeFileId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('wkb-evidence')
          .upload(fileName, decode(base64), {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          throw new Error(`Storage upload gefaald: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('wkb-evidence')
          .getPublicUrl(fileName);

        const richPayload = {
          photo_uri: publicUrlData.publicUrl,
          media_uri: publicUrlData.publicUrl,
          latitude: item.latitude,
          longitude: item.longitude,
          gps_accuracy: item.gpsAccuracy ?? null,
          timestamp: item.timestamp,
          project_id: item.projectId,
          inspection_point_id: item.inspectionPointId,
          exif_hash: item.exifHash,
          exif_verified: item.exifVerified,
          user_id: item.userId ?? authUser?.id ?? null,
          ifc_guid: item.ifcGuid ?? null,
          field_note: item.fieldNote ?? null,
          etage: item.etage ?? null,
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
        };
        const legacyPayload = {
          photo_uri: publicUrlData.publicUrl,
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
                photo_uri: publicUrlData.publicUrl,
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

        if (item.ifcGuid && insertedEvidence?.id) {
          try {
            const bimResponse = await fetch(`${BACKEND_URL}/api/integrations/bim/sync-bcf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                evidenceId: String(insertedEvidence.id),
                ifcGuid: item.ifcGuid,
                projectId: item.projectId,
              }),
            });

            if (!bimResponse.ok) {
              console.error(
                `❌ BIM/BCF sync faalde voor bewijs ${item.id}: HTTP ${bimResponse.status}`
              );
            }
          } catch (bimError) {
            console.error('❌ BIM/BCF sync request faalde:', bimError);
          }
        }

        console.log(`✅ Bewijs ID ${item.id ?? fileName} volledig geüpload!`);
        syncCount += 1;
      } catch (itemError) {
        console.error(`❌ Fout bij item ${item.id ?? 'onbekend'}:`, itemError);
        if (typeof item.rowId === 'number') {
          await markEvidenceSyncFailed(item.rowId);
        }
      }
    }

    return syncCount;
  } catch (error) {
    console.error('❌ Fatale fout in de Sync-Engine:', error);
    return 0;
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
