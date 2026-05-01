import type { Request, Response } from 'express';

const { Router } = require('express');
const { fetchAfasProjects, bookAfasHours } = require('../services/afasService');

const router = Router();

const getHeaderValue = (req: Request, keys: string[]) => {
  for (const key of keys) {
    const value = req.headers[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const resolveAfasCredentials = (req: Request) => {
  const environmentId =
    getHeaderValue(req, ['x-afas-environment-id', 'environmentid']) ||
    (typeof req.query.environmentId === 'string' ? req.query.environmentId.trim() : undefined) ||
    (typeof req.body?.environmentId === 'string' ? req.body.environmentId.trim() : undefined);

  const token =
    getHeaderValue(req, ['x-afas-token', 'token']) ||
    (typeof req.query.token === 'string' ? req.query.token.trim() : undefined) ||
    (typeof req.body?.token === 'string' ? req.body.token.trim() : undefined);

  return { environmentId, token };
};

router.get('/projects', async (req: Request, res: Response): Promise<void> => {
  try {
    const { environmentId, token } = resolveAfasCredentials(req);

    const projects = await fetchAfasProjects(environmentId, token);
    res.status(200).json({
      success: true,
      environmentId: environmentId ?? null,
      count: projects.length,
      projects,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'Fout bij het communiceren met AFAS ERP.',
    });
  }
});

router.post('/book-hours', async (req: Request, res: Response): Promise<void> => {
  try {
    const { environmentId, token } = resolveAfasCredentials(req);
    const { projectId, employeeId, hours, date } = req.body ?? {};
    const parsedHours = Number(hours);

    if (!projectId || !employeeId || !date || !Number.isFinite(parsedHours) || parsedHours <= 0) {
      res.status(400).json({ error: 'Incomplete urenregistratie payload.' });
      return;
    }

    const success = await bookAfasHours(
      typeof environmentId === 'string' ? environmentId : undefined,
      typeof token === 'string' ? token : undefined,
      String(projectId),
      String(employeeId),
      parsedHours,
      String(date)
    );

    if (success) {
      res.status(200).json({
        success: true,
        message: 'Uren succesvol gesynchroniseerd met AFAS.',
      });
      return;
    }

    res.status(502).json({
      error: 'AFAS weigerde de urenregistratie.',
      retryStatus: 'RETRY_PENDING',
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'Interne serverfout bij urenregistratie.',
    });
  }
});

module.exports = router;
