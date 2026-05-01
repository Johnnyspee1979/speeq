import type { Request, Response } from 'express';

const { Router } = require('express');
const {
  getAuthenticatedUserContext,
} = require('../services/authContextService');
const {
  upsertNotificationSubscription,
} = require('../services/reviewNotificationService');

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const expoPushToken =
      typeof req.body?.expoPushToken === 'string' ? req.body.expoPushToken.trim() : '';
    const platform =
      typeof req.body?.platform === 'string' ? req.body.platform.trim() : 'unknown';
    const projectId =
      typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
    const deviceLabel =
      typeof req.body?.deviceLabel === 'string' ? req.body.deviceLabel.trim() : '';

    if (!expoPushToken) {
      res.status(400).json({ error: 'expoPushToken ontbreekt.' });
      return;
    }

    const context = await getAuthenticatedUserContext(req.headers.authorization);

    await upsertNotificationSubscription({
      userId: context.userId,
      projectId: projectId || null,
      expoPushToken,
      platform,
      deviceLabel: deviceLabel || null,
    });

    res.status(200).json({
      success: true,
      userId: context.userId,
      projectId: projectId || null,
    });
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({
      error:
        error?.message ?? 'Push-registratie kon niet worden opgeslagen.',
    });
  }
});

module.exports = router;
