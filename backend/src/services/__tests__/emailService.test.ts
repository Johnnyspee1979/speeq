/**
 * Unit-tests voor emailService — de transactionele mails (review, dossier,
 * welkom, AI-fallback-alert) via Resend.
 *
 * Borgt het fail-safe gedrag rond e-mail: zónder RESEND_API_KEY wordt er nooit
 * verstuurd (en blokkeert niets), en een Resend-fout of -exception levert een
 * "niet verstuurd"-resultaat op i.p.v. een crash. Daarnaast de onderwerp-logica
 * (status-prefix + inspectiepunt/project) en de HTML-escaping van klantinvoer
 * in de welkom-mail (anti-injectie in een gebrande mail).
 */

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...a: unknown[]) => mockSend(...a) },
  })),
}));

const mockConfig: { resendApiKey: string; alertEmail: string } = {
  resendApiKey: 'test_key',
  alertEmail: 'alerts@speesolutions.nl',
};
jest.mock('../../config', () => ({ backendConfig: mockConfig }));

const {
  sendReviewNotificationEmail,
  sendDossierReadyEmail,
  sendWelcomeEmail,
  sendAiFallbackAlertEmail,
} = require('../emailService');

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.resendApiKey = 'test_key';
  mockConfig.alertEmail = 'alerts@speesolutions.nl';
  mockSend.mockResolvedValue({ error: null });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const review = (over: Record<string, unknown> = {}) => ({
  toEmail: 'reviewer@x.nl',
  projectId: 'p-1',
  reviewStatus: 'APPROVED' as const,
  ...over,
});

describe('sendReviewNotificationEmail', () => {
  it('slaat over (false) zonder RESEND_API_KEY en verstuurt niets', async () => {
    mockConfig.resendApiKey = '';
    await expect(sendReviewNotificationEmail(review())).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('verstuurt en geeft true bij succes', async () => {
    await expect(sendReviewNotificationEmail(review())).resolves.toBe(true);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.to).toBe('reviewer@x.nl');
    expect(arg.from).toContain('wkb.speesolutions.nl');
  });

  it('kiest de onderwerp-prefix per status', async () => {
    await sendReviewNotificationEmail(review({ reviewStatus: 'APPROVED' }));
    await sendReviewNotificationEmail(review({ reviewStatus: 'NEEDS_REVIEW' }));
    await sendReviewNotificationEmail(review({ reviewStatus: 'REJECTED' }));
    const [a, b, c] = mockSend.mock.calls.map((call) => call[0].subject);
    expect(a).toContain('goedgekeurd');
    expect(b).toContain('review');
    expect(c).toContain('afgekeurd');
  });

  it('zet het inspectiepunt in het onderwerp, anders het project', async () => {
    await sendReviewNotificationEmail(review({ inspectionPointId: 'WAPENING-1' }));
    expect(mockSend.mock.calls[0][0].subject).toContain('WAPENING-1');

    mockSend.mockClear();
    await sendReviewNotificationEmail(review());
    expect(mockSend.mock.calls[0][0].subject).toContain('Project p-1');
  });

  it('geeft false als Resend een error teruggeeft', async () => {
    mockSend.mockResolvedValue({ error: { message: 'bounce' } });
    await expect(sendReviewNotificationEmail(review())).resolves.toBe(false);
  });

  it('geeft false bij een exception (blokkeert niet)', async () => {
    mockSend.mockRejectedValue(new Error('netwerk weg'));
    await expect(sendReviewNotificationEmail(review())).resolves.toBe(false);
  });
});

describe('sendDossierReadyEmail', () => {
  const dossier = { toEmail: 'klant@x.nl', projectId: 'p-9', pdfUrl: 'https://x/d.pdf' };

  it('slaat over (false) zonder API-key', async () => {
    mockConfig.resendApiKey = '';
    await expect(sendDossierReadyEmail(dossier)).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('verstuurt met het project in het onderwerp', async () => {
    await expect(sendDossierReadyEmail(dossier)).resolves.toBe(true);
    expect(mockSend.mock.calls[0][0].subject).toContain('p-9');
  });
});

describe('sendWelcomeEmail', () => {
  const welkom = {
    toEmail: 'nieuw@x.nl',
    toName: 'Jan',
    bedrijfsnaam: 'Combivo',
    wachtwoord: 'Geheim123',
    loginUrl: 'https://app.speesolutions.com',
    accentKleur: '#FF6600',
  };

  it('geeft {ok:false} met foutmelding zonder API-key', async () => {
    mockConfig.resendApiKey = '';
    const res = await sendWelcomeEmail(welkom);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/RESEND_API_KEY/);
  });

  it('verstuurt met reply-to naar johnny@ en geeft {ok:true}', async () => {
    const res = await sendWelcomeEmail(welkom);
    expect(res).toEqual({ ok: true });
    expect(mockSend.mock.calls[0][0].replyTo).toBe('johnny@speesolutions.com');
  });

  it('escapet klantinvoer in de HTML (anti-injectie)', async () => {
    await sendWelcomeEmail({ ...welkom, toName: '<script>x</script>' });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('geeft {ok:false} als Resend een error teruggeeft', async () => {
    mockSend.mockResolvedValue({ error: { message: 'geweigerd' } });
    const res = await sendWelcomeEmail(welkom);
    expect(res.ok).toBe(false);
  });
});

describe('sendAiFallbackAlertEmail', () => {
  const alert = { inspectionPoint: 'WAPENING', imageUrl: 'https://x/a.jpg' };

  it('slaat over (false) zonder API-key', async () => {
    mockConfig.resendApiKey = '';
    await expect(sendAiFallbackAlertEmail(alert)).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stuurt het alert naar het geconfigureerde alert-adres', async () => {
    await expect(sendAiFallbackAlertEmail(alert)).resolves.toBe(true);
    expect(mockSend.mock.calls[0][0].to).toBe('alerts@speesolutions.nl');
  });
});
