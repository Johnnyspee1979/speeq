/**
 * DrawingChangeRequestService — wijzigingsverzoeken op bouwtekeningen.
 *
 * WV maakt een wijziging → systeem genereert een unieke goedkeuringslink →
 * klant opent de link → ziet de wijziging → geeft akkoord of wijst af →
 * vastgelegd met naam, tijdstempel en juridische bevestigingstekst.
 */

import { supabase } from '../lib/supabase';

export type ChangeType = 'AANPASSING' | 'NIEUWE_TEKENING' | 'VERWIJDERING' | 'PIN_WIJZIGING';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DrawingChangeRequest {
  id: string;
  projectId: string;
  floorPlanId: string | null;
  changeType: ChangeType;
  changeDescription: string;
  requestedBy: string | null;
  requesterName: string | null;
  requestedAt: string;
  approvalToken: string;
  status: ChangeStatus;
  clientName: string | null;
  clientEmail: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  legalStatement: string | null;
}

function rowToRequest(row: Record<string, unknown>): DrawingChangeRequest {
  return {
    id:                  row.id as string,
    projectId:           row.project_id as string,
    floorPlanId:         (row.floor_plan_id as string | null) ?? null,
    changeType:          (row.change_type as ChangeType) ?? 'AANPASSING',
    changeDescription:   row.change_description as string,
    requestedBy:         (row.requested_by as string | null) ?? null,
    requesterName:       (row.requester_name as string | null) ?? null,
    requestedAt:         row.requested_at as string,
    approvalToken:       row.approval_token as string,
    status:              (row.status as ChangeStatus) ?? 'PENDING',
    clientName:          (row.client_name as string | null) ?? null,
    clientEmail:         (row.client_email as string | null) ?? null,
    approvedAt:          (row.approved_at as string | null) ?? null,
    rejectionReason:     (row.rejection_reason as string | null) ?? null,
    legalStatement:      (row.legal_statement as string | null) ?? null,
  };
}

/** Maak een nieuw wijzigingsverzoek aan en retourneer de goedkeuringslink. */
export async function createChangeRequest(input: {
  projectId: string;
  floorPlanId?: string | null;
  changeType?: ChangeType;
  changeDescription: string;
  requesterName?: string | null;
}): Promise<DrawingChangeRequest | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('drawing_change_requests')
    .insert({
      project_id:          input.projectId,
      floor_plan_id:       input.floorPlanId ?? null,
      change_type:         input.changeType ?? 'AANPASSING',
      change_description:  input.changeDescription.trim(),
      requested_by:        user?.id ?? null,
      requester_name:      input.requesterName ?? user?.email ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('DrawingChangeRequestService: createChangeRequest error', error);
    return null;
  }
  return rowToRequest(data as Record<string, unknown>);
}

/** Haal een aanvraag op via het unieke goedkeuringstoken (publiek). */
export async function getChangeRequestByToken(
  token: string
): Promise<DrawingChangeRequest | null> {
  const { data, error } = await supabase
    .from('drawing_change_requests')
    .select('*')
    .eq('approval_token', token)
    .single();

  if (error || !data) return null;
  return rowToRequest(data as Record<string, unknown>);
}

/** Klant gaat akkoord. */
export async function approveChangeRequest(
  token: string,
  clientName: string,
  clientEmail: string
): Promise<boolean> {
  const legalStatement = `Ik, ${clientName}, ga hierbij akkoord met de beschreven wijziging. Vastgelegd op ${new Date().toLocaleString('nl-NL')}.`;

  const { error } = await supabase
    .from('drawing_change_requests')
    .update({
      status:           'APPROVED',
      client_name:      clientName.trim(),
      client_email:     clientEmail.trim(),
      approved_at:      new Date().toISOString(),
      legal_statement:  legalStatement,
    })
    .eq('approval_token', token)
    .eq('status', 'PENDING');

  return !error;
}

/** Klant wijst af. */
export async function rejectChangeRequest(
  token: string,
  clientName: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('drawing_change_requests')
    .update({
      status:           'REJECTED',
      client_name:      clientName.trim(),
      approved_at:      new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('approval_token', token)
    .eq('status', 'PENDING');

  return !error;
}

/** Haal alle aanvragen op voor een project. */
export async function getChangeRequestsForProject(
  projectId: string
): Promise<DrawingChangeRequest[]> {
  const { data, error } = await supabase
    .from('drawing_change_requests')
    .select('*')
    .eq('project_id', projectId)
    .order('requested_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToRequest);
}

/** Genereer de publieke goedkeuringslink voor een token. */
export function buildApprovalUrl(token: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/?approve=${token}`;
  }
  return `https://wkb-snap-sync.vercel.app/?approve=${token}`;
}
