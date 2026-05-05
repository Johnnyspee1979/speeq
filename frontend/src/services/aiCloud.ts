import { BACKEND_URL } from '../config/app';

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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Cloud AI request failed');
  }

  return response.json();
};
