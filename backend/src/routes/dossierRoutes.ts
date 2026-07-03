import type { Request, Response } from 'express';

const { Router } = require('express');
const { requireReviewer } = require('../middleware/requireReviewer');
const {
  getAuthenticatedUserContext,
  assertProjectReviewAccess,
} = require('../services/authContextService');
const { generateBevoegdGezagDossier } = require('../services/dossierGenerator');
const { buildDossier } = require('../services/dossierService');
const {
  generateConsumerDossier,
  getConsumerDossierStatus,
  IncompleteConsumerDossierError,
} = require('../services/consumerDossierGenerator');

const router = Router();

// Project-scope naast de reviewer-rolcheck: alleen de eigenaar/kwaliteitsborger
// van dit project mag het dossier genereren/downloaden. Voorkomt dat een reviewer
// dossiers (met GPS, foto's, notities) van andermans projecten kan opvragen.
const assertDossierAccess = async (req: Request, projectId: string): Promise<void> => {
  const context = await getAuthenticatedUserContext(req.headers.authorization);
  await assertProjectReviewAccess(projectId, context);
};

// Adobe-dossiermotor: bouw/ververs het PDF-dossier (Word-sjabloon → Adobe → PDF),
// sla het op in de `dossiers`-bucket en koppel het aan het project (dossier_url).
router.post(
  '/genereer/:projectId',
  requireReviewer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = String(req.params.projectId ?? '').trim();
      if (!projectId) {
        res.status(400).json({ error: 'projectId ontbreekt.' });
        return;
      }

      await assertDossierAccess(req, projectId);

      const result = await buildDossier(projectId);

      if (result.ok) {
        res.status(200).json({
          url: result.url,
          path: result.path,
          evidenceCount: result.evidenceCount,
        });
        return;
      }

      // Ontbrekende Adobe-config is geen serverfout maar een configuratiestaat.
      res.status(result.skipped ? 503 : 502).json({ error: result.reason });
    } catch (error: any) {
      if (error?.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error(
        '❌ Onverwachte fout bij Adobe-dossiergeneratie:',
        error?.message ?? error
      );
      res.status(500).json({
        error: 'Interne serverfout bij het genereren van het dossier.',
      });
    }
  }
);

router.get(
  '/bevoegd-gezag/:projectId',
  requireReviewer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = String(req.params.projectId ?? '').trim();

      if (!projectId) {
        res.status(400).json({ error: 'projectId ontbreekt.' });
        return;
      }

      await assertDossierAccess(req, projectId);

      const pdfBuffer = await generateBevoegdGezagDossier(projectId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Wkb_Dossier_Bevoegd_Gezag_${projectId}.pdf"`
      );

      res.status(200).send(pdfBuffer);
      console.log(
        `✅ Dossier Bevoegd Gezag (PDF) succesvol gegenereerd voor project: ${projectId}`
      );
    } catch (error: any) {
      if (error?.statusCode) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error(
        '❌ Fout bij het genereren van het PDF Dossier:',
        error?.message ?? error
      );
      res.status(500).json({
        error: 'Interne serverfout bij het genereren van het Wkb-dossier.',
      });
    }
  }
);

const handleConsumerDossierDownload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const projectId = String(req.params.projectId ?? '').trim();

    if (!projectId) {
      res.status(400).json({ error: 'projectId ontbreekt.' });
      return;
    }

    await assertDossierAccess(req, projectId);

    const pdfBuffer = await generateConsumerDossier(projectId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Wkb_Consumentendossier_${projectId}.pdf"`
    );

    res.status(200).send(pdfBuffer);
    console.log(
      `✅ Consumentendossier (PDF) succesvol gegenereerd voor project: ${projectId}`
    );
  } catch (error: any) {
    if (error instanceof IncompleteConsumerDossierError) {
      res.status(error.statusCode ?? 409).json({
        error: error.message,
        issues: error.issues,
      });
      return;
    }

    if (error?.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error(
      '❌ Fout bij het genereren van het consumentendossier:',
      error?.message ?? error
    );
    res.status(500).json({
      error: 'Interne serverfout bij het genereren van het consumentendossier.',
    });
  }
};

router.get(
  '/consument/status/:projectId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = String(req.params.projectId ?? '').trim();

      if (!projectId) {
        res.status(400).json({ error: 'projectId ontbreekt.' });
        return;
      }

      const status = await getConsumerDossierStatus(projectId);
      res.status(200).json(status);
    } catch (error: any) {
      console.error(
        '❌ Fout bij ophalen consumentendossier-status:',
        error?.message ?? error
      );
      res.status(500).json({
        error: 'Interne serverfout bij het ophalen van de consumentendossier-status.',
      });
    }
  }
);

router.get(
  '/consument/:projectId',
  requireReviewer,
  handleConsumerDossierDownload
);

router.get(
  '/consument/export/:projectId',
  requireReviewer,
  handleConsumerDossierDownload
);

module.exports = router;
