import { BACKEND_URL } from '../config/app';
import { supabase } from '../lib/supabase';
import { getActiveTenantId } from '../config/tenant';

// DSO/STAM-meldingen gaan naar bevoegd gezag; deze backend-routes vereisen auth.
// We sturen de Supabase-JWT mee als Bearer-token (zelfde patroon als
// NotificationService/cloudEvidenceService).
const authHeaders = async (
  base: Record<string, string> = {}
): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Je bent niet (meer) ingelogd. Log opnieuw in om de melding te versturen.');
  }
  const headers: Record<string, string> = { ...base, Authorization: `Bearer ${token}` };
  // Tenant-slug voor de env-gated betaalmuur (zie dossierAuth). Additief: met de
  // muur uit negeert de backend de header.
  const companyId = getActiveTenantId();
  if (companyId) headers['x-company-id'] = companyId;
  return headers;
};

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
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
  const response = await fetch(`${BACKEND_URL}/api/dso/stam/status/${referenceId}`, {
    headers: await authHeaders(),
  });
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
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
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
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'STAM gereedmelding failed'));
  }

  return response.json();
};
