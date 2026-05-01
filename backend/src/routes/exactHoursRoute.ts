import type { Request, Response } from 'express';

const { backendConfig } = require('../config');
const { logWkbHoursInExact } = require('../services/exactOnlineService');

type ParsedExactBookHoursRequest =
  | {
      ok: true;
      divisionId: string;
      accessToken: string;
      transaction: {
        projectId: string;
        employeeId?: string;
        hours: number;
        notes?: string;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const getHeaderValue = (req: Request, keys: string[]) => {
  for (const key of keys) {
    const value = req.headers[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const parseAuthorizationHeader = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || value;
};

const resolveExactCredentials = (req: Request) => {
  const divisionId =
    getHeaderValue(req, ['x-exact-division-id', 'divisionid']) ||
    readString(req.query?.divisionId) ||
    readString(req.body?.divisionId) ||
    readString(backendConfig.exactDivisionId);

  const accessToken =
    parseAuthorizationHeader(getHeaderValue(req, ['authorization'])) ||
    getHeaderValue(req, ['x-exact-access-token', 'accesstoken']) ||
    readString(req.query?.accessToken) ||
    readString(req.body?.accessToken);

  return { divisionId, accessToken };
};

const parseExactBookHoursRequest = (req: Request): ParsedExactBookHoursRequest => {
  const { divisionId, accessToken } = resolveExactCredentials(req);
  const projectId = readString(req.body?.projectId);
  const employeeId = readString(req.body?.employeeId);
  const notes = readString(req.body?.notes);
  const parsedHours = Number(req.body?.hours);

  if (!divisionId) {
    return {
      ok: false,
      status: 400,
      error:
        'Exact divisie ontbreekt. Lever divisionId aan of configureer EXACT_DIVISION_ID.',
    };
  }

  if (!accessToken) {
    return {
      ok: false,
      status: 400,
      error:
        'Exact access token ontbreekt. Lever accessToken aan of gebruik een Authorization header.',
    };
  }

  if (!projectId || !Number.isFinite(parsedHours) || parsedHours <= 0) {
    return {
      ok: false,
      status: 400,
      error: 'Incomplete payload voor Exact Online synchronisatie.',
    };
  }

  return {
    ok: true,
    divisionId,
    accessToken,
    transaction: {
      projectId,
      hours: parsedHours,
      ...(employeeId ? { employeeId } : {}),
      ...(notes ? { notes } : {}),
    },
  };
};

const handleExactBookHours = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsed = parseExactBookHoursRequest(req);

    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.error });
      return;
    }

    const result = await logWkbHoursInExact(
      parsed.divisionId,
      parsed.accessToken,
      parsed.transaction
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        divisionId: parsed.divisionId,
        message: 'Projectadministratie succesvol bijgewerkt in Exact Online.',
      });
      return;
    }

    res.status(result.retryPending ? 503 : 502).json({
      error:
        result.message ??
        'Exact Online weigerde de urenregistratie of de rate limit is bereikt.',
      retryStatus: result.retryPending ? 'RETRY_PENDING' : 'FAILED',
    });
  } catch (error: any) {
    console.error(
      '❌ Fout in de Exact Online route:',
      error?.message ?? error
    );
    res.status(500).json({
      error: 'Interne serverfout bij ERP synchronisatie.',
    });
  }
};

module.exports = {
  handleExactBookHours,
  parseAuthorizationHeader,
  parseExactBookHoursRequest,
  resolveExactCredentials,
};
