const { Router } = require('express');
const { TenantService } = require('../services/TenantService');
const { requireAuth } = require('../middleware/auth');
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/tenants/resolve/:companyId — PUBLIEK: de login-flow heeft dit
// nodig vóórdat er een sessie bestaat. Geeft alleen de connect-config terug.
router.get('/resolve/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const config = await TenantService.resolveTenant(companyId);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/v1/tenants — BESCHERMD: geeft alle tenants terug, inclusief
// Supabase-connectgegevens. Mag nooit publiek bereikbaar zijn.
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenants = await TenantService.getAllTenants();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/tenants — BESCHERMD: maakt een nieuwe tenant aan.
// Sprint 5 — body kan { companyName, adminEmail } zijn (nieuw)
// of de oude shape { companyId, name, supabaseUrl, supabaseAnonKey }
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenant = await TenantService.createTenant(req.body);
    res.status(201).json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /api/v1/tenants/:companyId — BESCHERMD: wijzigt tenant-config.
router.put('/:companyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenant = await TenantService.updateTenant(req.params.companyId, req.body);
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
