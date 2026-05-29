# M3 — Adobe PDF Dossier POC

> Backend-service die een WKB-dossier-PDF genereert uit Supabase-data
> en uploadt naar storage. Werkt zonder Adobe (local renderer) én met Adobe.

---

## Bestanden

| File | Doel |
|---|---|
| `dossierPdfService.ts` | Hoofd-service, dual renderer (local/adobe) |
| `dossierRoutes.ts` | Express route `POST /api/v1/dossiers/:id/generate-pdf` |
| `test-generate.ts` | Test-script voor sales-demo project |

---

## Activatie in de bestaande backend

1. Kopieer `dossierPdfService.ts` naar `backend/src/services/dossierPdfService.ts`
2. Kopieer `dossierRoutes.ts` naar `backend/src/routes/dossierRoutes.ts`
3. In `backend/src/server.ts` toevoegen:
   ```typescript
   import dossierRoutes from './routes/dossierRoutes';
   app.use('/api/v1/dossiers', dossierRoutes);
   ```
4. Installeer dependencies:
   ```bash
   cd backend
   npm install puppeteer handlebars @adobe/pdfservices-node-sdk
   ```
5. Voeg eventueel Adobe credentials toe aan `backend/.env`:
   ```
   PDF_SERVICES_CLIENT_ID=...
   PDF_SERVICES_CLIENT_SECRET=...
   ```
   (Optioneel — zonder werkt 'local' pad ook prima)

---

## Testen lokaal

```bash
cd demo-prep/build/m3-adobe-poc

# Met env vars uit backend/.env
export SUPABASE_URL="$(grep SUPABASE_URL ../../backend/.env | cut -d= -f2)"
export SUPABASE_SERVICE_KEY="$(grep SUPABASE_SERVICE_KEY ../../backend/.env | cut -d= -f2)"

# Local renderer (Puppeteer) — geen Adobe nodig
npx ts-node test-generate.ts local

# Adobe renderer (vereist credentials)
export PDF_SERVICES_CLIENT_ID=...
export PDF_SERVICES_CLIENT_SECRET=...
npx ts-node test-generate.ts adobe
```

Resultaat: PDF op `/tmp/dossier-<id>.pdf`.

---

## Wat de service precies doet

```
[1] Service ontvangt dossierId
[2] Haalt op uit Supabase:
    - dossier + project (join)
    - tenant
    - approved/finalized evidence
    - floor_plan
[3] Berekent SHA-256 hash van evidence-set (voor verzegeling)
[4] Bouwt payload-JSON voor template-render
[5] Rendert:
    - 'local'  → Handlebars compile + Puppeteer print to PDF
    - 'adobe'  → Document Generation API met Word template
[6] Uploadt naar Supabase Storage bucket 'wkb-evidence/dossiers/<tenant>/<id>.pdf'
[7] UPDATE dossiers.pdf_url + status='pending_signature'
[8] Returnt public URL
```

---

## Adobe credentials aanmaken

1. Ga naar https://developer.adobe.com/console
2. "Create new project"
3. "Add API" → kies **PDF Services API**
4. "Service Account (JWT)" → genereer credentials
5. Download JSON, kopieer `client_id` en `client_secret`
6. Paste in `backend/.env`

Gratis tier: **500 transacties per maand**. Voor MVP > genoeg.

---

## Adobe Sign integratie (M5+)

Adobe Sign is een aparte API. Voor MVP gebruiken we **eigen e-sign**:
1. Canvas-handtekening in app (`signed_by_pl_signature TEXT` in dossiers — base64 PNG)
2. Tweede merge-job die handtekening over PDF zet
3. Verzegelen met `lock_dossier()` RPC

Migreer naar Adobe Sign als klant eIDAS-niveau Q vraagt (extra contract bij Adobe).

---

## Bekende beperkingen van deze POC

- Geen retry bij Adobe-API throttling (toevoegen in productie)
- Geen caching van templates (elke render compileert opnieuw)
- Geen async/queue (PDF-generatie blokkeert de request)
- Geen image-download van photo_uri's vóór Adobe-render (Adobe haalt ze zelf op)
- Word-template (.docx) moet handmatig gemaakt vanuit de HTML-template

→ Voor productie: voeg `bull-queue` toe en stuur generatie naar background-worker.
