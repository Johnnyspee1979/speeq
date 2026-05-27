/**
 * makerRoutes — Maker-only endpoints voor klant-onboarding.
 *
 * POST /api/maker/send-welcome-email
 *   Body: { toEmail, toName, bedrijfsnaam, wachtwoord, loginUrl, accentKleur, logoUrl? }
 *   Auth: vereist JWT + check dat user.email = johnny@speesolutions.com (maker-only).
 *   Returns: { ok: true } of { ok: false, error: string }
 *
 * Stuurt branded welkom-mail via Resend (zie emailService.sendWelcomeEmail).
 */

import type { Request, Response } from 'express';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

const MAKER_EMAILS = new Set([
  'johnny@speesolutions.com',
  'johnny@speesolutions.nl',
]);

router.post('/send-welcome-email', requireAuth, async (req: Request, res: Response) => {
  try {
    // Maker-only check — voorkomt dat een normale user de wizard misbruikt.
    const userEmail = (req as Request & { user?: { email?: string } }).user?.email?.toLowerCase() ?? '';
    if (!MAKER_EMAILS.has(userEmail)) {
      return res.status(403).json({ ok: false, error: 'Alleen de Maker mag welkom-mails versturen.' });
    }

    const {
      toEmail, toName, bedrijfsnaam, wachtwoord, loginUrl, accentKleur, logoUrl,
    } = (req.body ?? {}) as Record<string, unknown>;

    // Strikte validatie — geen lege of foute typen
    if (typeof toEmail !== 'string' || !toEmail.includes('@')) {
      return res.status(400).json({ ok: false, error: 'toEmail ontbreekt of ongeldig.' });
    }
    if (typeof toName !== 'string' || !toName.trim()) {
      return res.status(400).json({ ok: false, error: 'toName ontbreekt.' });
    }
    if (typeof bedrijfsnaam !== 'string' || !bedrijfsnaam.trim()) {
      return res.status(400).json({ ok: false, error: 'bedrijfsnaam ontbreekt.' });
    }
    if (typeof wachtwoord !== 'string' || wachtwoord.length < 6) {
      return res.status(400).json({ ok: false, error: 'wachtwoord ontbreekt of te kort.' });
    }
    if (typeof loginUrl !== 'string' || !loginUrl.startsWith('http')) {
      return res.status(400).json({ ok: false, error: 'loginUrl ontbreekt of ongeldig.' });
    }
    if (typeof accentKleur !== 'string' || !accentKleur.startsWith('#')) {
      return res.status(400).json({ ok: false, error: 'accentKleur moet een hex-code zijn.' });
    }

    const result = await sendWelcomeEmail({
      toEmail: toEmail.trim().toLowerCase(),
      toName: toName.trim(),
      bedrijfsnaam: bedrijfsnaam.trim(),
      wachtwoord,
      loginUrl,
      accentKleur,
      logoUrl: typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : null,
    });

    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[makerRoutes] /send-welcome-email fout:', msg);
    return res.status(500).json({ ok: false, error: msg });
  }
});

module.exports = router;
