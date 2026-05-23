/**
 * voiceRoutes — POST /api/voice/tts
 *
 * Body: { text: string }
 * Returns: { url: string, cached: boolean, durationMs: number }
 *
 * Auth: vereist JWT via requireAuth middleware (zelfde stack als andere routes).
 * Rate-limit: vooralsnog geen — Supabase cache zorgt voor 90% besparing op
 * duplicate teksten. Bij abuse-issues: per-tenant character-quotum toevoegen.
 *
 * Validatie:
 *   - text moet string zijn van 1..500 chars
 *   - lange teksten (>500) zouden via een aparte chunking-flow moeten lopen
 *
 * Onderdeel van docs/plans/2026-05-22-elevenlabs-voice-integration-design.md
 */

import type { Request, Response } from 'express';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { ElevenLabsService } = require('../services/elevenLabsService');

const router = express.Router();

const MAX_TEXT_LENGTH = 500;

router.post('/tts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text } = (req.body ?? {}) as { text?: unknown };

    if (typeof text !== 'string') {
      return res.status(400).json({
        error: 'Body moet { text: string } zijn.',
      });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Tekst mag niet leeg zijn.' });
    }

    if (trimmed.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Tekst is te lang (${trimmed.length} > ${MAX_TEXT_LENGTH}). Splits 'm op.`,
      });
    }

    const result = await ElevenLabsService.getSpokenAudioUrl(trimmed);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout';
    console.error('[voiceRoutes] /tts faalde:', message);
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/voice/cache-stats — diagnose, voor admin / monitoring.
 */
router.get('/cache-stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await ElevenLabsService.getCacheStats();
    return res.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout';
    return res.status(500).json({ error: message });
  }
});

module.exports = router;
