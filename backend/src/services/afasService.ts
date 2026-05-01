const axios = require('axios');
const { backendConfig } = require('../config');

type AfasProject = {
  projectId: string;
  description: string;
};

type AfasClientConfig = {
  environmentId: string;
  token: string;
};

const resolveAfasConfig = (
  environmentId?: string,
  token?: string
): AfasClientConfig => {
  const resolvedEnvironmentId = environmentId?.trim() || backendConfig.afasEnvironmentId;
  const resolvedToken = token?.trim() || backendConfig.afasToken;

  if (!resolvedEnvironmentId || !resolvedToken) {
    throw new Error('AFAS configuratie ontbreekt. Voeg environmentId en token toe.');
  }

  return {
    environmentId: resolvedEnvironmentId,
    token: resolvedToken,
  };
};

/**
 * Genereert een tenant-aware AFAS API-client per aannemer.
 */
const createAfasClient = (environmentId: string, token: string) => {
  const baseURL = `https://${environmentId}.restapi.afas.online/profitrestservices/v1`;

  return axios.create({
    baseURL,
    headers: {
      Authorization: `AfasToken ${Buffer.from(token).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    timeout: backendConfig.afasTimeoutMs,
  });
};

const fetchAfasProjects = async (
  environmentId?: string,
  token?: string
): Promise<AfasProject[]> => {
  try {
    const config = resolveAfasConfig(environmentId, token);
    const client = createAfasClient(config.environmentId, config.token);

    console.log(`🔄 Ophalen van actieve projecten uit AFAS Profit voor tenant ${config.environmentId}...`);

    const response = await client.get('/get/Wkb_Projecten', {
      params: {
        skip: 0,
        take: 100,
      },
    });

    const rows = Array.isArray(response.data?.rows) ? response.data.rows : [];

    return rows.map((row: Record<string, unknown>) => ({
      projectId:
        (typeof row.ProjectId === 'string' && row.ProjectId) ||
        (typeof row.Project === 'string' && row.Project) ||
        'onbekend-project',
      description:
        (typeof row.Description === 'string' && row.Description) ||
        (typeof row.Omschrijving === 'string' && row.Omschrijving) ||
        'Zonder omschrijving',
    }));
  } catch (error: any) {
    console.error('❌ Fout bij ophalen AFAS projecten:', error.response?.data || error.message);
    throw new Error('Kon projecten niet synchroniseren met AFAS.');
  }
};

const bookAfasHours = async (
  environmentId: string | undefined,
  token: string | undefined,
  projectId: string,
  employeeId: string,
  hours: number,
  date: string
): Promise<boolean> => {
  try {
    const config = resolveAfasConfig(environmentId, token);
    const client = createAfasClient(config.environmentId, config.token);

    console.log(
      `⏱️ Uren boeken in AFAS voor tenant ${config.environmentId}, project ${projectId} (Medewerker: ${employeeId})...`
    );

    const payload = {
      PtRealization: {
        Element: {
          Fields: {
            Project: projectId,
            Employee: employeeId,
            Date: date,
            Hours: hours,
            ItemCode: 'WKB-INSPECTIE',
            Remark: 'Uren automatisch geregistreerd via de Wkb Snap & Sync App',
          },
        },
      },
    };

    const response = await client.post('/connectors/PtRealization', payload);
    return response.status === 200 || response.status === 201;
  } catch (error: any) {
    console.error(
      `❌ Fout bij uren boeken op AFAS omgeving ${environmentId || backendConfig.afasEnvironmentId}:`,
      error.response?.data || error.message
    );
    return false;
  }
};

module.exports = {
  createAfasClient,
  fetchAfasProjects,
  bookAfasHours,
};
