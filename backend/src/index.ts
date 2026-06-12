import type { Request, Response } from 'express';

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const http = require('http');
const https = require('https');
const { submitToDSO, fetchDsoStatus } = require('./dso/adapter');
const { mapToStamPayload } = require('./dso/stamMapper');
const { validateEvidenceImage } = require('./services/aiService');
const evidenceRoutes = require('./routes/evidenceRoutes');
const dossierRoutes = require('./routes/dossierRoutes');
const afasRoutes = require('./routes/afasRoutes');
const erpRoutes = require('./routes/erpRoutes');
const exactRoutes = require('./routes/exactRoutes');
const kikRoutes = require('./routes/kikRoutes');
const stamRoutes = require('./routes/stamRoutes');
const dsoRoutes = require('./routes/dsoRoutes');
const bimRoutes = require('./routes/bimRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const makerRoutes = require('./routes/makerRoutes');
const { startKiKRetryJob } = require('./jobs/kikRetryCron');
const { startDossierRefreshJob } = require('./jobs/dossierRefreshCron');
const { backendConfig, hasSupabaseConfig } = require('./config');
const { requireAuth } = require('./middleware/auth');
const tenantRoutes = require('./routes/tenant.routes');

dotenv.config();

const app = express();

type EvidenceRow = {
  id: number;
  photo_uri: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number | null;
  timestamp: string;
  project_id?: string | null;
  inspection_point_id?: string | null;
  exif_verified?: boolean | number | null;
  field_note?: string | null;
  stop_moment_confirmed?: boolean | null;
  measurement_tool_confirmed?: boolean | null;
  location_verified?: boolean | null;
  location_spoof_risk?: string | null;
  location_security_message?: string | null;
  ai_status?: string | null;
  ai_confidence?: number | null;
  ai_notes?: string | null;
  betonkwaliteit?: string | null;
  milieuklasse?: string | null;
  volume?: string | null;
  leverdatum?: string | null;
};

let supabaseClient: any | null = null;

app.use(cors());
app.use(express.json());
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/wkb-evidence', requireAuth, evidenceRoutes);
app.use('/api/wkb-dossier', requireAuth, dossierRoutes);
app.use('/api/erp/afas', afasRoutes);
app.use('/api/integrations/erp', erpRoutes);
app.use('/api/integrations/exact-online', exactRoutes);
app.use('/api/kik', kikRoutes);
app.use('/api/integrations/kik', kikRoutes);
app.use('/api/stam', requireAuth, stamRoutes);
app.use('/api/integrations/dso', dsoRoutes);
app.use('/api/integrations/bim', requireAuth, bimRoutes);
app.use('/api/wkb-ai/ocr', requireAuth, ocrRoutes);
app.use('/api/review', requireAuth, reviewRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/maker', makerRoutes);

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt');
  }
  if (!supabaseClient) {
    supabaseClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }
  return supabaseClient;
};

const fetchBuffer = (url: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (response: any) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          fetchBuffer(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });

const isVerifiedFlag = (value: EvidenceRow['exif_verified']) =>
  value === true || value === 1;

const buildDossier = (projectId: string, evidence: EvidenceRow[]) => ({
  project_id: projectId,
  gevolgklasse: 1,
  status: evidence.length > 0 ? 'In Uitvoering' : 'Leeg dossier',
  aantal_bewijsstukken: evidence.length,
    bewijslast: evidence.map((item) => ({
      id: item.id,
      locatie_gps: `${item.latitude}, ${item.longitude}`,
      gps_nauwkeurigheid_m: item.gps_accuracy ?? null,
      locatie_gevalideerd: item.location_verified ?? null,
      locatie_spoof_risico: item.location_spoof_risk ?? null,
      locatie_uitleg: item.location_security_message ?? null,
      tijdstip: item.timestamp,
      verificatie_foto: item.photo_uri,
      exif_gevalideerd: isVerifiedFlag(item.exif_verified),
      inspectiepunt: item.inspection_point_id ?? 'onbekend',
      veldnotitie: item.field_note ?? null,
      stopmoment_bevestigd: item.stop_moment_confirmed ?? null,
      meetmiddel_bevestigd: item.measurement_tool_confirmed ?? null,
      betonkwaliteit: item.betonkwaliteit ?? null,
      milieuklasse: item.milieuklasse ?? null,
      volume: item.volume ?? null,
      leverdatum: item.leverdatum ?? null,
      ai_validatie: item.ai_status ?? 'PENDING',
      ai_notities: item.ai_notes ?? null,
    })),
});

const getStringField = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getNumberField = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
};

const normalizeInspectionPointId = (inspectionPointId: string) => {
  const normalized = inspectionPointId.trim().toLowerCase();

  if (normalized.includes('wapening')) {
    return 'wapening';
  }

  return normalized;
};

app.get('/qr', (req: Request, res: Response) => {
  // Demo-pagina toont demo-inloggegevens; alleen beschikbaar wanneer expliciet
  // aangezet. Standaard doen we alsof de route niet bestaat (404).
  if (!backendConfig.enableQrDemo) {
    return res.status(404).send('Not found');
  }
  const QRCode = require('qrcode');
  const tunnelUrl = 'https://wkb-snap-sync.vercel.app';
  QRCode.toDataURL(tunnelUrl, { width: 300, margin: 2 }, (err: any, dataUrl: string) => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>WKB Snap & Sync</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
h1{font-size:2rem;font-weight:900;margin-bottom:4px;letter-spacing:-1px}
h1 span{color:#E8500A}
.sub{color:#555;margin-bottom:22px;font-size:.9rem}
.qr-wrap{background:#fff;border-radius:18px;padding:18px;display:inline-block;margin-bottom:20px;box-shadow:0 0 50px rgba(232,80,10,0.3)}
.card{background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:16px 22px;max-width:340px;width:100%;margin-bottom:10px}
.card h3{margin:0 0 10px;font-size:.78rem;color:#E8500A;text-transform:uppercase;letter-spacing:.5px}
.row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #1a1a1a}
.row:last-child{border-bottom:none}
.lbl{color:#555;font-size:.8rem}
.val{color:#fff;font-size:.82rem;font-weight:600;font-family:monospace}
.green{color:#22c55e}
.step{display:flex;align-items:center;gap:10px;margin:7px 0;text-align:left}
.num{background:#E8500A;color:#fff;border-radius:50%;width:24px;height:24px;min-width:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem}
.step-text{font-size:.83rem;color:#aaa}
.badge{background:#E8500A;color:#fff;font-size:.65rem;font-weight:700;padding:2px 10px;border-radius:20px;margin-bottom:12px;display:inline-block}
</style></head>
<body>
<div class="badge">🔴 LIVE</div>
<h1>WKB <span>Snap &amp; Sync</span></h1>
<p class="sub">Bouwproject Den Haag &mdash; 104A</p>

<div class="qr-wrap"><img src="${err ? '' : dataUrl}" width="260" height="260"></div>

<div class="card">
  <h3>📱 Open in Safari of Chrome</h3>
  <div class="step"><div class="num">1</div><div class="step-text">Scan de QR code met je iPhone camera</div></div>
  <div class="step"><div class="num">2</div><div class="step-text">Safari opent automatisch &mdash; geen app nodig</div></div>
  <div class="step"><div class="num">3</div><div class="step-text">Inloggen of tik <b>Snel Toegang</b> voor demo</div></div>
</div>

<div class="card">
  <h3>🔐 Inloggegevens</h3>
  <div class="row"><span class="lbl">Werkvoorbereider</span><span class="val">johnny@speesolutions.nl</span></div>
  <div class="row"><span class="lbl">Onderaannemer</span><span class="val">onderaannemer@demo.nl</span></div>
  <div class="row"><span class="lbl">Kwaliteitsborger</span><span class="val">kwaliteitsborger@demo.nl</span></div>
  <div class="row"><span class="lbl">Wachtwoord (allen)</span><span class="val">wkb2026</span></div>
</div>

<div class="card">
  <h3>✅ Status</h3>
  <div class="row"><span class="lbl">App URL</span><span class="val green">● wkb-snap-sync.vercel.app</span></div>
  <div class="row"><span class="lbl">Database</span><span class="val green">● Supabase verbonden</span></div>
  <div class="row"><span class="lbl">Gebruikers</span><span class="val green">3 accounts actief</span></div>
</div>

</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'Wkb Aggregation Engine',
    timestamp: new Date().toISOString(),
    config: {
      supabaseConfigured: hasSupabaseConfig(),
      dsoEnvironment: backendConfig.dsoEnvironment,
      dsoAdapterConfigured: Boolean(backendConfig.digikoppelingApiUrl),
      emailConfigured: Boolean(backendConfig.resendApiKey),
    },
  });
});

app.get('/api/admin/ai-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: evidence, error } = await supabase
      .from('evidence')
      .select('ai_status');

    if (error) {
      throw error;
    }

    const stats = {
      totalProcessed: evidence?.length || 0,
      passed: 0,
      needsReview: 0,
      failed: 0,
      pending: 0,
    };

    (evidence || []).forEach((item: { ai_status: string | null }) => {
      const status = (item.ai_status || 'PENDING').toUpperCase();
      if (['APPROVED', 'OK', 'PASSED'].includes(status)) {
        stats.passed++;
      } else if (status === 'NEEDS_REVIEW') {
        stats.needsReview++;
      } else if (status === 'FAILED') {
        stats.failed++;
      } else {
        stats.pending++;
      }
    });

    res.status(200).json(stats);
  } catch (error: any) {
    const message = error?.message ?? 'Kon AI-statistieken niet ophalen.';
    console.error('Fout bij ophalen AI-statistieken:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/api/dossier/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    const supabase = getSupabaseAdminClient();

    const { data: evidence, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json(buildDossier(projectId, evidence ?? []));
  } catch (error: any) {
    const message = error?.message ?? 'Kon Wkb-dossier niet genereren.';
    console.error('Fout bij ophalen dossier:', message);
    res.status(message.includes('configuratie') ? 503 : 500).json({ error: message });
  }
});

app.get('/api/dossier/:projectId/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    const dossierType = (req.query.type as string) ?? 'bevoegd-gezag';
    const aannemer = (req.query.aannemer as string) ?? '—';
    const adres = (req.query.adres as string) ?? '—';
    const gevolgklasse = (req.query.gevolgklasse as string) ?? '1';
    const kwaliteitsborger = (req.query.kwaliteitsborger as string) ?? '—';
    const supabase = getSupabaseAdminClient();

    const { data: evidence, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    const doc = new PDFDocument({ autoFirstPage: false, margin: 50 });
    const filename = `wkb-dossier-${projectId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);

    doc.addPage();
    doc.fontSize(20).text('Wkb Dossier Export', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Project: ${projectId}`)
      .text(`Type: ${dossierType}`)
      .text(`Datum export: ${new Date().toLocaleString('nl-NL')}`)
      .text(`Aantal bewijsstukken: ${evidence?.length ?? 0}`);
    doc.moveDown(0.6);
    doc.fontSize(13).text('Projectgegevens', { underline: true });
    doc
      .moveDown(0.3)
      .fontSize(11)
      .text(`Aannemer: ${aannemer}`)
      .text(`Adres: ${adres}`)
      .text(`Gevolgklasse: ${gevolgklasse}`)
      .text(`Kwaliteitsborger: ${kwaliteitsborger}`);
    doc.moveDown(0.8);
    doc.fontSize(13).text('Kernwaarden van de tool', { underline: true });
    doc
      .moveDown(0.3)
      .fontSize(11)
      .text(
        'Wkb Snap & Sync is een offline-first Wkb-tool voor Gevolgklasse 1. Bewijs wordt lokaal veilig vastgelegd en later gesynchroniseerd met cloudopslag en dossier-API.'
      )
      .moveDown(0.4)
      .text('Architectuurpijlers:')
      .text('1. Veld-camera met GPS en EXIF.')
      .text('2. Lokale SQLite-kluis voor offline gebruik.')
      .text('3. Cloud sync via Supabase Storage en tabellen.')
      .text('4. AI-kwaliteitscontrole met directe feedback.')
      .text('5. PDF-export voor bevoegd gezag en consument.');

    for (const [index, item] of (evidence ?? []).entries()) {
      doc.addPage();
      doc.fontSize(16).text(`Bewijsstuk ${index + 1}`, { underline: true });
      doc.moveDown(0.5);

      doc
        .fontSize(11)
        .text(`ID: ${item.id}`)
        .text(`Project: ${item.project_id ?? projectId}`)
        .text(`Inspectiepunt: ${item.inspection_point_id ?? 'onbekend'}`)
        .text(`Tijdstip: ${item.timestamp}`)
        .text(`GPS: ${item.latitude}, ${item.longitude}`)
        .text(
          `GPS nauwkeurigheid: ${
            item.gps_accuracy != null ? `${item.gps_accuracy.toFixed(1)}m` : '—'
          }`
        )
        .text(`EXIF geverifieerd: ${isVerifiedFlag(item.exif_verified) ? 'Ja' : 'Nee'}`)
        .text(`Veldnotitie: ${item.field_note ?? '—'}`)
        .text(
          `AI status: ${item.ai_status ?? 'PENDING'}${
            item.ai_confidence != null
              ? ` (${Math.round(item.ai_confidence * 100)}%)`
              : ''
          }`
        )
        .text(`AI notities: ${item.ai_notes ?? '—'}`);

      if (item.photo_uri && typeof item.photo_uri === 'string') {
        if (item.photo_uri.startsWith('http')) {
          try {
            const imageBuffer = await fetchBuffer(item.photo_uri);
            doc.moveDown(0.5);
            doc.image(imageBuffer, {
              fit: [500, 350],
              align: 'center',
              valign: 'center',
            });
          } catch (imageError) {
            doc
              .moveDown(0.5)
              .fontSize(10)
              .fillColor('#666')
              .text(`Foto niet geladen: ${item.photo_uri}`)
              .fillColor('#000');
          }
        } else {
          doc
            .moveDown(0.5)
            .fontSize(10)
            .fillColor('#666')
            .text(`Foto lokaal pad: ${item.photo_uri}`)
            .fillColor('#000');
        }
      }
    }

    // Add Signature and Audit Trail Block
    doc.addPage();
    doc.fontSize(16).text('Ondertekening & Audittrail', { underline: true });
    doc.moveDown(1);
    
    doc.fontSize(11).text('Dit dossier is onweerlegbaar vastgelegd en gesynchroniseerd via Wkb Snap & Sync.');
    doc.text(`Hash/Kenmerk: WKB-${projectId}-${Date.now().toString(36).toUpperCase()}`);
    doc.text(`Datum verzegeling: ${new Date().toLocaleString('nl-NL')}`);
    
    doc.moveDown(3);
    doc.fontSize(12).text('Handtekening Hoofdaannemer', { align: 'left' });
    doc.moveDown(2);
    doc.text('_________________________________', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Naam: ${aannemer}`, { align: 'left' });
    
    doc.moveUp(5);
    doc.fontSize(12).text('Handtekening Kwaliteitsborger', { align: 'right' });
    doc.moveDown(2);
    doc.text('_________________________________', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Naam: ${kwaliteitsborger}`, { align: 'right' });

    doc.end();
  } catch (error: any) {
    const message = error?.message ?? 'Kon PDF dossier niet genereren.';
    console.error('Fout bij exporteren PDF:', message);
    res.status(message.includes('configuratie') ? 503 : 500).json({ error: message });
  }
});

app.post('/api/ai/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const payload =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : {};

    const photoUri = getStringField(payload, ['photo_uri', 'photoUri']);
    const inspectionPointId = getStringField(payload, [
      'inspection_point_id',
      'inspectionPointId',
    ]);
    const timestamp = getStringField(payload, ['timestamp']);
    const latitude = getNumberField(payload, 'latitude');
    const longitude = getNumberField(payload, 'longitude');
    const template = payload.template as any;

    if (!photoUri || !inspectionPointId) {
      return res.status(400).json({
        error:
          'Bad Request: photoUri/photo_uri en inspectionPointId/inspection_point_id zijn verplicht.',
      });
    }

    const checks: string[] = [];

    if (!timestamp) {
      checks.push('Tijdstempel ontbreekt');
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      checks.push('GPS-coordinaten ontbreken');
    }

    if (checks.length > 0) {
      return res.json({
        status: 'FAILED',
        confidence: 0.28,
        detectedObjects: [],
        feedback: `Cloud AI check faalde: ${checks.join(', ')}`,
        checks,
      });
    }

    const validationResult = await validateEvidenceImage(
      photoUri,
      normalizeInspectionPointId(inspectionPointId),
      template
    );

    return res.json(validationResult);
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message ?? 'AI Validatie mislukt. Controleer de verbinding met het model.',
    });
  }
});

app.post('/api/dso/stam/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = mapToStamPayload(req.body ?? {});
    const response = await submitToDSO(payload);
    res.status(response.success ? 202 : 422).json({
      ...response,
      referenceId: response.dsoReferentieId ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'DSO submit failed' });
  }
});

app.get('/api/dso/stam/status/:referenceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const response = await fetchDsoStatus(req.params.referenceId);
    res.json({
      ...response,
      referenceId: response.dsoReferentieId ?? req.params.referenceId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'DSO status failed' });
  }
});

const server = app.listen(backendConfig.port, () => {
  console.log(`🚀 Wkb Backend Server draait op port ${backendConfig.port}`);
  startKiKRetryJob();
  startDossierRefreshJob();
});

server.on('error', (err: any) => {
  console.error('[FATAL] Server Error:', err);
});
