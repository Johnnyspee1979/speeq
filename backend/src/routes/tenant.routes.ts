const { Router } = require('express');
const { TenantService } = require('../services/TenantService');

const router = Router();

router.get('/resolve/:companyId', async (req: any, res: any) => {
  try {
    const config = await TenantService.resolveTenant(req.params.companyId);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Bedrijfs-ID onbekend' });
  }
});

module.exports = { tenantRoutes: router };
