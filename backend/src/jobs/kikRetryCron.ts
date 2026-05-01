import type { ScheduledTask } from 'node-cron';

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');
const {
  buildKiKEvidencePayload,
  isMissingKikStatusColumnError,
  pushEvidenceToKiK,
  safeUpdateKikSyncStatus,
} = require('../services/kikService');

type RetryEvidenceRow = {
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
};

let retryTask: ScheduledTask | null = null;
let supabaseAdminClient: any | null = null;
let hasWarnedAboutMissingColumn = false;

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

const fetchRetryPendingEvidence = async (): Promise<RetryEvidenceRow[]> => {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn(
      'KiK retryjob draait zonder Supabase-configuratie; RETRY_PENDING records kunnen niet worden opgehaald.'
    );
    return [];
  }

  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('kik_sync_status', 'RETRY_PENDING');

  if (!error) {
    return (data ?? []) as RetryEvidenceRow[];
  }

  if (isMissingKikStatusColumnError(error)) {
    if (!hasWarnedAboutMissingColumn) {
      console.warn(
        'KiK retryjob kan niet selecteren: voeg kolom "kik_sync_status" toe aan de Supabase tabel "evidence".'
      );
      hasWarnedAboutMissingColumn = true;
    }

    return [];
  }

  console.warn(
    'KiK retryjob fetch failed softly:', error?.message
  );
  return [];
};

const runKiKRetryJob = async () => {
  console.log('🔄 Start automatische retry voor mislukte KiK-synchronisaties...');

  try {
    const pendingEvidence = await fetchRetryPendingEvidence();

    if (pendingEvidence.length === 0) {
      console.log('✅ Geen RETRY_PENDING KiK-items gevonden.');
      return;
    }

    console.log(
      `⚠️ ${pendingEvidence.length} KiK-items gevonden voor automatische retry.`
    );

    for (const item of pendingEvidence) {
      const payload = buildKiKEvidencePayload(String(item.project_id ?? ''), item);

      if (!payload) {
        if (item.id) {
          await safeUpdateKikSyncStatus(String(item.id), 'FAILED');
        }

        console.warn(
          `⚠️ Bewijs ${String(item.id ?? 'onbekend')} mist verplichte velden voor KiK retry en is gemarkeerd als FAILED.`
        );
        continue;
      }

      const result = await pushEvidenceToKiK(payload);

      if (result.success) {
        console.log(
          `✅ Retry succesvol voor bewijs ${payload.evidenceId}; KiK status nu SYNCED.`
        );
        continue;
      }

      console.warn(
        `❌ Retry nog niet gelukt voor bewijs ${payload.evidenceId}: ${
          result.message ?? 'KiK API nog onbereikbaar'
        }`
      );
    }
  } catch (error: any) {
    console.error(
      '❌ Fatale fout tijdens het uitvoeren van de KiK Retry Cronjob:',
      error?.message ?? 'onbekende fout'
    );
  }
};

const startKiKRetryJob = () => {
  if (!backendConfig.kikRetryEnabled) {
    console.log('⏸️ KiK Retry Cronjob staat uit via KIK_RETRY_ENABLED=false.');
    return null;
  }

  if (!backendConfig.kikApiUrl || !backendConfig.kikApiKey) {
    console.log(
      '⏸️ KiK Retry Cronjob niet gestart: KiK API configuratie ontbreekt.'
    );
    return null;
  }

  if (retryTask) {
    return retryTask;
  }

  console.log(
    `⏱️ KiK Retry Cronjob succesvol geregistreerd op schema "${backendConfig.kikRetrySchedule}".`
  );

  retryTask = cron.schedule(backendConfig.kikRetrySchedule, () => {
    void runKiKRetryJob();
  });

  return retryTask;
};

module.exports = {
  runKiKRetryJob,
  startKiKRetryJob,
};
