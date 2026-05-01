const {
  assertProjectReviewAccess,
  createHttpError,
  getAuthenticatedUserContext,
} = require('./authContextService');
const {
  dispatchReviewNotifications,
} = require('./reviewNotificationService');
const { getSupabaseAdminClient } = require('./supabaseAdmin');

type ReviewStatus = 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';

type ReviewStatusUpdateInput = {
  authorizationHeader?: string | null;
  evidenceId: number;
  status: unknown;
  notes?: unknown;
};

type EvidenceReviewRow = {
  id: number;
  project_id?: string | null;
  inspection_point_id?: string | null;
  user_id?: string | null;
  photo_uri?: string | null;
  media_uri?: string | null;
  field_note?: string | null;
};

const REVIEW_STATUS_VALUES: ReviewStatus[] = [
  'APPROVED',
  'NEEDS_REVIEW',
  'REJECTED',
];

const normalizeReviewStatus = (rawStatus: unknown): ReviewStatus | null => {
  const normalized = String(rawStatus ?? '').trim().toUpperCase();

  if (normalized === 'APPROVED') {
    return 'APPROVED';
  }

  if (normalized === 'NEEDS_REVIEW') {
    return 'NEEDS_REVIEW';
  }

  if (normalized === 'REJECTED') {
    return 'REJECTED';
  }

  return null;
};

const normalizeReviewNotes = (rawNotes: unknown) => {
  if (typeof rawNotes !== 'string') {
    return null;
  }

  const trimmed = rawNotes.trim();
  return trimmed || null;
};

const updateEvidenceReviewStatus = async (input: ReviewStatusUpdateInput) => {
  const reviewStatus = normalizeReviewStatus(input.status);

  if (!reviewStatus) {
    throw createHttpError(
      400,
      `Ongeldige reviewstatus. Gebruik: ${REVIEW_STATUS_VALUES.join(', ')}.`
    );
  }

  if (!Number.isInteger(input.evidenceId) || input.evidenceId <= 0) {
    throw createHttpError(400, 'evidenceId moet een positief getal zijn.');
  }

  const context = await getAuthenticatedUserContext(input.authorizationHeader);
  const supabase = getSupabaseAdminClient();
  const { data: evidence, error: fetchError } = await supabase
    .from('evidence')
    .select(
      'id, project_id, inspection_point_id, user_id, photo_uri, media_uri, field_note'
    )
    .eq('id', input.evidenceId)
    .maybeSingle();

  if (fetchError) {
    throw createHttpError(
      500,
      `Bewijsrecord kon niet worden opgehaald: ${fetchError.message}`
    );
  }

  if (!evidence) {
    throw createHttpError(404, 'Bewijsrecord niet gevonden.');
  }

  const record = evidence as EvidenceReviewRow;
  await assertProjectReviewAccess(String(record.project_id ?? ''), context);

  const notes = normalizeReviewNotes(input.notes);
  const { error: updateError } = await supabase
    .from('evidence')
    .update({
      ai_status: reviewStatus,
      ai_notes: notes,
    })
    .eq('id', input.evidenceId);

  if (updateError) {
    throw createHttpError(
      500,
      `Reviewstatus kon niet worden opgeslagen: ${updateError.message}`
    );
  }

  const dispatchResult =
    reviewStatus === 'REJECTED'
      ? await dispatchReviewNotifications({
          evidenceId: input.evidenceId,
          projectId: String(record.project_id ?? ''),
          inspectionPointId: record.inspection_point_id ?? null,
          reviewStatus,
          reviewNotes: notes,
          reviewerId: context.userId,
          reviewerRole: context.role,
          reviewerCompanyName: context.companyName,
          evidenceOwnerId: record.user_id ?? null,
          photoUrl: record.photo_uri ?? record.media_uri ?? null,
          fieldNote: record.field_note ?? null,
        })
      : null;

  return {
    evidenceId: input.evidenceId,
    projectId: record.project_id ?? null,
    status: reviewStatus,
    notes,
    notified: Boolean(dispatchResult),
    dispatchResult,
  };
};

module.exports = {
  REVIEW_STATUS_VALUES,
  normalizeReviewStatus,
  updateEvidenceReviewStatus,
};
