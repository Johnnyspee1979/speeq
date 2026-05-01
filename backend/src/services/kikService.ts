const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');

type KikSyncStatus = 'SYNCED' | 'RETRY_PENDING' | 'FAILED';

type KikEvidenceRecord = {
  id?: string;
  project_id?: string;
  inspection_point_id?: string;
  photo_uri?: string;
  media_uri?: string;
  exif_hash?: string;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
  ai_status?: string;
  field_note?: string;
  notes?: string;
};

type KiKEvidencePayload = {
  evidenceId: string;
  projectId: string;
  inspectionPointId: string;
  mediaUrl: string;
  timestamp: string;
  gps: {
    latitude: number;
    longitude: number;
  };
  exifHash: string;
  aiValidationStatus: string;
  notes?: string;
};

type KiKPushResult = {
  success: boolean;
  status: KikSyncStatus;
  evidenceId: string;
  retryPending: boolean;
  message?: string;
  raw?: unknown;
};

let supabaseAdminClient: any | null = null;
let hasWarnedAboutMissingKikColumn = false;

const createKikClient = () => {
  if (!backendConfig.kikApiUrl || !backendConfig.kikApiKey) {
    throw new Error('KiK configuratie ontbreekt in .env');
  }

  return axios.create({
    baseURL: backendConfig.kikApiUrl,
    timeout: backendConfig.kikTimeoutMs,
    headers: {
      Authorization: `Bearer ${backendConfig.kikApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
};

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }

  return supabaseAdminClient;
};

const isMissingKikStatusColumnError = (error: any) => {
  const message = String(
    error?.message ?? error?.details ?? error?.hint ?? ''
  ).toLowerCase();

  return (
    message.includes('kik_sync_status') &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
};

const isRetryableKikError = (error: any) => {
  const status = Number(error?.response?.status);
  const code = String(error?.code ?? '').toUpperCase();

  return (
    [408, 425, 429, 500, 502, 503, 504].includes(status) ||
    ['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
      code
    )
  );
};

const safeUpdateKikSyncStatus = async (
  evidenceId: string,
  status: KikSyncStatus
) => {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  try {
    const { error } = await supabase
      .from('evidence')
      .update({ kik_sync_status: status })
      .eq('id', evidenceId);

    if (!error) {
      return;
    }

    if (isMissingKikStatusColumnError(error)) {
      if (!hasWarnedAboutMissingKikColumn) {
        console.warn(
          'KiK retry-status wordt niet opgeslagen: voeg kolom "kik_sync_status" toe aan de Supabase tabel "evidence".'
        );
        hasWarnedAboutMissingKikColumn = true;
      }
      return;
    }

    console.warn(
      `Kon kik_sync_status niet updaten voor bewijs ${evidenceId}: ${error.message}`
    );
  } catch (error: any) {
    console.warn(
      `Kon kik_sync_status niet updaten voor bewijs ${evidenceId}: ${
        error?.message ?? 'onbekende fout'
      }`
    );
  }
};

const buildKiKEvidencePayload = (
  fallbackProjectId: string,
  record: KikEvidenceRecord
): KiKEvidencePayload | null => {
  const evidenceId = String(record.id ?? '').trim();
  const projectId = String(record.project_id ?? fallbackProjectId ?? '').trim();
  const inspectionPointId = String(record.inspection_point_id ?? '').trim();
  const mediaUrl = String(record.photo_uri ?? record.media_uri ?? '').trim();
  const timestamp = String(record.timestamp ?? '').trim();
  const exifHash = String(record.exif_hash ?? '').trim();
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  const notes =
    String(record.notes ?? record.field_note ?? '').trim() || undefined;

  if (
    !evidenceId ||
    !projectId ||
    !inspectionPointId ||
    !mediaUrl ||
    !timestamp ||
    !exifHash ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    evidenceId,
    projectId,
    inspectionPointId,
    mediaUrl,
    timestamp,
    gps: {
      latitude,
      longitude,
    },
    exifHash,
    aiValidationStatus: String(record.ai_status ?? 'PENDING').trim() || 'PENDING',
    ...(notes ? { notes } : {}),
  };
};

const fetchKikBorgingsplan = async (projectId: string) => {
  const client = createKikClient();

  const response = await client.get(`/borgingsplan/${encodeURIComponent(projectId)}`);
  return response.data;
};

const pushEvidenceToKiK = async (
  payload: KiKEvidencePayload
): Promise<KiKPushResult> => {
  try {
    const client = createKikClient();

    const response = await client.post(
      `/projects/${encodeURIComponent(payload.projectId)}/evidence`,
      {
        project_id: payload.projectId,
        inspection_point_id: payload.inspectionPointId,
        status: 'TER_BEOORDELING',
        evidence: {
          file_url: payload.mediaUrl,
          captured_at: payload.timestamp,
          location: {
            lat: payload.gps.latitude,
            lng: payload.gps.longitude,
          },
          security_hash: payload.exifHash,
          remarks:
            payload.notes ??
            'Geautomatiseerd aangeleverd via Wkb Snap & Sync App',
          ai_precheck_status: payload.aiValidationStatus,
        },
        submitted_by: 'Wkb Snap & Sync App',
      }
    );

    await safeUpdateKikSyncStatus(payload.evidenceId, 'SYNCED');

    return {
      success: true,
      status: 'SYNCED',
      evidenceId: payload.evidenceId,
      retryPending: false,
      raw: response.data,
    };
  } catch (error: any) {
    const retryPending = isRetryableKikError(error);
    await safeUpdateKikSyncStatus(
      payload.evidenceId,
      retryPending ? 'RETRY_PENDING' : 'FAILED'
    );

    return {
      success: false,
      status: retryPending ? 'RETRY_PENDING' : 'FAILED',
      evidenceId: payload.evidenceId,
      retryPending,
      message:
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        error?.message ??
        'KiK synchronisatie mislukt.',
      raw: error?.response?.data,
    };
  }
};

const pushEvidenceBatchToKiK = async (
  projectId: string,
  evidence: KikEvidenceRecord[]
) => {
  const results: KiKPushResult[] = [];

  for (const item of evidence) {
    const payload = buildKiKEvidencePayload(projectId, item);

    if (!payload) {
      const evidenceId = String(item.id ?? '').trim() || 'onbekend';
      await safeUpdateKikSyncStatus(evidenceId, 'FAILED');
      results.push({
        success: false,
        status: 'FAILED',
        evidenceId,
        retryPending: false,
        message: 'Bewijsrecord mist verplichte velden voor KiK synchronisatie.',
      });
      continue;
    }

    results.push(await pushEvidenceToKiK(payload));
  }

  return {
    projectId,
    submitted: results.filter((item) => item.success).length,
    retryPending: results.filter((item) => item.status === 'RETRY_PENDING').length,
    failed: results.filter((item) => item.status === 'FAILED').length,
    results,
  };
};

module.exports = {
  buildKiKEvidencePayload,
  fetchKikBorgingsplan,
  isMissingKikStatusColumnError,
  isRetryableKikError,
  pushEvidenceBatchToKiK,
  pushEvidenceToKiK,
  safeUpdateKikSyncStatus,
};
