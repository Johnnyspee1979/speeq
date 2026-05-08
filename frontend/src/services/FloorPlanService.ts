/**
 * FloorPlanService — upload, ophalen en verwijderen van bouwtekeningen per project.
 * Tekeningen worden opgeslagen in Supabase Storage (bucket: floor-plans)
 * en geregistreerd in de floor_plans tabel.
 */

import { supabase } from '../lib/supabase';

export interface FloorPlan {
  id: string;
  projectId: string;
  name: string;
  fileUrl: string;
  fileType: 'PNG' | 'PDF' | string;
  widthPx: number | null;
  heightPx: number | null;
  createdAt: string;
}

/**
 * Upload een bouwtekening (PNG of PDF) naar Supabase Storage
 * en sla de metadata op in floor_plans.
 */
export async function uploadFloorPlan(
  projectId: string,
  file: File,
  name: string
): Promise<FloorPlan | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${projectId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('floor-plans')
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error('FloorPlanService: upload error', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('floor-plans')
      .getPublicUrl(path);

    const fileUrl = urlData.publicUrl;
    const fileType = ext === 'pdf' ? 'PDF' : 'PNG';

    const { data: row, error: insertError } = await supabase
      .from('floor_plans')
      .insert({
        project_id: projectId,
        name,
        file_url: fileUrl,
        file_type: fileType,
      })
      .select()
      .single();

    if (insertError || !row) {
      console.error('FloorPlanService: insert error', insertError);
      return null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      fileUrl: row.file_url,
      fileType: row.file_type,
      widthPx: row.width_px ?? null,
      heightPx: row.height_px ?? null,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error('FloorPlanService: unexpected error', err);
    return null;
  }
}

/**
 * Haal alle tekeningen op voor een project (nieuwste eerst).
 */
export async function getFloorPlansForProject(
  projectId: string
): Promise<FloorPlan[]> {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    fileUrl: row.file_url,
    fileType: row.file_type,
    widthPx: row.width_px ?? null,
    heightPx: row.height_px ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Verwijder een tekening (rij in floor_plans — Storage cleanup optioneel).
 */
export async function deleteFloorPlan(id: string): Promise<void> {
  await supabase.from('floor_plans').delete().eq('id', id);
}
