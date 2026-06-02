/**
 * dossierRefreshCron — nachtelijke auto-refresh van project-dossiers.
 *
 * Ververst per actief project het Adobe-PDF-dossier (zie dossierService) op een
 * cron-schema. Spiegelt bewust het patroon van kikRetryCron: lazy Supabase-
 * client, zacht falen, en uit-standaard tot de Adobe-config + sjabloon staan.
 *
 * Standaard UIT (DOSSIER_REFRESH_ENABLED=false). De handmatige route
 * POST /api/wkb-dossier/genereer/:projectId werkt los van deze cron.
 */

import type { ScheduledTask } from 'node-cron';

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig, hasAdobeConfig } = require('../config');
const { buildDossier } = require('../services/dossierService');

type ProjectIdRow = { id?: string | null };

let refreshTask: ScheduledTask | null = null;
let supabaseAdminClient: any | null = null;

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

const fetchProjectIds = async (): Promise<string[]> => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn(
      'Dossier-refresh draait zonder Supabase-configuratie; projecten kunnen niet worden opgehaald.'
    );
    return [];
  }

  const { data, error } = await supabase.from('projects').select('id');
  if (error) {
    console.warn('Dossier-refresh kon projecten niet ophalen:', error?.message);
    return [];
  }

  return ((data ?? []) as ProjectIdRow[])
    .map((row) => String(row.id ?? '').trim())
    .filter(Boolean);
};

const runDossierRefreshJob = async () => {
  console.log('🌙 Start nachtelijke dossier-refresh...');

  try {
    const projectIds = await fetchProjectIds();
    if (projectIds.length === 0) {
      console.log('✅ Geen projecten om te verversen.');
      return;
    }

    console.log(`📚 ${projectIds.length} project(en) in de refresh-wachtrij.`);

    for (const projectId of projectIds) {
      // Per project apart afhandelen: één mislukking stopt de rest niet, en een
      // mislukte Adobe-call laat het oude dossier intact (buildDossier-garantie).
      const result = await buildDossier(projectId);
      if (result.ok) {
        console.log(`✅ Dossier ververst voor project ${projectId}.`);
      } else if (result.skipped) {
        console.log(`⏭️ Project ${projectId} overgeslagen: ${result.reason}`);
      } else {
        console.warn(`⚠️ Dossier-refresh mislukt voor project ${projectId}: ${result.reason}`);
      }
    }
  } catch (error: any) {
    console.error(
      '❌ Fatale fout tijdens de dossier-refresh-cronjob:',
      error?.message ?? 'onbekende fout'
    );
  }
};

const startDossierRefreshJob = () => {
  if (!backendConfig.dossierRefreshEnabled) {
    console.log('⏸️ Dossier-refresh staat uit via DOSSIER_REFRESH_ENABLED=false.');
    return null;
  }

  if (!hasAdobeConfig()) {
    console.log('⏸️ Dossier-refresh niet gestart: Adobe-credentials ontbreken.');
    return null;
  }

  if (refreshTask) {
    return refreshTask;
  }

  console.log(
    `⏱️ Dossier-refresh-cronjob geregistreerd op schema "${backendConfig.dossierRefreshSchedule}".`
  );

  refreshTask = cron.schedule(backendConfig.dossierRefreshSchedule, () => {
    void runDossierRefreshJob();
  });

  return refreshTask;
};

module.exports = {
  runDossierRefreshJob,
  startDossierRefreshJob,
};
