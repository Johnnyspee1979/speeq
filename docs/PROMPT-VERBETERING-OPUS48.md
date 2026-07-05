# Prompt voor Claude Opus 4.8 — SpeeQ verkoopklaar verbeteren

Kopieer alles onder de streep in een nieuwe Claude Code-sessie (model: Opus 4.8)
met werkmap `speeq/`. De prompt is zelfstandig leesbaar en geprioriteerd op wat
verkoop het meest blokkeert (bron: docs/VERKOOP-ANALYSE.md, juli 2026).

---

Je werkt aan **SpeeQ**, een multi-tenant Wkb-app (Wet kwaliteitsborging voor het
bouwen, Gevolgklasse 1) van Spee Solutions — eenmanszaak van Johnny Spee. Stack:
backend Node/TS/Express 5 (`backend/`, CommonJS require + module.exports,
tsconfig strict), frontend React Native/Expo web/PWA (`frontend/`). Lees eerst
`CLAUDE.md` (valkuilen!), `docs/OPLEVER-CHECKLIST.md` en `docs/VERKOOP-ANALYSE.md`.

## Werkregels (niet onderhandelbaar)
- Antwoord en commit in het **Nederlands**; korte, zakelijke rapportages (tabel).
- Elke wijziging: verifieer met `npx jest <pad> --runInBand --forceExit` én
  `npx tsc --noEmit` (beide packages). **Nooit rood committen.**
- Commit **lokaal** per afgeronde stap, message eindigt op:
  `Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>`
- **NOOIT**: git push, deploys, productie-migraties (`20260627_tenant_abonnement.sql`),
  `ENFORCE_SUBSCRIPTION` aanzetten, account/DNS/betaal-acties, API-keys aanraken.
- Bij twijfel of een wijziging productdata/juridische tekst raakt: vraag Johnny,
  max 3 opties tegelijk.
- Baseline die groen moet blijven: backend 282+ tests, frontend 1178+ tests.

## Opdracht — werk deze backlog in volgorde af

### P1 — Eén prijsmodel (verkoopblokker, docs + code)
De repo bevat twee tegenstrijdige prijsmodellen: €49/€149/€299/€899 in
`docs/handboek/07-prijsmodel.md`, `docs/juridisch/02-algemene-voorwaarden.md` en
`docs/landing-page-spec.md` vs €299 Basis / €599 Professional in
`docs/commerce/lemon-squeezy-go-live.md` en `frontend/.../Pricing.tsx`.
Gekozen model (bevestig kort bij Johnny vóór uitvoeren):
30 dagen proef → founder-deal €149 (eerste 10, 12 mnd) → Basis €299/€2.990 →
Professional €599/€5.990. Trek ALLE documenten en de Pricing-UI gelijk; voeg op
de pricingpagina de rekensom toe: "€299/mnd bij 5 projecten ≈ €60 per project,
tegenover €2.000–5.000 kwaliteitsborger-kosten per woning" en "goedkoper dan 5
Ed Controls-licenties". Verwijder overal de urenbesparing-claim (niet onderbouwd).

### P2 — Continuïteit & data-eigendom (bezwaar #3 van elke koper)
1. Bouw **self-service data-export** in de app: knop bij projectinstellingen die
   per project een ZIP levert (foto's + dossier-PDF's + evidence-metadata als
   JSON/CSV) via een nieuwe backend-route achter `requireAuth` + project-scope
   (`assertProjectReviewAccess` — zie `dossierRoutes.ts` als patroon).
2. Voeg een **continuïteitsclausule** toe aan `docs/juridisch/04-soa-service-overeenkomst.md`
   (concept, Johnny keurt goed): bij discontinuering 3 maanden leestoegang +
   volledige export; noem back-up/PITR-regime feitelijk.
3. Zwak de SLA-reactietijden in de SOA af tot wat één persoon kan waarmaken
   (voorstel doen, niet zelf beslissen).

### P3 — DSO eerlijk maken (bezwaar #5)
De DSO/STAM-keten is deels stub (geen DKA gekozen, geen PKIoverheid). Tot dat
rond is: (a) verifieer dat de DSO-tab geen demo-payload meer stuurt (check of de
achtergrondfix hiervoor al gecommit is; zo niet: fix — echte projectdata of de
knop uitgrijzen met melding "DSO-aansluiting in aanvraag"); (b) label de
DSO-functies in de UI als "meldingsklaar dossier — automatische melding in
aansluittraject"; (c) geen enkele publieke claim "automatische melding werkt".

### P4 — KiK-routes dichttimmeren (zelfde gat als DSO, al gefixt voor DSO)
`backend/src/routes/kikRoutes.ts` heeft geen enkele auth; frontend
`frontend/src/services/kik.ts` stuurt geen token. Mount `/api/kik` +
`/api/integrations/kik` achter `requireAuth` (patroon: commit `0751ead`), laat
`kik.ts` de Supabase-JWT + `x-company-id` meesturen (patroon:
`services/dso.ts`/`dossierAuth.ts`), werk `CLAUDE.md` en de bestaande
`kikRoutes.test.ts` bij.

### P5 — Demo-UX-pijnpunten (demo 23 mei, `docs/STATUS.md`)
Fix de 6 gedocumenteerde pijnpunten met gebruikersimpact: lege schermen zonder
uitleg (empty states met NL-instructie), overweldigende zijbalk (groepeer op
rol), raw-JSON bij misklik (nette foutmelding). Klein en additief; geen redesign.

### P6 — Verkoopbewijs in het product
1. "Vliegtuigmodus-demo"-script: `docs/demo-draaiboek.md` met stap-voor-stap
   offline demo (foto → sync → dossier) van max 15 minuten.
2. Urenlogboek-haakje: log per dossier-generatie een regel (tenant, project,
   duur) zodat de urenbesparing bij de eerste 5 klanten gemeten kan worden
   (aansluitend op `docs/handboek/07-prijsmodel.md`).

## Rapportage
Na elke P-stap: één regel in een lopende tabel (stap | wat | tests | commit).
Aan het eind: totaaloverzicht + wat is blijven liggen en waarom. Als iets niet
kan zonder Johnny's beslissing (prijskeuze, juridische tekst, SLA): parkeer het
expliciet met een concreet voorstel i.p.v. het stil over te slaan.
