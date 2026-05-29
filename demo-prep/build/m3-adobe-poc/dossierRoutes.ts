/**
 * Dossier-routes voor de backend.
 * Mount onder /api/v1/dossiers.
 */

import { Router, Request, Response } from 'express';
import { generateDossierPdf, RendererType } from './dossierPdfService';
import { requireAuth } from '../middleware/auth'; // bestaande auth middleware

const router = Router();

/**
 * POST /api/v1/dossiers/:id/generate-pdf
 *
 * Body (optional):
 *   { renderer: 'auto'|'local'|'adobe', dryRun: boolean }
 *
 * Response:
 *   { ok: true, pdf_url: string }
 *   { ok: false, error: string }
 */
router.post('/:id/generate-pdf', requireAuth, async (req: Request, res: Response) => {
  const dossierId = req.params.id;
  const renderer: RendererType = (req.body?.renderer as RendererType) ?? 'auto';
  const dryRun: boolean = req.body?.dryRun === true;

  try {
    console.log(`[POST /dossiers/${dossierId}/generate-pdf] start (renderer=${renderer}, dryRun=${dryRun})`);
    const pdfUrl = await generateDossierPdf(dossierId, { renderer, dryRun });
    console.log(`[POST /dossiers/${dossierId}/generate-pdf] success`);
    res.json({ ok: true, pdf_url: pdfUrl });
  } catch (e: any) {
    console.error(`[POST /dossiers/${dossierId}/generate-pdf] error:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/v1/dossiers/:id/status
 *
 * Geeft snel status terug zonder regeneratie.
 */
router.get('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const dossierId = req.params.id;
  try {
    // Korte query in service-layer (out-of-scope voor deze POC, placeholder)
    res.json({ ok: true, dossier_id: dossierId, status: 'TBD' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
