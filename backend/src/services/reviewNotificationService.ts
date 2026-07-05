const axios = require('axios');
const crypto = require('crypto');
const { backendConfig } = require('../config');
const { getSupabaseAdminClient } = require('./supabaseAdmin');
const { sendReviewNotificationEmail } = require('./emailService');

type ReviewNotificationPayloadInput = {
  evidenceId: number;
  projectId: string;
  inspectionPointId?: string | null;
  reviewStatus: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';
  reviewNotes?: string | null;
  reviewerId: string;
  reviewerRole: string;
  reviewerCompanyName?: string | null;
  evidenceOwnerId?: string | null;
  photoUrl?: string | null;
  fieldNote?: string | null;
  occurredAt?: string;
};

type NotificationSubscriptionInput = {
  userId: string;
  projectId?: string | null;
  expoPushToken: string;
  platform: string;
  deviceLabel?: string | null;
};

type ReviewDispatchResult = {
  webhooksDelivered: number;
  pushDelivered: number;
  webhookFailures: string[];
  pushFailures: string[];
};

let hasWarnedMissingWebhookTable = false;
let hasWarnedMissingSubscriptionTable = false;

const isMissingTableError = (error: any, tableName: string) => {
  const message = String(
    error?.message ?? error?.details ?? error?.hint ?? ''
  ).toLowerCase();

  return (
    message.includes(tableName.toLowerCase()) &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
};

const createWebhookSignature = (secret: string, payload: Record<string, unknown>) =>
  crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

const buildInspectionCameraDeepLink = (
  inspectionPointId: string,
  reason?: string | null
) => {
  const scheme = String(backendConfig.appDeepLinkScheme ?? 'wkb-snap-sync').trim();
  const safeInspectionPointId = encodeURIComponent(inspectionPointId);

  if (!reason) {
    return `${scheme}://camera/${safeInspectionPointId}`;
  }

  return `${scheme}://camera/${safeInspectionPointId}?reason=${encodeURIComponent(
    reason
  )}`;
};

// Status-bewuste notificatie-metadata. NEEDS_REVIEW én REJECTED sturen allebei een
// melding naar de vakman (met eigen tekst + event-type); APPROVED stuurt niets.
const REVIEW_NOTIFICATION_META = {
  REJECTED: {
    eventType: 'evidence.review.rejected',
    webhookEventType: 'EVIDENCE_REJECTED',
    pushTitle: 'Wkb foto afgekeurd',
    pushBody: (inspectionPointId?: string | null) =>
      inspectionPointId
        ? `Controlepunt ${inspectionPointId} is afgekeurd. Open de app voor herstel.`
        : 'Een Wkb-bewijsstuk is afgekeurd. Open de app voor herstel.',
  },
  NEEDS_REVIEW: {
    eventType: 'evidence.review.needs_review',
    webhookEventType: 'EVIDENCE_NEEDS_REVIEW',
    pushTitle: 'Wkb foto vraagt aandacht',
    pushBody: (inspectionPointId?: string | null) =>
      inspectionPointId
        ? `Controlepunt ${inspectionPointId} moet worden nagekeken. Open de app.`
        : 'Een Wkb-bewijsstuk moet worden nagekeken. Open de app.',
  },
} as const;

const resolveReviewMeta = (reviewStatus: string) =>
  reviewStatus === 'NEEDS_REVIEW'
    ? REVIEW_NOTIFICATION_META.NEEDS_REVIEW
    : REVIEW_NOTIFICATION_META.REJECTED;

const buildReviewNotificationPayload = (
  input: ReviewNotificationPayloadInput
) => ({
  eventType: resolveReviewMeta(input.reviewStatus).eventType,
  occurredAt: input.occurredAt ?? new Date().toISOString(),
  evidence: {
    id: input.evidenceId,
    projectId: input.projectId,
    inspectionPointId: input.inspectionPointId ?? null,
    ownerId: input.evidenceOwnerId ?? null,
    photoUrl: input.photoUrl ?? null,
    fieldNote: input.fieldNote ?? null,
  },
  review: {
    status: input.reviewStatus,
    notes: input.reviewNotes ?? null,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    reviewerCompanyName: input.reviewerCompanyName ?? null,
  },
  routing: {
    action: 'OPEN_EVIDENCE',
    inspectionPointId: input.inspectionPointId ?? null,
    reason: input.reviewNotes ?? null,
    deepLink: input.inspectionPointId
      ? buildInspectionCameraDeepLink(
          input.inspectionPointId,
          input.reviewNotes ?? null
        )
      : null,
  },
});

const fetchWebhookEndpoints = async (
  projectId: string,
  webhookEventType: string
) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('review_webhook_endpoints')
    .select('target_url, secret, project_id, event_type, is_active')
    .eq('is_active', true);

  if (!error) {
    return (data ?? []).filter(
      (item: any) =>
        (!item.project_id || item.project_id === projectId) &&
        (!item.event_type || item.event_type === webhookEventType)
    );
  }

  if (isMissingTableError(error, 'review_webhook_endpoints')) {
    if (!hasWarnedMissingWebhookTable) {
      console.warn(
        'Review webhooks niet geactiveerd: voeg tabel "review_webhook_endpoints" toe in Supabase.'
      );
      hasWarnedMissingWebhookTable = true;
    }
    return [];
  }

  throw new Error(error.message);
};

const fetchNotificationSubscriptions = async (
  projectId: string,
  userId: string
) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('notification_subscriptions')
    .select('expo_push_token, project_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!error) {
    return (data ?? []).filter(
      (item: any) => !item.project_id || item.project_id === projectId
    );
  }

  if (isMissingTableError(error, 'notification_subscriptions')) {
    if (!hasWarnedMissingSubscriptionTable) {
      console.warn(
        'Push-notificaties niet geactiveerd: voeg tabel "notification_subscriptions" toe in Supabase.'
      );
      hasWarnedMissingSubscriptionTable = true;
    }
    return [];
  }

  throw new Error(error.message);
};

const upsertNotificationSubscription = async (
  input: NotificationSubscriptionInput
) => {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('notification_subscriptions').upsert(
    {
      user_id: input.userId,
      project_id: input.projectId?.trim() || null,
      expo_push_token: input.expoPushToken.trim(),
      platform: input.platform.trim() || 'unknown',
      device_label: input.deviceLabel?.trim() || null,
      is_active: true,
      updated_at: now,
    },
    { onConflict: 'expo_push_token' }
  );

  if (!error) {
    return;
  }

  if (isMissingTableError(error, 'notification_subscriptions')) {
    if (!hasWarnedMissingSubscriptionTable) {
      console.warn(
        'Push-registratie overgeslagen: voeg tabel "notification_subscriptions" toe in Supabase.'
      );
      hasWarnedMissingSubscriptionTable = true;
    }
    return;
  }

  throw new Error(error.message);
};

const dispatchReviewNotifications = async (
  input: ReviewNotificationPayloadInput
): Promise<ReviewDispatchResult> => {
  const meta = resolveReviewMeta(input.reviewStatus);
  const payload = buildReviewNotificationPayload(input);
  const result: ReviewDispatchResult = {
    webhooksDelivered: 0,
    pushDelivered: 0,
    webhookFailures: [],
    pushFailures: [],
  };

  const [webhookEndpoints, pushSubscriptions] = await Promise.all([
    fetchWebhookEndpoints(input.projectId, meta.webhookEventType),
    input.evidenceOwnerId
      ? fetchNotificationSubscriptions(input.projectId, input.evidenceOwnerId)
      : Promise.resolve([]),
  ]);

  for (const endpoint of webhookEndpoints) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Wkb-Event': meta.eventType,
      };

      if (endpoint.secret) {
        headers['X-Wkb-Signature'] = createWebhookSignature(endpoint.secret, payload);
      }

      await axios.post(endpoint.target_url, payload, {
        headers,
        timeout: 5000,
      });

      result.webhooksDelivered += 1;
    } catch (error: any) {
      result.webhookFailures.push(
        `${endpoint.target_url}: ${error?.message ?? 'onbekende webhookfout'}`
      );
    }
  }

  for (const subscription of pushSubscriptions) {
    try {
      await axios.post(
        'https://exp.host/--/api/v2/push/send',
        {
          to: subscription.expo_push_token,
          title: meta.pushTitle,
          body: meta.pushBody(input.inspectionPointId),
          data: payload,
        },
        {
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      result.pushDelivered += 1;
    } catch (error: any) {
      result.pushFailures.push(
        `${subscription.expo_push_token}: ${
          error?.message ?? 'onbekende pushfout'
        }`
      );
    }
  }

  // E-mail notificatie via Resend (bij REJECTED of NEEDS_REVIEW)
  if (
    input.reviewStatus !== 'APPROVED' &&
    input.evidenceOwnerId
  ) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data: userRecord } = await supabase
        .from('wkb_users')
        .select('email, display_name')
        .eq('id', input.evidenceOwnerId)
        .maybeSingle();

      if (userRecord?.email) {
        await sendReviewNotificationEmail({
          toEmail: userRecord.email,
          toName: userRecord.display_name ?? undefined,
          projectId: input.projectId,
          inspectionPointId: input.inspectionPointId ?? null,
          reviewStatus: input.reviewStatus,
          reviewNotes: input.reviewNotes ?? null,
          reviewerName: input.reviewerCompanyName ?? input.reviewerRole,
          deepLink: input.inspectionPointId
            ? buildInspectionCameraDeepLink(input.inspectionPointId, input.reviewNotes ?? null)
            : null,
        });
      }
    } catch (emailError: any) {
      console.warn('📧 E-mail notificatie mislukt (niet-kritiek):', emailError?.message ?? emailError);
    }
  }

  return result;
};

module.exports = {
  buildReviewNotificationPayload,
  buildInspectionCameraDeepLink,
  dispatchReviewNotifications,
  upsertNotificationSubscription,
};
