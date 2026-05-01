import type { Request, Response } from 'express';

const { Router } = require('express');
const { generateBevoegdGezagDossier } = require('../services/dossierGenerator');
const {
  generateConsumerDossier,
  getConsumerDossierStatus,
  IncompleteConsumerDossierError,
} = require('../services/consumerDossierGenerator');

const router = Router();

router.get(
  '/bevoegd-gezag/:projectId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = String(req.params.projectId ?? '').trim();

      if (!projectId) {
        res.status(400).json({ error: 'projectId ontbreekt.' });
        return;
      }

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
  handleConsumerDossierDownload
);

router.get('/consument/export/:projectId', handleConsumerDossierDownload);

module.exports = router;
