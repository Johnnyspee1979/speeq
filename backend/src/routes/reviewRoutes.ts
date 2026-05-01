import type { Request, Response } from 'express';

const { Router } = require('express');
const { updateEvidenceReviewStatus } = require('../services/reviewService');

const router = Router();

router.post(
  '/evidence/:evidenceId/status',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const evidenceId = Number(req.params.evidenceId);
      const result = await updateEvidenceReviewStatus({
        authorizationHeader: req.headers.authorization,
        evidenceId,
        status: req.body?.status,
        notes: req.body?.notes,
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(error?.statusCode ?? 500).json({
        error:
          error?.message ??
          'Reviewstatus kon niet worden bijgewerkt.',
      });
    }
  }
);

module.exports = router;
