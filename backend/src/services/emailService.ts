const { Resend } = require('resend');
const { backendConfig } = require('../config');

type ReviewEmailInput = {
  toEmail: string;
  toName?: string;
  projectId: string;
  inspectionPointId?: string | null;
  reviewStatus: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED';
  reviewNotes?: string | null;
  reviewerName?: string;
  deepLink?: string | null;
};

type DossierEmailInput = {
  toEmail: string;
  toName?: string;
  projectId: string;
  projectName?: string;
  pdfUrl: string;
};

const getResendClient = () => {
  const apiKey = backendConfig.resendApiKey;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

const statusLabel = (status: ReviewEmailInput['reviewStatus']) => {
  switch (status) {
    case 'APPROVED':
      return '✅ Goedgekeurd';
    case 'NEEDS_REVIEW':
      return '🔍 Menselijke review vereist';
    case 'REJECTED':
      return '❌ Afgekeurd';
  }
};

const statusColor = (status: ReviewEmailInput['reviewStatus']) => {
  switch (status) {
    case 'APPROVED':
      return '#16A34A';
    case 'NEEDS_REVIEW':
      return '#D97706';
    case 'REJECTED':
      return '#DC2626';
  }
};

const buildReviewEmailHtml = (input: ReviewEmailInput) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wkb Bewijsstuk Review</title>
</head>
<body style="margin:0;padding:0;background:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1117;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1A1D27;border-radius:16px;border:1px solid #2A2D3A;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#FF6600;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                Wkb Snap & Sync
              </p>
              <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:900;">
                Bewijsstuk review
              </h1>
            </td>
          </tr>

          <!-- Status badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="display:inline-block;background:${statusColor(input.reviewStatus)}22;border:1px solid ${statusColor(input.reviewStatus)};border-radius:8px;padding:10px 18px;">
                <span style="color:${statusColor(input.reviewStatus)};font-weight:800;font-size:16px;">
                  ${statusLabel(input.reviewStatus)}
                </span>
              </div>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2D3A;">
                    <span style="color:#8B96A8;font-size:13px;font-weight:700;">PROJECT</span><br>
                    <span style="color:#F0F2F5;font-size:15px;font-weight:600;">${input.projectId}</span>
                  </td>
                </tr>
                ${input.inspectionPointId ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2D3A;">
                    <span style="color:#8B96A8;font-size:13px;font-weight:700;">INSPECTIEPUNT</span><br>
                    <span style="color:#F0F2F5;font-size:15px;font-weight:600;">${input.inspectionPointId}</span>
                  </td>
                </tr>` : ''}
                ${input.reviewerName ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2A2D3A;">
                    <span style="color:#8B96A8;font-size:13px;font-weight:700;">BEOORDELAAR</span><br>
                    <span style="color:#F0F2F5;font-size:15px;font-weight:600;">${input.reviewerName}</span>
                  </td>
                </tr>` : ''}
                ${input.reviewNotes ? `
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#8B96A8;font-size:13px;font-weight:700;">TOELICHTING</span><br>
                    <span style="color:#F0F2F5;font-size:15px;">${input.reviewNotes}</span>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          ${input.deepLink ? `
          <tr>
            <td style="padding:0 32px 28px;">
              <a href="${input.deepLink}" style="display:inline-block;background:#FF6600;color:#fff;font-weight:900;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                Open in Wkb Snap & Sync →
              </a>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background:#0F1117;padding:16px 32px;border-top:1px solid #2A2D3A;">
              <p style="margin:0;color:#4A5568;font-size:12px;">
                Automatisch verstuurd door Wkb Snap & Sync · Wet kwaliteitsborging voor het bouwen
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buildDossierEmailHtml = (input: DossierEmailInput) => `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wkb Dossier klaar</title>
</head>
<body style="margin:0;padding:0;background:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1117;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1A1D27;border-radius:16px;border:1px solid #2A2D3A;overflow:hidden;">

          <tr>
            <td style="background:#FF6600;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Wkb Snap & Sync</p>
              <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:900;">Dossier klaar voor overdracht</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px;">
              <p style="color:#F0F2F5;font-size:15px;line-height:24px;margin:0 0 20px;">
                Het consumentendossier voor project <strong>${input.projectId}</strong>
                ${input.projectName ? ` (${input.projectName})` : ''}
                is gegenereerd en klaar voor overdracht conform art. 7:757a BW en NPR 8092.
              </p>
              <a href="${input.pdfUrl}" style="display:inline-block;background:#FF6600;color:#fff;font-weight:900;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                📄 Download consumentendossier PDF →
              </a>
            </td>
          </tr>

          <tr>
            <td style="background:#0F1117;padding:16px 32px;border-top:1px solid #2A2D3A;">
              <p style="margin:0;color:#4A5568;font-size:12px;">
                Wkb Snap & Sync · Wet kwaliteitsborging voor het bouwen
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendReviewNotificationEmail = async (input: ReviewEmailInput): Promise<boolean> => {
  const resend = getResendClient();
  if (!resend) {
    console.warn('📧 E-mail overgeslagen: geen RESEND_API_KEY geconfigureerd.');
    return false;
  }

  const subjectPrefix = input.reviewStatus === 'REJECTED'
    ? '❌ Wkb bewijs afgekeurd'
    : input.reviewStatus === 'NEEDS_REVIEW'
    ? '🔍 Wkb bewijs: menselijke review nodig'
    : '✅ Wkb bewijs goedgekeurd';

  const subject = input.inspectionPointId
    ? `${subjectPrefix} – ${input.inspectionPointId}`
    : `${subjectPrefix} – Project ${input.projectId}`;

  try {
    const { error } = await resend.emails.send({
      from: 'Wkb Snap & Sync <noreply@wkb.speesolutions.nl>',
      to: input.toEmail,
      subject,
      html: buildReviewEmailHtml(input),
    });

    if (error) {
      console.error('📧 E-mail versturen mislukt:', error);
      return false;
    }

    console.log(`📧 Review e-mail verstuurd naar ${input.toEmail} (${input.reviewStatus})`);
    return true;
  } catch (err: any) {
    console.error('📧 E-mail service fout:', err?.message ?? err);
    return false;
  }
};

const sendDossierReadyEmail = async (input: DossierEmailInput): Promise<boolean> => {
  const resend = getResendClient();
  if (!resend) {
    console.warn('📧 Dossier e-mail overgeslagen: geen RESEND_API_KEY geconfigureerd.');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Wkb Snap & Sync <noreply@wkb.speesolutions.nl>',
      to: input.toEmail,
      subject: `📄 Consumentendossier klaar – Project ${input.projectId}`,
      html: buildDossierEmailHtml(input),
    });

    if (error) {
      console.error('📧 Dossier e-mail versturen mislukt:', error);
      return false;
    }

    console.log(`📧 Dossier e-mail verstuurd naar ${input.toEmail}`);
    return true;
  } catch (err: any) {
    console.error('📧 Dossier e-mail service fout:', err?.message ?? err);
    return false;
  }
};

module.exports = {
  sendReviewNotificationEmail,
  sendDossierReadyEmail,
};
