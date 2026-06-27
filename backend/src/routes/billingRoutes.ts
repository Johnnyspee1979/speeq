import type { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// billingRoutes — ontvangt Lemon-Squeezy-webhooks en werkt de tenant bij.
// ─────────────────────────────────────────────────────────────────────────────
// Mount met een RAW body-parser (express.raw), want de HMAC-handtekening wordt
// over de ruwe bytes berekend — niet over geparste JSON. Zie index.ts.
//
// Fail-closed: zonder LEMONSQUEEZY_WEBHOOK_SECRET weigert de route (503), en een
// ongeldige handtekening → 401. De tenant moet al bestaan (handmatige
// provisioning); de checkout-link draagt de tenant_id mee als custom_data.

const express = require('express');
const {
  verifySignature,
  isAbonnementEvent,
  parseWebhook,
} = require('../services/lemonSqueezyWebhook');
const { TenantService } = require('../services/TenantService');

const router = express.Router();

router.post('/lemon-squeezy/webhook', async (req: Request, res: Response) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Webhook is niet geconfigureerd.' });
  }

  const signature = req.header('X-Signature');
  const raw: any = (req as any).body; // Buffer dankzij express.raw
  if (!verifySignature(raw, signature, secret)) {
    return res.status(401).json({ error: 'Ongeldige handtekening.' });
  }

  let payload: any;
  try {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');
    payload = JSON.parse(text);
  } catch {
    return res.status(400).json({ error: 'Ongeldige payload.' });
  }

  // Niet-abonnement-events bevestigen we netjes zodat Lemon Squeezy niet retryt.
  if (!isAbonnementEvent(payload)) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const update = parseWebhook(payload);
  try {
    await TenantService.updateAbonnement(update.tenantId, update);
  } catch (err: any) {
    // Non-2xx → Lemon Squeezy probeert het later opnieuw (bv. tenant nog niet
    // geprovisioneerd op het moment van het event).
    console.error('[billing] updateAbonnement faalde', err?.message ?? err);
    return res.status(500).json({ error: 'Kon abonnement niet bijwerken.' });
  }

  return res.status(200).json({ ok: true });
});

module.exports = router;
