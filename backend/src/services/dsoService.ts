const axios = require('axios');
const { backendConfig } = require('../config');
const { mapToStamBouwmelding, mapToStamGereedmelding } = require('./stamMapper');

type WkbProjectData = {
  projectId: string;
  initiatorDetails: {
    name: string;
    address: string;
    email: string;
  };
  location: {
    kadastraleAanduiding: string;
    coordinates: { lat: number; lng: number };
  };
  kwaliteitsborgerId: string;
  instrumentId: string;
};

type WkbGereedmeldingData = WkbProjectData & {
  ingebruiknameDatum: string;
};

const submitMeldingToDSO = async (
  projectData: WkbProjectData | WkbGereedmeldingData,
  primaryDocumentUrl: string,
  secondaryDocumentUrl: string,
  type: 'bouwmelding' | 'gereedmelding'
) => {
  try {
    if (!backendConfig.dkaInternalUrl || !backendConfig.dkaInternalApiKey) {
      throw new Error('DKA configuratie ontbreekt in .env');
    }

    console.log(
      `🏛️ Genereren ${type} STAM-payload voor project ${projectData.projectId}...`
    );
    const stamPayload =
      type === 'gereedmelding'
        ? mapToStamGereedmelding(
            projectData as WkbGereedmeldingData,
            primaryDocumentUrl,
            secondaryDocumentUrl
          )
        : mapToStamBouwmelding(
            projectData as WkbProjectData,
            primaryDocumentUrl,
            secondaryDocumentUrl
          );

    console.log(
      `🔒 Verzenden naar Digikoppeling-adapter op ${backendConfig.dkaInternalUrl}...`
    );

    const response = await axios.post(backendConfig.dkaInternalUrl, stamPayload, {
      timeout: backendConfig.dkaTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backendConfig.dkaInternalApiKey}`,
      },
    });

    const accepted = response.status === 200 || response.status === 202;

    return {
      success: accepted,
      transactionId:
        response.data?.transactionId ??
        response.data?.referenceId ??
        response.data?.referentie ??
        null,
      status: response.status,
      raw: response.data,
    };
  } catch (error: any) {
    console.error(
      '❌ Fout bij het indienen van de STAM-melding via DKA:',
      error.response?.data || error.message
    );
    throw new Error(
      'STAM integratie gefaald. Controleer de Digikoppeling-adapter logbestanden.'
    );
  }
};

const submitBouwmeldingToDSO = async (
  projectData: WkbProjectData,
  borgingsplanUrl: string,
  risicoUrl: string
) => submitMeldingToDSO(projectData, borgingsplanUrl, risicoUrl, 'bouwmelding');

const submitGereedmeldingToDSO = async (
  projectData: WkbGereedmeldingData,
  dossierBevoegdGezagUrl: string,
  verklaringKwaliteitsborgerUrl: string
) =>
  submitMeldingToDSO(
    projectData,
    dossierBevoegdGezagUrl,
    verklaringKwaliteitsborgerUrl,
    'gereedmelding'
  );

module.exports = {
  submitMeldingToDSO,
  submitBouwmeldingToDSO,
  submitGereedmeldingToDSO,
};
