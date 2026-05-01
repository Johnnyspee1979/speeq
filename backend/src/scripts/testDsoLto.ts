const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

type LtoPayload = {
  StamMelding: {
    MeldingType: string;
    Dagtekening: string;
    Initiatiefnemer: {
      Naam: string;
      KVK: string;
    };
    Locatie: {
      Coordinaten: string;
    };
    Kwaliteitsborging: {
      KwaliteitsborgerKVK: string;
      InstrumentCode: string;
    };
  };
};

const DKA_LTO_URL =
  process.env.DKA_LTO_URL?.trim() || 'http://localhost:8080/api/stam/lto-test';
const DKA_TEST_API_KEY =
  process.env.DKA_TEST_API_KEY?.trim() || process.env.DKA_INTERNAL_API_KEY?.trim() || '';
const LOG_FILE = process.env.LTO_LOG_FILE?.trim() || './dso_lto_bewijs.log';

const resolveLogFilePath = () =>
  path.isAbsolute(LOG_FILE)
    ? LOG_FILE
    : path.resolve(__dirname, '../../', LOG_FILE.replace(/^\.\//, ''));

const buildTestPayload = (): LtoPayload => ({
  StamMelding: {
    MeldingType: 'Bouwmelding_Wkb_GK1_Test',
    Dagtekening: new Date().toISOString(),
    Initiatiefnemer: {
      Naam: 'Test Aannemer B.V. (Wkb Snap & Sync App)',
      KVK: '12345678',
    },
    Locatie: {
      Coordinaten: '52.3702,4.8951',
    },
    Kwaliteitsborging: {
      KwaliteitsborgerKVK: '87654321',
      InstrumentCode: 'KIK_TOOL_TEST',
    },
  },
});

const appendLog = (section: {
  environment: string;
  status: string;
  payload: LtoPayload;
  responseBody?: unknown;
  responseStatus?: number | null;
  transactionId?: string | null;
  errorMessage?: string;
}) => {
  const logFilePath = resolveLogFilePath();
  const logData = `
===================================================
Tijdstip: ${new Date().toISOString()}
Omgeving: ${section.environment}
Status: ${section.status}${
    section.responseStatus != null ? ` (${section.responseStatus})` : ''
  }
TransactieID: ${section.transactionId ?? 'ONBEKEND'}
${section.errorMessage ? `Foutmelding: ${section.errorMessage}\n` : ''}
Verzonden STAM Payload:
${JSON.stringify(section.payload, null, 2)}

Response DSO/DKA:
${JSON.stringify(section.responseBody ?? null, null, 2)}
===================================================\n`;

  fs.appendFileSync(logFilePath, logData);
  return logFilePath;
};

const runLtoTest = async () => {
  console.log('🏛️ Start Wkb STAM-test naar DSO Leveranciers Testomgeving (LTO)...');

  if (!DKA_TEST_API_KEY) {
    throw new Error(
      'DKA_TEST_API_KEY ontbreekt. Voeg een geldige testsleutel toe in backend/.env.'
    );
  }

  const testPayload = buildTestPayload();

  try {
    const response = await axios.post(DKA_LTO_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DKA_TEST_API_KEY}`,
      },
      timeout: 15000,
    });

    const transactionId =
      response.data?.transactionId ??
      response.data?.referenceId ??
      response.data?.referentie ??
      null;

    const logFilePath = appendLog({
      environment: 'DSO Leveranciers Testomgeving (LTO)',
      status: 'SUCCES',
      responseStatus: response.status,
      transactionId,
      payload: testPayload,
      responseBody: response.data,
    });

    console.log(
      `✅ Testmelding geaccepteerd door DKA en afgeleverd bij het DSO. Statuscode: ${response.status}`
    );
    console.log(`📄 Het bewijslog is weggeschreven naar: ${logFilePath}`);
    return;
  } catch (error: any) {
    const responseStatus = Number(error?.response?.status);
    const responseBody = error?.response?.data ?? null;
    const errorMessage = error?.message ?? 'Onbekende fout tijdens LTO test';

    const logFilePath = appendLog({
      environment: 'DSO Leveranciers Testomgeving (LTO)',
      status: 'GEFAALD',
      responseStatus: Number.isFinite(responseStatus) ? responseStatus : null,
      payload: testPayload,
      responseBody,
      errorMessage,
    });

    console.error('❌ LTO test gefaald. Fout bij de Digikoppeling-adapter:');
    if (Number.isFinite(responseStatus)) {
      console.error(`Status: ${responseStatus}`);
    }
    if (responseBody) {
      console.error(responseBody);
    } else {
      console.error(errorMessage);
    }
    console.error(`📄 Het foutlog is ook weggeschreven naar: ${logFilePath}`);
    process.exitCode = 1;
  }
};

void runLtoTest();
