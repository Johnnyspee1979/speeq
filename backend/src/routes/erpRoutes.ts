import type { Request, Response } from 'express';

const { Router } = require('express');
const { handleExactBookHours } = require('./exactHoursRoute');

const router = Router();

router.post('/exact-online/book-hours', (req: Request, res: Response) =>
  handleExactBookHours(req, res)
);

module.exports = router;
