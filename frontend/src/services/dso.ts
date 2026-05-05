import { BACKEND_URL } from '../config/app';

type DsoSubmitResponse = {
  success: boolean;
  dsoReferentieId?: string | null;
  referenceId?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED';
  foutmelding?: string;
};

type DsoStatusResponse = {
  success: boolean;
  dsoReferentieId?: string | null;
  referenceId?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
  foutmelding?: string;
};

type StamMeldingResponse = {
  success: boolean;
  transactionId?: string | null;
  status: number;
  raw?: unknown;
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as {
      error?: string;
      foutmelding?: string;
    };

    return payload.foutmelding ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const submitStam = async (
  payload: Record<string, unknown>
): Promise<DsoSubmitResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/dso/stam/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'DSO STAM submit failed'));
  }

  return response.json();
};

export const fetchStamStatus = async (
  referenceId: string
): Promise<DsoStatusResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/dso/stam/status/${referenceId}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'DSO STAM status failed'));
  }
  return response.json();
};

export const submitBouwmelding = async (
  payload: Record<string, unknown>
): Promise<StamMeldingResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/stam/bouwmelding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'STAM bouwmelding failed'));
  }

  return response.json();
};

export const submitGereedmelding = async (
  payload: Record<string, unknown>
): Promise<StamMeldingResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/stam/gereedmelding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'STAM gereedmelding failed'));
  }

  return response.json();
};
