/**
 * ProjectService — CRUD voor WKB-projecten.
 * Werkt via de bestaande `projects` tabel in Supabase.
 */

import { supabase } from '../lib/supabase';

export interface WkbProject {
  id: string;
  name: string;
  address?: string | null;
  initiatorName?: string | null;
  kadastrale?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ownerId?: string | null;
  createdAt?: string | null;
  status?: 'ACTIEF' | 'OPGELEVERD' | 'GEPAUZEERD' | null;
}

export interface CreateProjectInput {
  name: string;
  address?: string;
  initiatorName?: string;
  kadastrale?: string;
  latitude?: number;
  longitude?: number;
}

function rowToProject(row: Record<string, unknown>): WkbProject {
  return {
    id: row.id as string,
    name: (row.name as string) ?? (row.project_id as string) ?? 'Naamloos project',
    address: (row.address as string | null) ?? null,
    initiatorName: (row.initiator_name as string | null) ?? null,
    kadastrale: (row.kadastrale_aanduiding as string | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    ownerId: (row.owner_id as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    status: (row.status as WkbProject['status']) ?? 'ACTIEF',
  };
}

export async function getProjects(): Promise<WkbProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map(rowToProject);
}

export async function getProject(id: string): Promise<WkbProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToProject(data);
}

export async function createProject(input: CreateProjectInput): Promise<WkbProject | null> {
  const { data: { user } } = await supabase.auth.getUser();

  // Generate a readable project ID from the name
  const projectId = `PRJ-${Date.now()}`;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      project_id: projectId,
      name: input.name,
      address: input.address ?? null,
      initiator_name: input.initiatorName ?? null,
      kadastrale_aanduiding: input.kadastrale ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      owner_id: user?.id ?? null,
      status: 'ACTIEF',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('ProjectService: create error', error);
    return null;
  }
  return rowToProject(data);
}

export async function updateProject(
  id: string,
  updates: Partial<CreateProjectInput & { status: WkbProject['status'] }>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined)         payload.name                    = updates.name;
  if (updates.address !== undefined)      payload.address                 = updates.address;
  if (updates.initiatorName !== undefined) payload.initiator_name         = updates.initiatorName;
  if (updates.kadastrale !== undefined)   payload.kadastrale_aanduiding   = updates.kadastrale;
  if (updates.latitude !== undefined)     payload.latitude                = updates.latitude;
  if (updates.longitude !== undefined)    payload.longitude               = updates.longitude;
  if (updates.status !== undefined)       payload.status                  = updates.status;

  const { error } = await supabase.from('projects').update(payload).eq('id', id);
  return !error;
}
