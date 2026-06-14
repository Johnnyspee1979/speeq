# Gratis WKB-checklist — inhoud (lead-magnet)

Voordeur voor MKB/ZZP: een gratis, openbare checklist die de eerste klik claimt
vóór de concurrent. Geen betaalmuur — de gratis waarde is echt gratis. De
checklist-state leeft in de browser (React `useState`), géén localStorage.

Bron-module: `frontend/src/services/GratisChecklistService.ts` (`WKB_CHECKLIST`).

## Blok 1 — Voorbereiding & bouwmelding

- Gevolgklasse bepaald (valt het werk onder GK1?)
- Kwaliteitsborger gekozen en aangesteld
- Risicobeoordeling en borgingsplan ontvangen
- Bouwmelding minimaal 4 weken vóór start ingediend
- Opdrachtgever vooraf geïnformeerd over verzekering/financiële zekerheid

## Blok 2 — Uitvoering & controlepunten

- Controlepunten uit het borgingsplan in beeld
- Foto bij elk controlepunt, met tijdstempel en locatie
- Afwijkingen vastgelegd én herstel gedocumenteerd
- Keuringsrapporten en as-built tekeningen verzameld
- Borger heeft tussentijds kunnen meekijken

## Blok 3 — Oplevering & consumentendossier

- Verklaring van de kwaliteitsborger compleet
- Opleverdossier voor bevoegd gezag samengesteld
- Consumentendossier aan de opdrachtgever overhandigd
- Gereedmelding minimaal 2 weken vóór ingebruikname
- Alle bewijslast in één overdraagbaar dossier (PDF + bestanden)

## E-mail-capture (optioneel, zacht)

- Géén verplichte muur: de checklist werkt volledig zonder e-mail.
- Expliciete opt-in (geen vooraangevinkt vakje) + korte AVG-tekst.
- `valideerLeadAanmelding` normaliseert het e-mailadres (lowercase/trim) en
  controleert de opt-in vóór insert.
- Opslag uitsluitend in `leads_checklist` in de **master-DB**, met timestamp +
  bron. Geen e-mailadressen in code of in een per-klant-instance.

## Eén CTA

"Wil je dit niet op papier maar automatisch vastleggen op de bouwplaats?
Probeer SpeeQ." — één heldere CTA naar de tool, geen harde betaalmuur.

## Status

Functionele kern (checklist-inhoud + lead-validatie + migratie) klaar en getest.
De publieke landingspagina `/gratis-wkb-checklist` + PDF-export (Warm Minimal,
navy/groen) horen bij de visuele laag en worden in de visuele fase gebouwd op een
losse branch + PR (conform de bouwprompt).
