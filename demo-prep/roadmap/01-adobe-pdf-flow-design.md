# Adobe PDF Dossier Flow — Design Document

> Hoe het complete Wkb-dossier wordt gegenereerd, ondertekend en gearchiveerd.

---

## Status van vandaag

`dossiers` table in Supabase heeft al:
```
id (uuid), project_id, status, pdf_url, signed_by_pl, signed_by_og,
signed_at, locked_at, locked_by, created_at, tenant_id
```

→ Architectuur is geprepareerd. We hoeven alleen de **integratie** te bouwen die deze velden invult.

---

## End-to-end flow

```
[1] Project leider klikt "Genereer dossier"
       ↓
[2] Backend Node-service haalt op:
    - project metadata uit `projects`
    - alle approved evidence uit `evidence` (project_id, status=APPROVED/FINALIZED)
    - bijlagen uit `project_documents`
    - floor plan uit `floor_plans` (met pin coordinates van evidence)
       ↓
[3] Adobe Document Generation API:
    - input: WKB-Dossier.docx template + JSON data
    - output: gerenderde PDF
       ↓
[4] Backend upload PDF naar Supabase Storage bucket `wkb-evidence/dossiers/`
       ↓
[5] UPDATE `dossiers` SET pdf_url = '...', status = 'pending_signature'
       ↓
[6] Project leider tekent in app (Adobe Sign embedded of Supabase Auth-signature):
       UPDATE dossiers SET signed_by_pl = uid, signed_at = NOW()
       ↓
[7] Opdrachtgever krijgt e-mail met sign-link
       ↓
[8] Na opdrachtgever-handtekening:
       UPDATE dossiers SET signed_by_og = uid, status = 'finalized'
       Trigger: lock_dossier() → status = 'locked', locked_at = NOW()
       ↓
[9] Alle evidence in dossier wordt onveranderbaar (is_locked = true)
```

---

## Adobe-componenten die we nodig hebben

### 1. Adobe PDF Services API · Document Generation

- **SDK:** `@adobe/pdfservices-node-sdk` (npm package)
- **Credentials:** ServicePrincipalCredentials (client_id + client_secret) van Adobe Developer Console
- **Template:** Word-document met tokens `{{project.name}}`, `{{evidence.list}}`, etc.
- **Free tier:** 500 documenten/maand bij Adobe — dat dekt MVP-fase ruim

### 2. Adobe Acrobat Sign (Document Sign) — voor M5+

- **Aparte API**, niet meegeleverd in PDF Services
- Vraagt eigen Adobe Sign account
- Alternative voor MVP: **eigen e-sign flow** met Supabase Auth + canvas-signature, sla SVG op in dossier metadata. Goedkoper, snel te bouwen.

→ **Beslissing:** MVP doet eigen e-sign (canvas). M5+ migreer naar Adobe Sign als klant vraagt om eIDAS-compliant.

---

## Word-template structuur (`WKB-Dossier.docx`)

```
[Logo {{tenant.logo_url}}]                    [QR code naar PDF op Supabase]

WKB Bouwdossier
{{project.name}}
{{project.address}} · {{project.kadastrale_aanduiding}}

Initiatiefnemer:    {{project.initiator_name}}
Kwaliteitsborger:   {{project.kwaliteitsborger_name}}
Instrument:         {{project.instrument_id}}
Bouwmelding datum:  {{project.dso_meldings_datum}}

────────────────────────────────────────────

INSPECTIEPUNTEN ({{evidence.count}})

{{#each evidence}}
[Foto {{this.photo_uri}}]
Punt:        {{this.inspection_point_id}}
Discipline:  {{this.discipline_id}}
Locatie:     {{this.etage}}, {{this.ruimtenummer}}, {{this.binnenbuiten}}
GPS:         {{this.latitude}}, {{this.longitude}} (±{{this.gps_accuracy}}m)
Tijd:        {{this.timestamp}}
EXIF check:  {{#if this.exif_verified}}✓ geverifieerd{{else}}✗ niet geverifieerd{{/if}}
AI status:   {{this.ai_status}} ({{this.ai_confidence}}%)
Notitie:     {{this.field_note}}
Review:      {{this.review_status}} door {{this.reviewer_name}} op {{this.reviewed_at}}
{{#if this.review_note}}Review-notitie: {{this.review_note}}{{/if}}

────────────────
{{/each}}

────────────────────────────────────────────

PLATTEGROND MET PIN-LOCATIES
[Floor plan {{floor_plan.file_url}}]
{{#each evidence_pins}}
[Pin op ({{this.pin_x}}, {{this.pin_y}}) → {{this.inspection_point_id}}]
{{/each}}

────────────────────────────────────────────

ONDERTEKENING

Projectleider:    {{signature.pl}}     Datum: {{signed.pl_at}}
Opdrachtgever:    {{signature.og}}     Datum: {{signed.og_at}}

Dit dossier is gegenereerd op {{generation.timestamp}}
en cryptografisch verzegeld onder hash {{dossier.hash}}.

{{tenant.pdf_footer_text}}
```

---

## Backend-implementatie

Nieuwe Node-service in `backend/src/services/dossierPdfService.ts`:

```typescript
import { ServicePrincipalCredentials, PDFServices, MergeOptions, OutputFormat } from '@adobe/pdfservices-node-sdk';
import { supabaseAdmin } from '../config/supabase';

export async function generateDossierPdf(dossierId: string) {
  // 1. Fetch alle data
  const dossier = await fetchDossier(dossierId);
  const evidence = await fetchApprovedEvidence(dossier.project_id);
  const floorPlan = await fetchFloorPlan(dossier.project_id);
  const tenant = await fetchTenant(dossier.tenant_id);

  // 2. Bouw JSON payload voor template
  const payload = {
    tenant: { logo_url: tenant.logo_url, pdf_footer_text: tenant.pdf_footer_text },
    project: dossier.project,
    evidence,
    evidence_pins: evidence.filter(e => e.pin_x && e.pin_y),
    floor_plan: floorPlan,
    generation: { timestamp: new Date().toISOString() },
    dossier: { hash: await hashDossier(evidence) },
  };

  // 3. Adobe call
  const credentials = ServicePrincipalCredentials.builder()
    .withClientId(process.env.PDF_SERVICES_CLIENT_ID)
    .withClientSecret(process.env.PDF_SERVICES_CLIENT_SECRET)
    .build();
  const pdfServices = new PDFServices({ credentials });
  
  const templateAsset = await pdfServices.upload({
    readStream: fs.createReadStream('./templates/WKB-Dossier.docx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  
  const job = await pdfServices.submit({
    job: new DocumentMergeJob({
      inputAsset: templateAsset,
      jsonDataForMerge: payload,
      outputFormat: OutputFormat.PDF,
    }),
  });
  
  const result = await pdfServices.getJobResult(job);
  const pdfBuffer = await result.asset.download();

  // 4. Upload naar Supabase Storage
  const path = `dossiers/${dossier.tenant_id}/${dossierId}.pdf`;
  await supabaseAdmin.storage.from('wkb-evidence').upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // 5. UPDATE dossiers.pdf_url
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/wkb-evidence/${path}`;
  await supabaseAdmin.from('dossiers').update({
    pdf_url: publicUrl,
    status: 'pending_signature',
    updated_at: new Date().toISOString(),
  }).eq('id', dossierId);

  return publicUrl;
}
```

---

## API endpoint

```typescript
// backend/src/routes/dossierRoutes.ts
router.post('/dossiers/:id/generate-pdf', requireAuth, async (req, res) => {
  try {
    const pdfUrl = await generateDossierPdf(req.params.id);
    res.json({ ok: true, pdf_url: pdfUrl });
  } catch (e) {
    console.error('PDF generation failed', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

Frontend trigger vanuit projectleider-dossier-scherm.

---

## E-sign MVP (geen Adobe Sign)

Canvas-handtekening in app:
- `<canvas>` met touch/mouse drawing
- Save als base64 PNG
- Store in `dossiers.signed_by_pl_signature` (nieuwe kolom, base64 text)
- Apply over PDF via een tweede Adobe merge-job ná tekening

→ Voorkomt Adobe Sign-kosten in MVP. Migreer later naar Adobe Sign voor eIDAS-niveau Q.

---

## Wat nu uit te voeren in M3

1. Adobe Developer Console: PDF Services API project aanmaken, credentials genereren
2. Word template `WKB-Dossier.docx` opbouwen (kan ik in M2 als HTML mock)
3. Backend service-stub schrijven (zonder echte API call) in een `playground/` map
4. Test met echte sales-demo project: render dossier PDF van die 4 foto's
5. Upload naar Supabase Storage `wkb-evidence/dossiers/`

---

## Wat ik aan jou nodig heb

- **Adobe Developer Console account** met PDF Services API geactiveerd
- **PDF_SERVICES_CLIENT_ID** + **PDF_SERVICES_CLIENT_SECRET** in `backend/.env`
- 1× design-akkoord op template-inhoud (welke velden, welke layout)
