const { Router } = require('express');
const { TenantService } = require('../services/TenantService');
import type { Request, Response } from 'express';

const router = Router();

// GET /api/v1/tenants/resolve/:companyId
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

// GET /api/v1/tenants
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenants = await TenantService.getAllTenants();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/tenants
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenant = await TenantService.createTenant(req.body);
    res.status(201).json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
