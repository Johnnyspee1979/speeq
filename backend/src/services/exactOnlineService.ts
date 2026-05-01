const axios = require('axios');
const { backendConfig } = require('../config');

type ExactTimeTransaction = {
  projectId: string;
  employeeId?: string;
  hours: number;
  notes?: string;
};

type ExactResult = {
  success: boolean;
  retryPending: boolean;
  message?: string;
};

/**
 * Genereert een dynamische Exact Online API-client.
 * Exact Online vereist dat elke API-call een specifieke division bevat.
 */
const createExactClient = (divisionId: string, accessToken: string) =>
  axios.create({
    baseURL: `https://start.exactonline.nl/api/v1/${divisionId}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: backendConfig.exactTimeoutMs,
  });

const isRetryableExactError = (error: any) => {
  const status = Number(error?.response?.status);
  const code = String(error?.code ?? '').toUpperCase();

  return (
    [408, 425, 429, 500, 502, 503, 504].includes(status) ||
    ['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
      code
    )
  );
};

/**
 * Boekt de uren van een Wkb-inspectie direct op het juiste project in Exact Online.
 */
const logWkbHoursInExact = async (
  divisionId: string,
  accessToken: string,
  transaction: ExactTimeTransaction
): Promise<ExactResult> => {
  try {
    console.log(
      `⏱️ Uren synchroniseren naar Exact Online voor divisie ${divisionId}, project ${transaction.projectId}...`
    );

    const client = createExactClient(divisionId, accessToken);
    const payload = {
      Project: transaction.projectId,
      Employee: transaction.employeeId ?? '',
      Hours: transaction.hours,
      Notes:
        transaction.notes?.trim() ||
        'Uren automatisch geregistreerd via de Wkb Snap & Sync App',
    };

    const response = await client.post('/project/TimeTransactions', payload);

    return {
      success: response.status === 200 || response.status === 201,
      retryPending: false,
    };
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message?.value ??
      error?.response?.data?.message ??
      error?.message ??
      'Exact Online synchronisatie mislukt.';

    console.error('❌ Exact Online API fout:', message);

    return {
      success: false,
      retryPending: isRetryableExactError(error),
      message,
    };
  }
};

module.exports = {
  createExactClient,
  isRetryableExactError,
  logWkbHoursInExact,
};
