import { BACKEND_URL } from '../config/app';
import type { CloudEvidence } from './cloudEvidenceService';

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
    headers: { 'Content-Type': 'application/json' },
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
