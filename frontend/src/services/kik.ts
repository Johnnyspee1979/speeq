import { BACKEND_URL } from '../config/app';
import { supabase } from '../lib/supabase';
import { getActiveTenantId } from '../config/tenant';
import type { CloudEvidence } from './cloudEvidenceService';

// De KiK-routes zitten nu achter requireAuth; stuur de Supabase-JWT mee als
// Bearer-token (zelfde patroon als services/dso.ts).
const authHeaders = async (
  base: Record<string, string> = {}
): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Je bent niet (meer) ingelogd. Log opnieuw in om naar KiK te synchroniseren.');
  }
  const headers: Record<string, string> = { ...base, Authorization: `Bearer ${token}` };
  const companyId = getActiveTenantId();
  if (companyId) headers['x-company-id'] = companyId;
  return headers;
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
};

export const pushApprovedEvidenceToKik = async (
  projectId: string,
  evidence: CloudEvidence[]
) => {
  const toKiKNote = (item: CloudEvidence) => {
    const notes = [item.field_note, item.ai_notes]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    return notes.length > 0 ? notes.join(' | ') : undefined;
  };

  const response = await fetch(`${BACKEND_URL}/api/kik/evidence`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      projectId,
      evidence: evidence.map((item) => ({
        id: String(item.id),
        project_id: item.project_id,
        inspection_point_id: item.inspection_point_id,
        photo_uri: item.photo_uri ?? item.media_uri,
        media_uri: item.media_uri ?? item.photo_uri,
        exif_hash: item.exif_hash,
        timestamp: item.timestamp,
        latitude: item.latitude,
        longitude: item.longitude,
        ai_status: item.ai_status,
        field_note: item.field_note,
        notes: toKiKNote(item),
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'KiK push mislukt'));
  }

  return response.json();
};
