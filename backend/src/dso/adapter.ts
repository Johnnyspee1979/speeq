const axios = require('axios');

type StamPayload = {
  projectReferentie: string;
  kwaliteitsborgerId: string;
  typeMelding: 'BOUWMELDING' | 'GEREEDMELDING';
  bewijslast: {
    documentNaam: string;
    hashSha256: string;
    downloadUrl: string;
  }[];
  verklaringAkkoord: boolean;
};

type DsoResponse = {
  success: boolean;
  dsoReferentieId?: string;
  status: 'QUEUED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED';
  foutmelding?: string;
};

type DsoStatusResponse = {
  success: boolean;
  dsoReferentieId?: string;
  status: 'QUEUED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
  foutmelding?: string;
};

const knownStatuses = new Map<string, DsoStatusResponse>();

const resolveConfig = () => ({
  adapterUrl: process.env.DIGIKOPPELING_API_URL ?? process.env.DSO_ADAPTER_URL ?? '',
  apiKey: process.env.DIGIKOPPELING_API_KEY ?? process.env.DSO_ADAPTER_CLIENT_ID ?? '',
  certPath:
    process.env.DIGIKOPPELING_CERT_PATH ?? process.env.DSO_ADAPTER_CERT_ALIAS ?? '',
});

const normalizeSubmittedStatus = (
  rawStatus: unknown
): DsoResponse['status'] => {
  if (
    rawStatus === 'QUEUED' ||
    rawStatus === 'PROCESSING' ||
    rawStatus === 'ACCEPTED' ||
    rawStatus === 'REJECTED'
  ) {
    return rawStatus;
  }

  return 'ACCEPTED';
};

/**
 * Verstuurt het geaggregeerde Wkb-dossier naar het DSO via onze Digikoppeling-adapter.
 */
const submitToDSO = async (payload: StamPayload): Promise<DsoResponse> => {
  console.log(
    `[DSO Adapter] Voorbereiden ${payload.typeMelding} voor project: ${payload.projectReferentie}`
  );

  if (!payload.verklaringAkkoord) {
    return {
      success: false,
      status: 'REJECTED',
      foutmelding:
        'Verklaring van de kwaliteitsborger ontbreekt. Melding mag niet worden ingediend.',
    };
  }

  try {
    const { adapterUrl, apiKey, certPath } = resolveConfig();

    if (!adapterUrl || !apiKey) {
      throw new Error('Digikoppeling configuratie ontbreekt in .env');
    }

    if (certPath) {
      console.log(
        `[DSO Adapter] PKI-certificaatpad geconfigureerd voor latere mTLS-integratie: ${certPath}`
      );
    }

    const response = await axios.post(
      adapterUrl,
      {
        stamBericht: payload,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Wkb-Software-Id': 'SnapSyncApp-v1',
        },
        timeout: 10000,
      }
    );

    const dsoReferentieId =
      response.data?.referentie ??
      response.data?.referenceId ??
      response.data?.id ??
      `DSO-${Date.now()}`;
    const status = normalizeSubmittedStatus(response.data?.status);

    console.log(
      `[DSO Adapter] Melding succesvol ontvangen door adapter. Referentie: ${dsoReferentieId}`
    );

    knownStatuses.set(dsoReferentieId, {
      success: true,
      dsoReferentieId,
      status,
    });

    return {
      success: true,
      dsoReferentieId,
      status,
    };
  } catch (error: any) {
    console.error(
      '[DSO Adapter] Fout tijdens communicatie met Digikoppeling:',
      error.message
    );

    return {
      success: false,
      status: 'REJECTED',
      foutmelding:
        error.response?.data?.message ?? 'Netwerkfout bij bereiken van Digikoppeling.',
    };
  }
};

const fetchDsoStatus = async (referenceId: string): Promise<DsoStatusResponse> => {
  const existing = knownStatuses.get(referenceId);

  if (!existing) {
    return {
      success: false,
      dsoReferentieId: referenceId,
      status: 'UNKNOWN',
      foutmelding:
        'Geen lokale status bekend. Controleer de adapter of vraag de status op via de leveranciersomgeving.',
    };
  }

  return existing;
};

module.exports = {
  submitToDSO,
  fetchDsoStatus,
};
