# SpeeQ — Roadmap naar 100% werkend product

> Bijgewerkt 28 mei 2026, ná uitstel Combivo-meeting.
> Doel: product 100% werkend + Combivo-uitrol klaar voor volgende week.

---

## Wat "100% werkend" betekent

De volledige flow van bouwplaats naar archief:

```
📱 Mobiel              💻 Desktop                 📄 Adobe PDF        🗄️ Supabase
─────────              ─────────                  ────────────        ────────────
Vakman maakt foto  →  Projectleider reviewt   →  PDF dossier      →  Opgeslagen
+ GPS + EXIF + AI     + approve / reject         + Adobe Sign        + locked
                                                  + handtekening
```

**Status per onderdeel:**

| Stap | Status | Wat ontbreekt |
|---|---|---|
| Mobiel — foto-vastlegging | ✅ Werkt | — |
| AI-validatie | ✅ Werkt | — |
| Desktop review | ✅ Werkt | — |
| PDF dossier-generatie | ❌ Mist | Adobe PDF Services-integratie |
| E-signing | ❌ Mist | Adobe Sign-integratie |
| Storage van signed PDF | 🟡 Schema klaar | `dossiers.pdf_url` is veld, geen invuller |
| **Achterstallig onderhoud** module (Combivo) | ❌ Mist | Schema + UI + reports |

---

## Vijf milestones — week 28 mei → 4 juni

### M1 · Maandag 28 mei (vandaag)
**Doel:** roadmap + design-docs + research klaar.
- Roadmap (dit document)
- Design Adobe PDF flow (`01-adobe-pdf-flow-design.md`)
- Design Achterstallig onderhoud (`02-achterstallig-onderhoud-design.md`)
- Concurrent-analyse Wkb-tools (`03-concurrent-positionering.md`)

### M2 · Dinsdag 29 mei
**Doel:** schema voor achterstallig + UI mock-up.
- Migration draft: `004_achterstallig_onderhoud.sql` (op branch, niet productie)
- Word-template voor PDF dossier: `wkb-dossier-template.docx`
- HTML mock van achterstallig-dashboard

### M3 · Woensdag 30 mei
**Doel:** Adobe PDF integratie POC.
- Adobe credentials in `.env.example` (jij vult echte aan)
- Node-script: `generate-dossier-pdf.ts` — Word + JSON → PDF
- Test met 1 echt dossier (sales-demo-project)

### M4 · Donderdag 31 mei
**Doel:** Security migratie testen + achterstallig dashboard schermen.
- Supabase branch maken
- Security migration apply + verifiëren
- Achterstallig-dashboard React component (Maker-side)

### M5 · Vrijdag 1 juni
**Doel:** E2E test + Combivo-prep finaal.
- Full flow: vakman foto → review → PDF → signed → opgeslagen
- Bijgewerkte presentatie voor Combivo
- Roadmap-update naar week 2

---

## Stop-en-vraag-punten (geen autonome destructie)

Ik werk autonoom in `safe mode`:

| Wat ik **wel** doe zonder vragen | Wat ik **niet** doe zonder ja |
|---|---|
| Design docs schrijven | Productie database wijzigen |
| Migrations als **draft** opslaan | Migrations op productie uitvoeren |
| POC code in `playground/` map | Code naar `main` mergen |
| Supabase branches aanmaken | Vercel/Railway deploys triggeren |
| Lokale tests draaien | API-keys gebruiken / verbruiken |
| Concurrent-research + WebFetches | Externe e-mails sturen / formulieren invullen |

---

## Cadens

- **Elke milestone** rond ik af met een **status-update** + **commit van demo-prep/**
- **Tussen milestones** (1-2 uur tussenpoos) gebruik ik ScheduleWakeup om terug te komen
- **Bij vraag van jouw kant** stop ik direct met loop en handel handmatig

---

## Risico's die ik vooraf flag

1. **Adobe credentials niet gevonden** in repo. Je hebt waarschijnlijk een Adobe Developer Console account nodig met **PDF Services API** geactiveerd. Service Principal credentials (`PDF_SERVICES_CLIENT_ID`, `PDF_SERVICES_CLIENT_SECRET`). 
2. **Adobe Sign aparte registratie** — niet altijd in PDF Services bundle.
3. **MJOP-data-import** vraagt waarschijnlijk een specifiek format van Combivo's onderhoudsplanning. Kunnen we mock-en in M2.
4. **Security migration kan dingen breken** — daarom branch-eerst, daarna prod alleen na jouw OK.

---

## Volgende stap

Ik ga nu Milestone 1 afmaken (drie design-docs) en stop dan voor je akkoord voor de rest van het pad.
