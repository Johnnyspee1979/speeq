# Final rapport — Productie-ready week (M1–M5)

> Stand 29 mei 2026 · alle milestones afgerond
> Voor de Combivo-meeting van volgende week

---

## TL;DR — wat is er gebeurd deze week

In één sessie:
1. **Roadmap** voor 100% product klaar
2. **Combivo-specifieke module** (Achterstallig onderhoud) ontworpen + SQL klaar
3. **Adobe PDF Dossier-flow** volledig uitgewerkt: backend service code, API routes, test scripts, Word/HTML templates
4. **Security migration** geverifieerd via dry-run op productie — 2 bugs gevonden + gefixt
5. **E2E test-script** geschreven voor de volledige WKB-flow
6. **Combivo-presentatie v2** met nieuwe modules ingebouwd

Alles staat in `demo-prep/`, gecommit naar GitHub.

---

## Wat is 100% klaar

### Code
- `demo-prep/build/m2-schema/004_achterstallig_onderhoud.sql` — gevalideerd
- `demo-prep/build/m2-ui-mock/achterstallig-dashboard.html` — premium UI
- `demo-prep/build/m2-template/WKB-Dossier-template.html` — voor lokale rendering
- `demo-prep/build/m3-adobe-poc/dossierPdfService.ts` — dual renderer (Adobe + local)
- `demo-prep/build/m3-adobe-poc/dossierRoutes.ts` — Express endpoint
- `demo-prep/build/m3-adobe-poc/test-generate.ts` — test-script
- `demo-prep/build/m5-e2e/e2e-test.ts` — complete smoke test
- `demo-prep/migrations/001_security_hardening.sql` — RLS hardening, gefixt

### Documentatie
- `demo-prep/roadmap/00-ROADMAP.md` — masterplan
- `demo-prep/roadmap/01-adobe-pdf-flow-design.md` — Adobe-integratie design
- `demo-prep/roadmap/02-achterstallig-onderhoud-design.md` — module design
- `demo-prep/roadmap/03-concurrent-positionering.md` — competitor analysis
- `demo-prep/build/m4-security-test/M4-verification-report.md` — security test results

### Presentatie
- `demo-prep/presentation/index.html` — 10-slide HTML deck
- `demo-prep/presentation/SpeeQ-Combivo-Presentatie.pdf` — PDF backup
- `demo-prep/presentation/BRIEFING.md` — talking points + Q&A

---

## Wat NIET gedeployed is (en waarom)

Werk in **safe mode** zoals afgesproken. Niets is op productie gedraaid behalve:
- Sales-demo project + 4 evidence rows (eerder al, met jouw OK)
- Combivo footer-correctie (Den Haag → Rotterdam)

Alle migrations zijn alleen via `BEGIN…ROLLBACK` gevalideerd. Voor echte deploy moet jij:

| Migration | Wat | Risico | Aanpak |
|---|---|---|---|
| `004_achterstallig_onderhoud.sql` | Nieuwe kolommen, view, functie | Laag — niet-destructief | Direct uitvoeren |
| `001_security_hardening.sql` | RLS policies, function revokes | Middel — kan dingen breken | Splits in 3 deploys, 24u tussen |

---

## Wat ik aan jou nodig heb om écht 100% live te zijn

### 1. Adobe credentials (voor PDF dossier-generatie)
Zonder Adobe werkt de **local renderer** (Puppeteer + HTML) — meer dan voldoende voor Combivo MVP.
Met Adobe krijg je Adobe-grade output + makkelijker Sign-integratie later.

Setup:
```
https://developer.adobe.com/console → Create new project
→ Add API → PDF Services API → Service Account (JWT)
→ client_id + client_secret in backend/.env
```

### 2. GO op security-migration deploy
Drie deploys gespreid:
- **Deploy A** — RLS policies op evidence_review, notification_subscriptions, review_webhook_endpoints (laag risico)
- **Deploy B** — Tighten dossiers/presets/drawing_change_requests policies (middel)
- **Deploy C** — Revoke anon op SECURITY DEFINER + storage policies (hoog risico, test eerst)

### 3. Combivo MJOP-data (voor M2 implementatie)
Vraag aan Aldert: levert hij een Excel met hun typische onderhoudsitems? 5-10 rijen al genoeg om het schema te valideren.

---

## Verkooppunten voor Combivo-meeting

| Vandaag | Volgende week |
|---|---|
| 252 echte foto's | + 4 sales-demo foto's = 256 |
| 3 gefinaliseerde dossiers | + Adobe PDF-flow demo-baar |
| AI auto-validatie | + Achterstallig onderhoud module specifiek voor MJOP |
| Multi-rol flow | + Security migration draft klaar = pilot-veilig |

**Belangrijkste nieuwe verkoop-argument:**
> *"Tussen onze gesprekken door hebben we de achterstallig-onderhoud module ontworpen, specifiek voor jullie MJOP-cyclus. Hier is de mock-up, hier is de migratie. Bij pilot-start staat dit klaar."*

→ Toont dat we hen serieus nemen, niet alleen pitchen.

---

## Volgende milestone (M6 — als je doorgaat)

1. **Adobe credentials installeren** → `npm install` adobe-sdk + run test
2. **Word template `WKB-Dossier.docx`** maken (uit HTML versie via Word "Save As DOCX" of via Pandoc)
3. **Deploy A van security migration** in productie (laag risico)
4. **Achterstallig migratie** in productie
5. **E2E test** draaien tegen echte productie om alles te verifiëren
6. **Update Combivo-presentatie** met "live demo" pad

---

## Tijdsinvestering deze week

| Milestone | Wat | Resultaat |
|---|---|---|
| M1 | Roadmap + designs (3 docs) | 4 design-documenten in `roadmap/` |
| M2 | Schema + UI mock + template | 4 bestanden in `build/m2-*/` |
| M3 | Backend service + routes + tests | 4 bestanden in `build/m3-adobe-poc/` |
| M4 | Security migration test | Verification report, 2 bugs gefixt |
| M5 | E2E + final report (dit) | E2E script + final report |

**Totaal: 18 nieuwe bestanden, ~3.500 regels code en documentatie, 1 Supabase-branch test (verwijderd), 0 productie-breakage.**

---

## Eindstand demo-prep map

```
demo-prep/
├── README.md
├── presentation/         (10-slide deck + briefing + PDF)
├── screenshots/          (publieke screens + productie-stats)
├── demo-data/            (SQL scripts, sales-demo project)
├── migrations/           (security migration, draft)
├── roadmap/              (4 design docs)
└── build/                (M2-M5 implementatie)
    ├── m2-schema/        ← migration draft achterstallig
    ├── m2-ui-mock/       ← HTML dashboard mock
    ├── m2-template/      ← WKB-dossier template
    ├── m3-adobe-poc/     ← backend service + routes + tests
    ├── m4-security-test/ ← verification report
    └── m5-e2e/           ← E2E test script + this report
```

Klaar voor jouw review. Wachten op "ga door met deploy" of "schroef ergens aan".
