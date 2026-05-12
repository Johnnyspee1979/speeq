# 02 — Supabase opzetten voor een nieuwe klant

> Doel: in 5 minuten een schoon Supabase-project klaarzetten voor een klant, met alle 17 migrations toegepast.

## Wat krijg je per klant

Een eigen Supabase-project met:
- ✅ Alle tabellen (`profiles`, `projects`, `evidence`, `floor_plans`, `tenant_branding`, etc.)
- ✅ 4 Storage buckets (`tenant-branding`, `wkb-evidence`, `floor-plans`, `project-documents`)
- ✅ Row-Level Security policies per rol
- ✅ Triggers voor profielen, audit, sync

## Stap-voor-stap

### Stap 1 — Account + Project
1. Ga naar https://supabase.com → log in (zelfde account altijd, of klant maakt 'm zelf)
2. Klik **New project**
3. **Naam**: `wkb-<klantnaam>` (bv. `wkb-bouwgroep-jansen`)
4. **Database password**: laat Supabase er een genereren → noteer in een password-manager
5. **Region**: `eu-central-1` (Frankfurt) of `eu-west-1` (Ierland) — kies dichtbij klant
6. Klik **Create new project** → wacht ~2 minuten

### Stap 2 — Migrations runnen
Optie A (snel — aanbevolen): één gecombineerde seed-file
1. In Supabase: **SQL Editor** → **New query**
2. Open `supabase/seed/seed.sql` (uit deze repo) → copy alles
3. Plak in SQL editor → **Run** → wacht tot "Success"

Optie B (handmatig — als seed.sql mist):
1. Loop alle bestanden in `supabase/migrations/` af, oudste eerst
2. Plak inhoud in SQL editor → **Run** → volgende bestand

### Stap 3 — Credentials kopiëren
1. In Supabase: **Settings → API**
2. Kopieer:
   - **Project URL** → `https://xxx.supabase.co`
   - **anon (public) key** → JWT-string beginnend met `eyJ...`

### Stap 4 — Toevoegen in jouw maker-paneel
1. Open https://speeq-wkb.vercel.app/maker
2. Klik **➕ Klant toevoegen**
3. Vul in:
   - **Bedrijfsnaam**: Bouwgroep Jansen
   - **Slug**: jansen (wordt vanzelf afgeleid)
   - **Supabase URL**: plak de URL uit stap 3
   - **Anon key**: plak de key uit stap 3
   - **Admin-e-mail**: hoofdcontact klant
4. Klik **Delen opslaan**

### Stap 5 — Klant uitnodigen
1. Op de klantkaart → klik **🔗 Kopieer link**
2. Stuur die link naar de klant via e-mail/WhatsApp:
   ```
   https://speeq-wkb.vercel.app/?t=jansen
   ```
3. Klant opent link → maakt eigen account → klaar

## Wat moet de klant zelf doen (na ontvangst link)

### Eenmalig (5 minuten)
1. Open de link
2. **Account aanmaken** (e-mail + wachtwoord)
3. Tab **Branding** → upload bedrijfslogo + naam + footer-tekst
4. Tab **Team** → nodig collega's uit (kopieer-link per persoon)

### Dagelijks gebruik
- Camera-tab voor foto's
- Dossier-tab voor projecten
- Team-tab om gebruikers te beheren
- Etc.

## Auth-instelling: e-mailbevestiging

Standaard staat Supabase op **e-mailbevestiging verplicht**. Voor de demo-fase staat dit **uit** zodat klanten direct kunnen. Per klant kun je kiezen:

| E-mail confirmation | Voor | Tegen |
|---|---|---|
| **Aan** | Veiliger, voorkomt typo's | Klant moet wachten op mail |
| **Uit** | Direct werken | Iemand kan random e-mails registreren |

Aanbeveling: **AAN** voor productie, **UIT** voor de eerste demo.

Zetten via: Supabase project → **Authentication → Providers → Email** → "Confirm email" toggle.

## Kosten per klant

- **Gratis tier**: 500MB DB + 1GB storage + 50.000 monthly active users
- **Pro tier ($25/m)**: 8GB DB + 100GB storage — pas nodig bij >50 actieve gebruikers of veel foto's

Voor de meeste WKB-klanten: **gratis tier ruim voldoende** in jaar 1.

---

**Volgende doc:** [`03-maker-paneel.md`](03-maker-paneel.md) — hoe het maker-paneel werkt.
