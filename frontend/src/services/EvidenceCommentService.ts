/**
 * EvidenceCommentService — opmerkingen per bewijsstuk.
 *
 * WV kan feedback geven op afgekeurde foto's (bijv. "aansluiting niet zichtbaar,
 * maak opnieuw"). Vakman ziet dit in zijn werkruimte en kan reageren.
 */

import { supabase } from '../lib/supabase';

export type CommentRole = 'WV' | 'VAKMAN' | 'ADMIN';

export interface EvidenceComment {
  id: string;
  evidenceId: string;
  projectId: string | null;
  userId: string | null;
  authorName: string | null;
  role: CommentRole;
  body: string;
  createdAt: string;
}

function rowToComment(row: Record<string, unknown>): EvidenceComment {
  return {
    id:         row.id as string,
    evidenceId: row.evidence_id as string,
    projectId:  (row.project_id as string | null) ?? null,
    userId:     (row.user_id as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? null,
    role:       ((row.role as string) ?? 'WV') as CommentRole,
    body:       row.body as string,
    createdAt:  row.created_at as string,
  };
}

/** Laad alle opmerkingen voor één bewijsstuk. */
export async function getComments(evidenceId: string): Promise<EvidenceComment[]> {
  const { data, error } = await supabase
    .from('evidence_comments')
    .select('*')
    .eq('evidence_id', evidenceId)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToComment);
}

/** Laad alle opmerkingen voor een project (efficiënt voor het dashboard). */
export async function getProjectComments(
  projectId: string
): Promise<EvidenceComment[]> {
  const { data, error } = await supabase
    .from('evidence_comments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToComment);
}

export interface AddCommentInput {
  evidenceId: string;
  projectId?: string | null;
  body: string;
  role?: CommentRole;
  authorName?: string | null;
}

/** Voeg een opmerking toe. */
export async function addComment(
  input: AddCommentInput
): Promise<EvidenceComment | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('evidence_comments')
    .insert({
      evidence_id:  input.evidenceId,
      project_id:   input.projectId ?? null,
      user_id:      user?.id ?? null,
      author_name:  input.authorName ?? user?.email ?? null,
      role:         input.role ?? 'WV',
      body:         input.body.trim(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error('EvidenceCommentService: addComment error', error);
    return null;
  }
  return rowToComment(data as Record<string, unknown>);
}

/** Verwijder een opmerking (eigen opmerking of als WV/admin). */
export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('evidence_comments')
    .delete()
    .eq('id', id);
  return !error;
}

/** Tel opmerkingen per evidence_id (Map<evidenceId, count>). */
export function buildCommentCountMap(
  comments: EvidenceComment[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of comments) {
    map.set(c.evidenceId, (map.get(c.evidenceId) ?? 0) + 1);
  }
  return map;
}
