import type { Request, Response } from 'express';

const { Router } = require('express');
const {
  buildKiKEvidencePayload,
  fetchKikBorgingsplan,
  pushEvidenceBatchToKiK,
  pushEvidenceToKiK,
} = require('../services/kikService');

const router = Router();

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

router.get('/borgingsplan/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId ?? '').trim();

    if (!projectId) {
      res.status(400).json({ error: 'projectId ontbreekt.' });
      return;
    }

    const borgingsplan = await fetchKikBorgingsplan(projectId);
    res.status(200).json(borgingsplan);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'Fout bij ophalen van het KiK-borgingsplan.',
    });
  }
});

router.post('/evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
    const evidence = Array.isArray(req.body?.evidence) ? req.body.evidence : [];

    if (!projectId || evidence.length === 0) {
      res.status(400).json({ error: 'projectId of evidence ontbreekt.' });
      return;
    }

    const result = await pushEvidenceBatchToKiK(projectId, evidence);
    const statusCode = result.failed > 0 && result.submitted === 0 ? 503 : 200;

    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'Fout bij pushen van bewijs naar KiK.',
    });
  }
});

router.post('/sync-evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const source =
      req.body?.evidenceData && typeof req.body.evidenceData === 'object'
        ? req.body.evidenceData
        : req.body;
    const projectId =
      readString(req.body?.projectId) ||
      readString(req.body?.project_id) ||
      readString(source?.projectId) ||
      readString(source?.project_id);

    const payload = buildKiKEvidencePayload(projectId, {
      id:
        source?.evidenceId ??
        source?.evidence_id ??
        source?.id,
      project_id:
        source?.projectId ??
        source?.project_id ??
        projectId,
      inspection_point_id:
        source?.inspectionPointId ??
        source?.inspection_point_id,
      photo_uri:
        source?.mediaUrl ??
        source?.media_url ??
        source?.photo_uri,
      exif_hash: source?.exifHash ?? source?.exif_hash,
      timestamp: source?.timestamp,
      latitude:
        source?.gps?.latitude ??
        source?.gps?.lat ??
        source?.latitude,
      longitude:
        source?.gps?.longitude ??
        source?.gps?.lng ??
        source?.longitude,
      ai_status:
        source?.aiValidationStatus ??
        source?.ai_status,
      field_note:
        source?.notes ??
        source?.fieldNote ??
        source?.field_note,
    });

    if (!payload) {
      res.status(400).json({
        error: 'Incomplete bewijslast payload voor KiK-synchronisatie.',
      });
      return;
    }

    const result = await pushEvidenceToKiK(payload);
    res.status(result.success ? 200 : result.retryPending ? 503 : 422).json(result);
  } catch (error: any) {
    console.error('❌ Interne serverfout bij KiK-synchronisatie:', error.message);
    res.status(500).json({ error: 'Interne serverfout bij KiK API koppeling.' });
  }
});

module.exports = router;
