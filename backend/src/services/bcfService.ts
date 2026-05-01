const axios = require('axios');
const { backendConfig } = require('../config');

type BimEvidencePayload = {
  projectId: string;
  evidenceId: string;
  ifcGuid: string;
  title: string;
  description: string;
  mediaUrl: string;
  status: 'Open' | 'Closed';
};

const mapEvidenceStatusToBcfTopicStatus = (status?: string | null): 'Open' | 'Closed' => {
  const normalized = String(status ?? '').trim().toUpperCase();
  return normalized === 'APPROVED' || normalized === 'PASSED' ? 'Closed' : 'Open';
};

const createBcfClient = () => {
  if (!backendConfig.bcfServerUrl || !backendConfig.bcfApiToken) {
    throw new Error('BCF configuratie ontbreekt in .env');
  }

  return axios.create({
    baseURL: backendConfig.bcfServerUrl,
    timeout: backendConfig.bcfTimeoutMs,
    headers: {
      Authorization: `Bearer ${backendConfig.bcfApiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
};

const buildBcfTopicPayload = (payload: BimEvidencePayload) => ({
  topic_type: 'Wkb Inspection',
  topic_status: payload.status,
  title: payload.title,
  description: `${payload.description}\n\nBekijk Wkb-bewijs: ${payload.mediaUrl}`,
  creation_author: 'Wkb Snap & Sync App',
  bim_snippet: {
    reference: payload.mediaUrl,
    reference_schema: 'URL',
    snippet_type: 'WkbEvidence',
    is_external: true,
  },
  viewpoint: {
    components: {
      selection: [
        {
          ifc_guid: payload.ifcGuid,
        },
      ],
    },
  },
});

const pushEvidenceToBimModel = async (
  payload: BimEvidencePayload
): Promise<{ success: boolean; topicId?: string | null; raw?: unknown }> => {
  try {
    const client = createBcfClient();

    console.log(
      `🏢 Start BCF-sync voor IFC object [${payload.ifcGuid}] in project [${payload.projectId}]...`
    );
    const bcfTopic = buildBcfTopicPayload(payload);

    const response = await client.post(
      `/projects/${encodeURIComponent(payload.projectId)}/topics`,
      bcfTopic
    );

    const created =
      response.status === 200 || response.status === 201 || response.status === 202;

    return {
      success: created,
      topicId: response.data?.guid ?? response.data?.topic_guid ?? null,
      raw: response.data,
    };
  } catch (error: any) {
    console.error(
      '❌ Fout bij BCF/BIM synchronisatie:',
      error?.response?.data || error?.message
    );
    return {
      success: false,
      topicId: null,
      raw: error?.response?.data,
    };
  }
};

module.exports = {
  buildBcfTopicPayload,
  mapEvidenceStatusToBcfTopicStatus,
  pushEvidenceToBimModel,
};
