# WKB-Dossier template — M2

## Twee versies

| Bestand | Doel |
|---|---|
| `WKB-Dossier-template.html` | HTML met Handlebars-tokens — voor lokale rendering naar PDF via headless Chrome of Puppeteer |
| `WKB-Dossier.docx` (te maken) | Word-document met Adobe Document Generation-tokens — voor Adobe PDF Services |

## Twee renderings-paden

### Pad A — HTML → PDF (zonder Adobe)
- Headless Chrome / Puppeteer / `wkhtmltopdf`
- Voordelen: geen externe API, geen kosten, snel
- Nadelen: minder geavanceerde document-engine, geen Adobe Sign-integratie

### Pad B — Word → PDF via Adobe PDF Services
- `@adobe/pdfservices-node-sdk` met Document Generation API
- Voordelen: Adobe-grade kwaliteit, klaar voor Adobe Sign
- Nadelen: Adobe credentials nodig, free-tier 500/mnd

## MVP-keuze

Voor M3 bouwen we BEIDE paden:
1. Pad A werkt direct, geen credentials nodig → demo-ready
2. Pad B als upgrade-pad als Adobe credentials beschikbaar

In `m3-adobe-poc/` staan beide implementaties side-by-side.

## Token-syntax

Handlebars-stijl `{{token}}` werkt voor beide:
- Adobe Document Generation: `{{customer.name}}` syntax
- Lokale Handlebars rendering: idem

Verschil: Adobe heeft eigen syntax voor loops (`{{#tablename}}...{{/tablename}}`),
Handlebars gebruikt `{{#each}}...{{/each}}`. Voor cross-compatibility houden we
de Adobe-syntax in de docx, en converteren in de Node-service voor Handlebars-rendering.

## Aanpassingen die Combivo zou willen

- Eigen logo op cover (al via `tenant.logo_url`)
- Eigen primary_color in headers (al via `tenant.primary_color`)
- Eigen footer (al via `tenant.pdf_footer_text`)
- Eigen briefpapier-watermerk (toevoegen in Pad B als Combivo het levert)
