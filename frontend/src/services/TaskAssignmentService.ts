/**
 * TaskAssignmentService — borgingspunten toewijzen aan vakmansen.
 * CRUD via Supabase voor de task_assignments tabel.
 */

import { supabase } from '../lib/supabase';

export type TaskPriority = 'LAAG' | 'NORMAAL' | 'HOOG' | 'URGENT';
export type TaskStatus   = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

export interface TaskAssignment {
  id: string;
  projectId: string;
  inspectionPointId: string;
  assignedTo: string | null;        // user uuid
  assignedBy: string | null;
  assignedToName?: string | null;   // display name (joined from profiles)
  priority: TaskPriority;
  deadline: string | null;          // ISO date string
  notes: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskAssignmentInput {
  projectId: string;
  inspectionPointId: string;
  assignedTo?: string | null;
  priority?: TaskPriority;
  deadline?: string | null;
  notes?: string | null;
}

function rowToAssignment(row: Record<string, unknown>): TaskAssignment {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    inspectionPointId: row.inspection_point_id as string,
    assignedTo: (row.assigned_to as string | null) ?? null,
    assignedBy: (row.assigned_by as string | null) ?? null,
    assignedToName: (row.profiles as { display_name?: string } | null)?.display_name ?? null,
    priority: (row.priority as TaskPriority) ?? 'NORMAAL',
    deadline: (row.deadline as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: (row.status as TaskStatus) ?? 'OPEN',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getTaskAssignments(projectId: string): Promise<TaskAssignment[]> {
  const { data, error } = await supabase
    .from('task_assignments')
    .select('*, profiles(display_name)')
    .eq('project_id', projectId)
    .order('priority', { ascending: false })
    .order('deadline', { ascending: true });

  if (error || !data) return [];
  return data.map(rowToAssignment);
}

export async function getMyTaskAssignments(
  projectId: string,
  userId: string
): Promise<TaskAssignment[]> {
  const { data, error } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('project_id', projectId)
    .eq('assigned_to', userId)
    .neq('status', 'DONE')
    .order('priority', { ascending: false });

  if (error || !data) return [];
  return data.map(rowToAssignment);
}

export async function createTaskAssignment(
  input: CreateTaskAssignmentInput
): Promise<TaskAssignment | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('task_assignments')
    .insert({
      project_id: input.projectId,
      inspection_point_id: input.inspectionPointId,
      assigned_to: input.assignedTo ?? null,
      assigned_by: user?.id ?? null,
      priority: input.priority ?? 'NORMAAL',
      deadline: input.deadline ?? null,
      notes: input.notes ?? null,
      status: 'OPEN',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('TaskAssignmentService: create error', error);
    return null;
  }
  return rowToAssignment(data);
}

export async function updateTaskAssignment(
  id: string,
  updates: Partial<Pick<TaskAssignment, 'priority' | 'deadline' | 'notes' | 'status' | 'assignedTo'>>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (updates.priority !== undefined)   payload.priority    = updates.priority;
  if (updates.deadline !== undefined)   payload.deadline    = updates.deadline;
  if (updates.notes    !== undefined)   payload.notes       = updates.notes;
  if (updates.status   !== undefined)   payload.status      = updates.status;
  if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;

  const { error } = await supabase
    .from('task_assignments')
    .update(payload)
    .eq('id', id);

  return !error;
}

export async function deleteTaskAssignment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('task_assignments')
    .delete()
    .eq('id', id);
  return !error;
}

export async function upsertTaskAssignment(
  input: CreateTaskAssignmentInput & { existingId?: string }
): Promise<TaskAssignment | null> {
  if (input.existingId) {
    await updateTaskAssignment(input.existingId, {
      assignedTo: input.assignedTo,
      priority: input.priority,
      deadline: input.deadline,
      notes: input.notes,
    });
    return null; // caller can refetch
  }
  return createTaskAssignment(input);
}
