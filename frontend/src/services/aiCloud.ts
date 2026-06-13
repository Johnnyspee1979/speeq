import { BACKEND_URL } from '../config/app';
import { supabase } from '../lib/supabase';

// Zachte token-attach: deze call draait tijdens cloud-sync (achtergrond). We
// sturen de Supabase-JWT mee als die er is; ontbreekt 'ie, dan weigert de
// backend met 401 en vangt de per-item sync-foutafhandeling dat netjes af.
const optionalAuthHeaders = async (
  base: Record<string, string>
): Promise<Record<string, string>> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  } catch {
    return base;
  }
};

export type CloudAiResponse = {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  confidence: number;
  detectedObjects: string[];
  feedback: string;
  checks: string[];
};

export type CloudAiRequestTemplate = {
  id?: string;
  nenNorm?: string;
  discipline?: string;
  title?: string;
  instruction?: string;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  aiValidationKey?: string;
};

export const requestCloudAiValidation = async (
  payload: Record<string, unknown> & { template?: CloudAiRequestTemplate }
): Promise<CloudAiResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/ai/validate`, {
    method: 'POST',
    headers: await optionalAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Cloud AI request failed');
  }

  return response.json();
};
