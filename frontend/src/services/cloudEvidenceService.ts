import { BACKEND_URL } from '../config/app';
import { supabase } from '../lib/supabase';

export type ReviewableEvidenceStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_REVIEW'
  | 'PASSED'
  | 'FAILED'
  | 'WARNING';

export interface CloudEvidence {
  id: number;
  project_id?: string | null;
  inspection_point_id?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
  timestamp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  exif_hash?: string | null;
  exif_verified?: boolean | number | null;
  field_note?: string | null;
  betonkwaliteit?: string | null;
  milieuklasse?: string | null;
  volume?: string | null;
  leverdatum?: string | null;
  stop_moment_confirmed?: boolean | number | null;
  measurement_tool_confirmed?: boolean | number | null;
  location_verified?: boolean | number | null;
  location_spoof_risk?: string | null;
  location_security_message?: string | null;
  ai_status?: ReviewableEvidenceStatus | null;
  ai_confidence?: number | null;
  ai_notes?: string | null;
}

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();

    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // no-op
  }

  return fallback;
};

export const fetchEvidenceForReview = async (
  projectId?: string
): Promise<CloudEvidence[]> => {
  let query = supabase
    .from('evidence')
    .select(
      'id, project_id, inspection_point_id, photo_uri, media_uri, timestamp, latitude, longitude, gps_accuracy, exif_hash, exif_verified, field_note, betonkwaliteit, milieuklasse, volume, leverdatum, stop_moment_confirmed, measurement_tool_confirmed, location_verified, location_spoof_risk, location_security_message, ai_status, ai_confidence, ai_notes'
    )
    .order('timestamp', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Fout bij ophalen cloud bewijs:', error);
    return [];
  }

  return (data ?? []) as CloudEvidence[];
};

export const updateEvidenceStatus = async (
  id: number,
  newStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW',
  notes?: string | null
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.error(`❌ Geen actieve sessie beschikbaar voor review-update ${id}.`);
    return false;
  }

  const response = await fetch(`${BACKEND_URL}/api/review/evidence/${id}/status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: newStatus,
      notes: notes ?? null,
    }),
  });

  if (!response.ok) {
    console.error(
      `❌ Fout bij updaten status voor ${id}:`,
      await readErrorMessage(response, 'Reviewstatus kon niet worden opgeslagen.')
    );
    return false;
  }

  return true;
};
