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

// ─── Welkom-mail voor nieuwe SpeeQ-klant (Maker-wizard) ────────────────

type WelcomeEmailInput = {
  toEmail: string;
  toName: string;
  bedrijfsnaam: string;
  wachtwoord: string;
  loginUrl: string;
  accentKleur: string;
  logoUrl?: string | null;
};

const escHtmlBackend = (s: string) => s.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] ?? c));

const buildWelcomeEmailHtml = (input: WelcomeEmailInput) => {
  const logoBlock = input.logoUrl
    ? `<img src="${input.logoUrl}" alt="${escHtmlBackend(input.bedrijfsnaam)}" style="max-width:120px;max-height:60px;margin-bottom:20px;" />`
    : '';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#18181B;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F4F5;padding:40px 20px;">
<tr><td align="center">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E4E4E7;overflow:hidden;max-width:560px;">
    <tr><td style="padding:8px;background:${input.accentKleur};"></td></tr>
    <tr><td style="padding:36px 36px 28px;">
      ${logoBlock}
      <p style="font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${input.accentKleur};margin:0 0 8px;">WELKOM</p>
      <h1 style="font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;font-size:28px;font-weight:700;color:#09090B;letter-spacing:-0.5px;margin:0 0 12px;line-height:34px;">
        Hallo ${escHtmlBackend(input.toName)},
      </h1>
      <p style="font-size:15px;line-height:24px;color:#52525B;margin:0 0 20px;">
        Welkom bij <strong>SpeeQ WKB</strong>! We hebben een account aangemaakt voor <strong>${escHtmlBackend(input.bedrijfsnaam)}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:12px;margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#71717A;margin:0 0 10px;">Inloggegevens</p>
          <p style="font-size:13px;color:#52525B;margin:0 0 4px;font-family:Menlo,monospace;">
            <span style="color:#18181B;">${escHtmlBackend(input.toEmail)}</span>
          </p>
          <p style="font-size:13px;color:#52525B;margin:0;font-family:Menlo,monospace;">
            Wachtwoord: <strong style="color:#18181B;">${escHtmlBackend(input.wachtwoord)}</strong>
          </p>
        </td></tr>
      </table>
      <a href="${input.loginUrl}" style="display:inline-block;background:${input.accentKleur};color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;margin-bottom:24px;">
        Inloggen op SpeeQ →
      </a>
      <h3 style="font-size:14px;font-weight:700;color:#18181B;margin:8px 0 10px;">Eerste stappen</h3>
      <ol style="font-size:14px;line-height:22px;color:#52525B;margin:0 0 20px;padding-left:18px;">
        <li>Log in en wijzig je wachtwoord</li>
        <li>Vul je bedrijfsbranding aan (logo + kleur)</li>
        <li>Nodig werkvoorbereiders en vakmannen uit via Team Beheer</li>
      </ol>
      <hr style="border:0;border-top:1px solid #E4E4E7;margin:24px 0;" />
      <p style="font-size:12px;color:#71717A;margin:0;">
        Hulp nodig? Reply op deze mail of bel <a href="tel:+31681908480" style="color:${input.accentKleur};text-decoration:none;">+31 6 81908480</a>.
      </p>
      <p style="font-size:12px;color:#71717A;margin:14px 0 0;">
        Hartelijk welkom,<br/>
        <strong style="color:#18181B;">Johnny Spee</strong> · Spee Solutions
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
};

const sendWelcomeEmail = async (input: WelcomeEmailInput): Promise<{ ok: boolean; error?: string }> => {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY niet geconfigureerd op de server.' };
  }
  try {
    const { error } = await resend.emails.send({
      // Verzendadres: wkb.speesolutions.nl subdomein is al volledig
      // geverifieerd in Resend (gebruikt door review + dossier mails).
      // Reply-to wijst naar johnny@ zodat klanten direct kunnen reageren
      // zonder dat we DNS-validatie voor speesolutions.com hoeven.
      from: 'Johnny Spee <noreply@wkb.speesolutions.nl>',
      replyTo: 'johnny@speesolutions.com',
      to: input.toEmail,
      subject: `Welkom bij SpeeQ — ${input.bedrijfsnaam}`,
      html: buildWelcomeEmailHtml(input),
    });
    if (error) {
      console.error('📧 Welkom-mail mislukt:', error);
      return { ok: false, error: String((error as { message?: string }).message ?? error) };
    }
    console.log(`📧 Welkom-mail verstuurd naar ${input.toEmail}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('📧 Welkom-mail exception:', msg);
    return { ok: false, error: msg };
  }
};

// ─── Technische alert: AI mock-fallback ingesprongen ───────────────────
// Vuurt wanneer zowel Gemini als OpenAI faalt en de mock-fallback de validatie
// overneemt. Zonder dit alert blijft een productie-degradatie onzichtbaar
// (de gebruiker krijgt een "geldig" mock-antwoord, maar de echte AI is stuk).

type AiFallbackAlertInput = {
  inspectionPoint: string;
  imageUrl: string;
  geminiError?: string;
  openaiError?: string;
};

const sendAiFallbackAlertEmail = async (input: AiFallbackAlertInput): Promise<boolean> => {
  const resend = getResendClient();
  if (!resend) {
    console.warn('🚨 AI-fallback alert overgeslagen: geen RESEND_API_KEY geconfigureerd.');
    return false;
  }

  const to = backendConfig.alertEmail;
  const when = new Date().toISOString();
  const html = `<!DOCTYPE html>
<html lang="nl"><body style="margin:0;padding:0;background:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1117;padding:32px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#1A1D27;border-radius:16px;border:1px solid #DC2626;overflow:hidden;">
      <tr><td style="background:#DC2626;padding:24px 32px;">
        <p style="margin:0;color:#fff;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">SpeeQ · Productie-alert</p>
        <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:900;">🚨 AI mock-fallback ingesprongen</h1>
      </td></tr>
      <tr><td style="padding:24px 32px;color:#F0F2F5;font-size:14px;line-height:22px;">
        <p style="margin:0 0 16px;">Beide AI-providers faalden. De mock-fallback heeft de validatie overgenomen — gebruikers krijgen een <strong>nep-resultaat</strong> dat eruitziet als echte AI. Actie vereist.</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #2A2D3A;"><span style="color:#8B96A8;font-size:12px;font-weight:700;">TIJDSTIP</span><br><span>${when}</span></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #2A2D3A;"><span style="color:#8B96A8;font-size:12px;font-weight:700;">INSPECTIEPUNT</span><br><span>${input.inspectionPoint}</span></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #2A2D3A;"><span style="color:#8B96A8;font-size:12px;font-weight:700;">AFBEELDING</span><br><span style="word-break:break-all;font-size:12px;">${input.imageUrl}</span></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #2A2D3A;"><span style="color:#8B96A8;font-size:12px;font-weight:700;">GEMINI-FOUT</span><br><span style="font-family:Menlo,monospace;font-size:12px;color:#F59E0B;">${input.geminiError ?? 'onbekend'}</span></td></tr>
          <tr><td style="padding:8px 0;"><span style="color:#8B96A8;font-size:12px;font-weight:700;">OPENAI-FOUT</span><br><span style="font-family:Menlo,monospace;font-size:12px;color:#F59E0B;">${input.openaiError ?? 'onbekend'}</span></td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#0F1117;padding:16px 32px;border-top:1px solid #2A2D3A;">
        <p style="margin:0;color:#4A5568;font-size:12px;">Automatische monitoring · SpeeQ backend (aiService.ts)</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: 'SpeeQ Monitoring <noreply@wkb.speesolutions.nl>',
      to,
      subject: `🚨 SpeeQ AI-uitval — mock-fallback actief (${input.inspectionPoint})`,
      html,
    });
    if (error) {
      console.error('🚨 AI-fallback alert versturen mislukt:', error);
      return false;
    }
    console.log(`🚨 AI-fallback alert verstuurd naar ${to}`);
    return true;
  } catch (err: any) {
    console.error('🚨 AI-fallback alert service fout:', err?.message ?? err);
    return false;
  }
};

module.exports = {
  sendReviewNotificationEmail,
  sendDossierReadyEmail,
  sendWelcomeEmail,
  sendAiFallbackAlertEmail,
};
