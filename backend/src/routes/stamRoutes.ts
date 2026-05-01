import type { Request, Response } from 'express';

const { Router } = require('express');
const {
  submitBouwmeldingToDSO,
  submitGereedmeldingToDSO,
} = require('../services/dsoService');

const router = Router();

router.post('/bouwmelding', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectData = req.body?.projectData;
    const borgingsplanUrl = req.body?.borgingsplanUrl;
    const risicoUrl = req.body?.risicoUrl;

    if (
      !projectData ||
      typeof borgingsplanUrl !== 'string' ||
      !borgingsplanUrl.trim() ||
      typeof risicoUrl !== 'string' ||
      !risicoUrl.trim()
    ) {
      res.status(400).json({
        error: 'projectData, borgingsplanUrl en risicoUrl zijn verplicht.',
      });
      return;
    }

    const result = await submitBouwmeldingToDSO(
      projectData,
      borgingsplanUrl,
      risicoUrl
    );

    res.status(result.success ? 202 : 502).json(result);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'STAM bouwmelding gefaald.',
    });
  }
});

router.post('/gereedmelding', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectData = req.body?.projectData;
    const dossierBevoegdGezagUrl =
      req.body?.dossierBevoegdGezagUrl ?? req.body?.borgingsplanUrl;
    const verklaringKwaliteitsborgerUrl =
      req.body?.verklaringKwaliteitsborgerUrl ?? req.body?.risicoUrl;

    if (
      !projectData ||
      typeof dossierBevoegdGezagUrl !== 'string' ||
      !dossierBevoegdGezagUrl.trim() ||
      typeof verklaringKwaliteitsborgerUrl !== 'string' ||
      !verklaringKwaliteitsborgerUrl.trim()
    ) {
      res.status(400).json({
        error:
          'projectData, dossierBevoegdGezagUrl en verklaringKwaliteitsborgerUrl zijn verplicht.',
      });
      return;
    }

    const result = await submitGereedmeldingToDSO(
      projectData,
      dossierBevoegdGezagUrl,
      verklaringKwaliteitsborgerUrl
    );

    res.status(result.success ? 202 : 502).json(result);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'STAM gereedmelding gefaald.',
    });
  }
});

module.exports = router;
