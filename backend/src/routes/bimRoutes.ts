import type { Request, Response } from 'express';

const { Router } = require('express');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');
const {
  mapEvidenceStatusToBcfTopicStatus,
  pushEvidenceToBimModel,
} = require('../services/bcfService');

type EvidenceRow = {
  id?: string;
  project_id?: string | null;
  inspection_point_id?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
  ai_status?: string | null;
  ai_notes?: string | null;
  ifc_guid?: string | null;
};

const router = Router();

let supabaseAdminClient: any | null = null;
let hasWarnedAboutBimColumns = false;

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }

  return supabaseAdminClient;
};

const readEvidence = async (evidenceId: string) => {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('id', evidenceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as EvidenceRow | null;
};

const readEvidenceBatch = async (projectId: string, evidenceIds: string[]) => {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('evidence')
    .select('*')
    .eq('project_id', projectId)
    .not('ifc_guid', 'is', null);

  if (evidenceIds.length > 0) {
    query = query.in('id', evidenceIds);
  }

  const { data, error } = await query.order('timestamp', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EvidenceRow[];
};

const safeUpdateBimStatus = async (
  evidenceId: string,
  ifcGuid: string,
  topicId: string | null
) => {
  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase
      .from('evidence')
      .update({
        bim_synced: true,
        ifc_guid: ifcGuid,
        bim_topic_id: topicId,
      })
      .eq('id', evidenceId);

    if (!error) {
      return;
    }

    const message = String(error.message ?? '').toLowerCase();
    if (
      message.includes('bim_synced') ||
      message.includes('ifc_guid') ||
      message.includes('bim_topic_id')
    ) {
      if (!hasWarnedAboutBimColumns) {
        console.warn(
          'BIM-sync metadata wordt niet opgeslagen: voeg bim_synced, ifc_guid en bim_topic_id toe aan de Supabase tabel "evidence".'
        );
        hasWarnedAboutBimColumns = true;
      }
      return;
    }

    console.warn(
      `Kon BIM-sync status niet updaten voor bewijs ${evidenceId}: ${error.message}`
    );
  } catch (error: any) {
    console.warn(
      `Kon BIM-sync status niet updaten voor bewijs ${evidenceId}: ${
        error?.message ?? 'onbekende fout'
      }`
    );
  }
};

router.post('/sync-bcf', async (req: Request, res: Response): Promise<void> => {
  try {
    const evidenceId = String(req.body?.evidenceId ?? '').trim();
    const ifcGuid = String(req.body?.ifcGuid ?? '').trim();
    const projectIdOverride = String(req.body?.projectId ?? '').trim();

    if (!evidenceId || !ifcGuid) {
      res.status(400).json({
        error: 'evidenceId en ifcGuid zijn verplicht voor BIM-koppeling.',
      });
      return;
    }

    const evidence = await readEvidence(evidenceId);

    if (!evidence) {
      res.status(404).json({ error: 'Wkb-bewijs niet gevonden.' });
      return;
    }

    const projectId = projectIdOverride || String(evidence.project_id ?? '').trim();
    const inspectionPointId = String(evidence.inspection_point_id ?? '').trim();
    const mediaUrl = String(evidence.photo_uri ?? evidence.media_uri ?? '').trim();
    const aiStatus = String(evidence.ai_status ?? 'PENDING').trim() || 'PENDING';
    const aiNotes = String(evidence.ai_notes ?? '').trim();

    if (!projectId || !inspectionPointId || !mediaUrl) {
      res.status(400).json({
        error:
          'Bewijs mist project_id, inspection_point_id of mediareferentie voor BIM-koppeling.',
      });
      return;
    }

    const result = await pushEvidenceToBimModel({
      projectId,
      evidenceId,
      ifcGuid,
      title: `Wkb Inspectie: ${inspectionPointId}`,
      description: aiNotes
        ? `AI Status: ${aiStatus}. Bevindingen: ${aiNotes}`
        : `AI Status: ${aiStatus}.`,
      mediaUrl,
      status: mapEvidenceStatusToBcfTopicStatus(aiStatus),
    });

    if (!result.success) {
      res.status(503).json({ error: 'BIM server tijdelijk onbereikbaar.' });
      return;
    }

    await safeUpdateBimStatus(evidenceId, ifcGuid, result.topicId ?? null);

    res.status(200).json({
      message: 'Succesvol aan 3D-model gekoppeld via BCF.',
      topicId: result.topicId ?? null,
    });
  } catch (error: any) {
    console.error('❌ Interne fout bij BIM route:', error?.message ?? error);
    res.status(500).json({ error: 'Interne serverfout bij BCF integratie.' });
  }
});

router.post('/sync-bcf-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = String(req.body?.projectId ?? '').trim();
    const evidenceIds = Array.isArray(req.body?.evidenceIds)
      ? req.body.evidenceIds
          .map((value: unknown) => String(value ?? '').trim())
          .filter(Boolean)
      : [];

    if (!projectId) {
      res.status(400).json({ error: 'projectId is verplicht voor batch BIM-sync.' });
      return;
    }

    const evidenceList = await readEvidenceBatch(projectId, evidenceIds);

    if (evidenceList.length === 0) {
      res.status(404).json({
        error: 'Geen IFC-gekoppelde bewijsstukken gevonden voor deze batch.',
      });
      return;
    }

    const results: Array<{
      evidenceId: string;
      success: boolean;
      topicId?: string | null;
      message?: string;
    }> = [];

    for (const evidence of evidenceList) {
      const evidenceId = String(evidence.id ?? '').trim();
      const inspectionPointId = String(evidence.inspection_point_id ?? '').trim();
      const mediaUrl = String(evidence.photo_uri ?? evidence.media_uri ?? '').trim();
      const ifcGuid = String(evidence.ifc_guid ?? '').trim();
      const aiStatus = String(evidence.ai_status ?? 'PENDING').trim() || 'PENDING';
      const aiNotes = String(evidence.ai_notes ?? '').trim();

      if (!evidenceId || !inspectionPointId || !mediaUrl || !ifcGuid) {
        results.push({
          evidenceId: evidenceId || 'onbekend',
          success: false,
          message:
            'Bewijs mist id, inspectiepunt, mediareferentie of ifc_guid voor batch BIM-sync.',
        });
        continue;
      }

      const result = await pushEvidenceToBimModel({
        projectId,
        evidenceId,
        ifcGuid,
        title: `Wkb Inspectie: ${inspectionPointId}`,
        description: aiNotes
          ? `AI Status: ${aiStatus}. Bevindingen: ${aiNotes}`
          : `AI Status: ${aiStatus}.`,
        mediaUrl,
        status: mapEvidenceStatusToBcfTopicStatus(aiStatus),
      });

      if (result.success) {
        await safeUpdateBimStatus(evidenceId, ifcGuid, result.topicId ?? null);
      }

      results.push({
        evidenceId,
        success: result.success,
        topicId: result.topicId ?? null,
        message: result.success ? 'BCF topic aangemaakt.' : 'BCF server tijdelijk onbereikbaar.',
      });
    }

    const successful = results.filter((item) => item.success).length;
    const failed = results.length - successful;
    res.status(successful > 0 ? 200 : 503).json({
      projectId,
      requested: results.length,
      successful,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('❌ Interne fout bij batch BIM route:', error?.message ?? error);
    res.status(500).json({ error: 'Interne serverfout bij batch BCF integratie.' });
  }
});

module.exports = router;
