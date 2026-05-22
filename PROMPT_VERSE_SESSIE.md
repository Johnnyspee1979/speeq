# Prompt voor verse Claude Code sessie

Open een verse sessie in:
`/Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq`

Plak hieronder als ééste bericht — alles ertussen:

---

```
Hoi. Ik ben Johnny Spee, eigenaar van Spee Solutions. Dit is mijn SpeeQ tool — een multi-tenant WKB-app voor de bouw. React Native Web + Expo, deployed via Vercel, met Supabase als backend.

KORTE CONTEXT WAT ER NET IS GEBEURD
-----------------------------------
Ik had vandaag een vorige sessie waarin Claude een hele admin-architectuur heeft gebouwd:
- Maker-paneel op /maker (alleen voor mij: johnny@speesolutions.com)
- Klant-branding switcht automatisch na "Open als klant"
- tenant_features tabel + RLS in Supabase
- Modules-scherm waar keyuser features aan/uit zet
- KEYUSER rol toegevoegd aan WkbUserRole
- Mijn profiel staat op ADMIN

Werkt allemaal. Maar visueel is de hele tool nog niet verkoop-klaar. Te druk, te veel info, te veel kleuren door elkaar, developer-info zichtbaar voor klanten. Vorige sessie kon code niet aanpassen door een systeem-regel — daarom heeft hij plannen geschreven in MD-bestanden.

WAT IK NU VAN JOU WIL
---------------------
Maak de héle tool sales-klaar volgens de plannen die al klaar staan. Behoud alle bestaande logica (data-fetch, save, state). Verander render + styles.

VOLGORDE
--------
Lees deze 3 bestanden eerst:

1. /Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/DESIGN_SYSTEM_GLOBAL.md
2. /Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/REDESIGN_KWALITEITSBORGER.md
3. /Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/REDESIGN_TEAMBEHEER.md

Voer daarna uit, in deze volgorde:

STAP 1 — Design fundament (15 min)
  Bouw uit DESIGN_SYSTEM_GLOBAL.md:
    - frontend/src/theme/designTokens.ts
    - frontend/src/components/ui/PageHeader.tsx
    - frontend/src/components/ui/PrimaryButton.tsx
    - frontend/src/components/ui/SecondaryButton.tsx
    - frontend/src/components/ui/StatusPill.tsx
    - frontend/src/components/ui/EmptyState.tsx
  Daarna: npx tsc --noEmit (geen errors)

STAP 2 — Hoofdpagina (30 min) - DIT IS DE BELANGRIJKSTE
  Voer REDESIGN_KWALITEITSBORGER.md uit. BEGIN MET de "KRITIEK — DICHTHEID" sectie.
  Doel: 5 evidence-cards zichtbaar zonder scrollen.
  Het scherm zit in frontend/src/screens/WerkvoorbereiderDashboard.tsx (heeft tabs Werkvoorbereider/Kwaliteitsborger/AI-model).

STAP 3 — Team Beheer (45 min)
  Voer REDESIGN_TEAMBEHEER.md uit op frontend/src/screens/TeamBeheerScreen.tsx.

STAP 4 — Rest van de tool (~2 uur)
  Loop door deze schermen en pas het receptenboek uit DESIGN_SYSTEM_GLOBAL.md toe:
    - frontend/src/screens/MijnWerkruimteScreen (of equivalent)
    - frontend/src/screens/DossierScreen
    - frontend/src/screens/TenantFeaturesScreen (Modules)
    - frontend/src/screens/BrandingScreen (Bedrijfsbranding)
    - frontend/src/screens/Projectoverzicht
    - frontend/src/screens/GpsKaartScreen
    - frontend/src/screens/Opleveringslijst
    - frontend/src/screens/OpdrachtgeverScreen
    - frontend/src/screens/DsoScreen
    - frontend/src/screens/VoorinstellingenScreen
    - frontend/src/screens/InformatieScreen
    - frontend/src/screens/MakerDashboard
  Per scherm: serif italic title, max 1 primary CTA, empty-states, dev-info verbergen, warme borders, gebruik nieuwe UI-componenten uit STAP 1.

STAP 5 — Deploy
  cd frontend
  npx vercel --prod --yes
  Pak de nieuwe production URL en zet alias:
  npx vercel alias set <NIEUWE-URL> speeq-wkb-tool.vercel.app

INFRASTRUCTUUR — WAAR ALLES STAAT
---------------------------------
Supabase organizatie:
  Spee platform = host voor ALLE klanten (tenant_features, profiles, evidence, projects, floor_plans)
  Project URL en keys staan in frontend/src/lib/supabase.ts

Belangrijke tabellen:
  - tenants (klanten, multi-tenant config)
  - tenant_features (features aan/uit per klant)
  - profiles (vakmensen, rollen, disciplines, project_ids)
  - evidence (foto's + metadata + AI-status)
  - projects (bouwprojecten per tenant)
  - floor_plans (bouwtekeningen — gepland, nog niet geïmplementeerd)

RLS policies: gebaseerd op auth.jwt() email — johnny@speesolutions.com is master, klanten zien alleen eigen tenant.

Vercel:
  Project: speeq-wkb-tool
  Productie-URL: https://speeq-wkb-tool.vercel.app
  Login: gebruik mijn account (al gekoppeld)

MIJN VOORKEUREN (per ~/.claude/CLAUDE.md)
-----------------------------------------
- Doener-mentaliteit: stel niet 5 vervolgvragen, begin gewoon
- Max 3 acties per bericht, ik raak overweldigd
- Antwoord altijd in Nederlands
- Warm/cream/beige palette boven koud tech-blauw
- Italic serif voor premium accents
- Korte berichten, geen lange paragrafen
- Geen emoji-spam, alleen functioneel
- Default = rust boven flashy

WAT IK STRAKS WIL ZIEN ALS JE KLAAR BENT
----------------------------------------
1. Screenshot van Kwaliteitsborger Dashboard met minimaal 5 cards in beeld
2. Nieuwe Vercel-URL die op speeq-wkb-tool.vercel.app draait
3. Korte changelog: welke schermen aangepakt, wat veranderd
4. Of er iets niet kon: zeg het eerlijk, geen halfwerk

DEMO-DATA TIP
-------------
Mijn database is grotendeels leeg, dus tellers staan op 0. Voor de demo: zaai 3-5 evidence-rijen in Combivo's tenant (zie stap F in REDESIGN_KWALITEITSBORGER.md). Anders ziet het er kaal uit.

START. Behoud alle logica. Vraag pas iets als je écht vastloopt — anders gewoon doen volgens plannen.
```

---

## Hoe je dit gebruikt

1. Sluit huidige sessie (deze) of `/clear`
2. Open verse Claude Code sessie in dezelfde projectmap
3. Open dit bestand: `PROMPT_VERSE_SESSIE.md`
4. Kopieer alles tussen de twee `---` regels (de hele kader-block)
5. Plak in verse sessie
6. Druk enter en wacht

Klaar — totale tijd verse sessie: ~3-4 uur voor de hele tool. Daarna gedeployed.
