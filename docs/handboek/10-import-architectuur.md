# 10 — Import-architectuur: hoe data uit oude tools in SpeeQ komt

> Ultraplan voor de bulk-import flow.
> Versie 1.0 · 2026-05-13

## De vraag waar dit doc op antwoordt

Als een aannemer overstapt van STA / Vastlegg / BKapp naar SpeeQ:
- Krijgt hij een link op de tool waar hij alles uploadt?
- Of moet alles eerst "SpeeQ-proof" gemaakt worden?
- Moeten PDF-referenties herschreven worden zodat het systeem niet zoekt?

## De drie opties — kort

| Optie | Wie doet het werk | Bouwwerk | Geschikt voor |
|---|---|---|---|
| **A. Self-service portal** | Klant uploadt zelf via web | 3–5 dagen bouwen | Schaal vanaf klant #5+ |
| **B. Johnny handmatig** | Johnny per klant | 0 dagen | Klant #1 alleen |
| **C. Transformer-script** | Johnny draait script lokaal | 1–2 dagen bouwen | Klant #2 t/m #5 |

## Mijn aanbeveling — gefaseerd

```
Klant #1  →  Optie B (puur handmatig, leren)         [4–8 uur per klant]
Klant #2  →  Optie C (transformer-script gebouwd)    [30–60 min per klant]
Klant #3  →  Optie C (script verfijnd)               [30 min per klant]
Klant #4+ →  Optie A (self-service portal live)       [<5 min Johnny-werk]
```

**Reden:** je weet pas wat data-vormen écht zijn na klant #1 en #2. Bouwen vóór die kennis = fout product.

## Antwoord op de PDF-codes vraag

**Niets herschrijven.** Het oude PDF-dossier is een **read-only archief**. We doen drie dingen:

1. PDF wordt 1-op-1 als bijlage gekoppeld aan het project (`projects.archive_pdf_url`)
2. Foto's krijgen wel SpeeQ-IDs (nieuwe UUIDs), maar we bewaren de originele bestandsnaam in `evidence.original_filename`
3. Index-tabel `legacy_references` koppelt oud-ID → nieuw-ID indien nodig

Voordeel: het systeem hoeft nooit te zoeken in PDF-content. De PDF is bewijs uit het oude tijdperk en blijft openbaar leesbaar. Wat actief is in SpeeQ, is wat ná migratie is toegevoegd.

## Klant-ervaring per fase

### Fase B (klant #1) — Johnny doet alles

Klant ziet:
1. Drag-drop ZIP via WeTransfer naar `import@speesolutions.com`
2. Mail van Johnny binnen 24u: "Ik heb je data, ik laat weten als het klaar staat"
3. Mail 3–5 dagen later: "Je SpeeQ-omgeving is gevuld, log in op `?t=jouwbedrijf`"
4. Optioneel: 30 min Zoom om door te lopen wat er klopt

Geen portal, geen techniek voor de klant.

### Fase C (klant #2–3) — Johnny draait script

Klant ziet:
- Hetzelfde als boven, maar levertijd zakt naar 24–48u

Onder de motorkap (Johnny):
```
1. ZIP unzippen op laptop
2. Run: npx tsx scripts/import.ts --source=sta --tenant=jansen ./export
3. Script doet:
   - Detecteer source-formaat (STA / Vastlegg / BKapp / generic CSV)
   - Parse projecten naar SpeeQ-schema
   - Upload foto's naar klant-Supabase Storage
   - Genereer evidence-rows met EXIF-data
   - Koppel archief-PDFs aan projecten
   - Schrijf import-rapport (wat lukte, wat niet)
4. Stuur klant een mail met de samenvatting
```

### Fase A (klant #4+) — Self-service portal

Klant ziet op `import.speeq.nl/jansen` (of `/?t=jansen&mode=import`):
1. **Stap 1:** "Welke tool gebruikte je?" (dropdown: STA / Vastlegg / BKapp / anders)
2. **Stap 2:** Drag-drop je ZIP-bestand hierheen
3. **Stap 3:** Progress bar — "32% verwerkt, 1.247 foto's geladen"
4. **Stap 4:** Samenvatting — "23 projecten ingelezen, 4 foto's konden niet gekoppeld worden (zie lijst)"
5. **Stap 5:** "Goedkeuren en activeren" knop

Johnny krijgt enkel notificatie *"klant XYZ heeft import voltooid"*. Geen werk meer.

## Database-aanpassingen die nodig zijn

### Migratie: `20260601_import_support.sql`

```sql
-- Foto's: behoud oude bestandsnaam en bron
alter table public.evidence
  add column if not exists original_filename text,
  add column if not exists imported_from text,        -- 'sta', 'vastlegg', 'manual', etc.
  add column if not exists import_batch_id uuid;

-- Projecten: behoud oud project-ID en archief-PDF
alter table public.projects
  add column if not exists legacy_id text,
  add column if not exists archive_pdf_url text,
  add column if not exists imported_at timestamptz;

-- Tracking van import-runs
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,        -- 'sta', 'vastlegg', etc.
  tenant_slug text not null,
  file_count int not null default 0,
  photo_count int not null default 0,
  project_count int not null default 0,
  status text not null default 'pending',   -- pending, running, completed, failed
  error_log text,
  started_at timestamptz default now(),
  completed_at timestamptz
);
create index if not exists import_batches_tenant_idx
  on public.import_batches (tenant_slug);
alter table public.import_batches enable row level security;

-- Cross-reference voor oude ID's (alleen voor query/audit)
create table if not exists public.legacy_references (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,        -- 'project', 'evidence', 'user'
  legacy_id text not null,
  speeq_id uuid not null,
  imported_at timestamptz default now()
);
create index if not exists legacy_refs_lookup
  on public.legacy_references (resource_type, legacy_id);
```

## Code-architectuur die we gaan bouwen

```
speeq/
├── scripts/
│   └── import/
│       ├── README.md                    (hoe het script te draaien)
│       ├── index.ts                     (CLI entry: tsx scripts/import/index.ts)
│       ├── detect-source.ts             (detect STA / Vastlegg / BKapp / generic)
│       └── transformers/
│           ├── sta-software.ts          (STA-specifieke parser)
│           ├── vastlegg.ts              (Vastlegg-parser)
│           ├── bkapp.ts                 (BKapp/Apexion-parser)
│           └── generic-csv.ts           (fallback)
├── supabase/
│   └── migrations/
│       └── 20260601_import_support.sql
└── frontend/src/screens/
    └── ImportScreen.tsx                 (later — fase A portal)
```

## Wat het transformer-script per bron moet kunnen

| Bron | Verwacht formaat | Wat parser doet |
|---|---|---|
| **STA Software** | ZIP met `projects.json` + `/photos/*.jpg` + PDF-dossiers | Map STA-project-ID → SpeeQ project, koppel foto's via meta-data |
| **Vastlegg** | ZIP met Supabase-export (JSON + storage-folder) | Direct overnemen van schema, hernoem velden waar nodig |
| **BKapp** | PDF-export + losse foto's | OCR-loos: koppel foto's per map-naam (= project) |
| **Generic CSV** | Excel/CSV + foto-map | Klant vult een mapping-formulier in |

## Wat we WEL bouwen, wat NIET

### Wel (eerste 3 klanten):
- ✅ Database-schema voor import-tracking
- ✅ Lokaal transformer-script (Node + tsx)
- ✅ Detect-source logic met fallback
- ✅ Bulk-upload via Supabase Storage API
- ✅ Import-rapport in markdown (wat lukte, wat niet)

### Niet (uitgesteld):
- ❌ Self-service portal (later na klant #3)
- ❌ Real-time sync tussen oude en nieuwe tool
- ❌ OCR op PDF-dossiers (de PDF blijft archief)
- ❌ Foto-deduplicatie via hash (later, eerst meekijken hoe vaak duplicates voorkomen)
- ❌ Automatische email-notificatie aan klant (klant krijgt persoonlijke mail van Johnny)

## Veiligheidsaspecten

- **Klant-data nooit lokaal opslaan langer dan nodig** — werk in `/tmp/spee-import-<klant>-<datum>/` en wis na succesvolle upload
- **Tijdelijke upload-tokens** — voor klant #4+ portal: gebruik Supabase signed URLs (15 min geldig)
- **Audit-log** — elke import wordt geregistreerd in `import_batches` voor latere DPA-audits
- **Geen e-mails / wachtwoorden importeren** — gebruikers moeten zelf opnieuw registreren via tenant-login (security-eis)

## Roadmap met tijdsbestek

| Stap | Inhoud | Wanneer | Wie |
|---|---|---|---|
| 1 | Supabase migratie uitvoeren | Direct (klant #1 nadert) | Claude in verse sessie |
| 2 | Skeleton transformer-script (CLI + detect) | Vóór klant #1 levert data | Claude in verse sessie |
| 3 | STA-parser (eerste echte bron) | Bij eerste STA-klant data | Claude in verse sessie |
| 4 | Bulk-upload + EXIF-extract | Idem | Idem |
| 5 | Vastlegg-parser | Bij eerste Vastlegg-klant | Idem |
| 6 | Self-service portal frontend | Na klant #3 | Verse sessie, los project |

## Wat klant #1 wel/niet ervaart

✅ **Klant ervaart:**
- 1 mail van Johnny met AVG-mail-template (uit `switch-service.md`)
- Levering ZIP via WeTransfer (1 klik)
- Bevestiging "ontvangen"
- 5 werkdagen later: "klaar, log in op `?t=jouwbedrijf`"
- 30 min telefoon-walkthrough als ze willen

❌ **Klant ervaart NIET:**
- Geen technische taal
- Geen vragen over schema-mapping
- Geen "vul deze velden in"
- Geen "deze foto kon ik niet inlezen" — Johnny lost dat zelf op

## Wat dit voor jouw planning betekent

Voeg deze stap toe aan `08-volgende-week.md` na de week-acties:

> **Week 2 — voorbereiding klant #1:**
> Dag 1: Supabase migratie `20260601_import_support.sql` uitvoeren
> Dag 2: Skeleton transformer-script + STA-parser
> Dag 3: Test-run met dummy STA-export (vraag bij STA via AVG-mail om je eigen testaccount-export, of gebruik fake data)
> Dag 4–5: Bug-fixes + import-rapport-format

## Hoe dit te verkopen in je founder-mail

> *"Bij elke andere Wkb-tool moet jij je data omzetten. Bij ons stuur jij ons je ZIP, wij regelen de rest — inclusief het behoud van je oude bestandsnamen en je oude PDF-dossiers als referentie. Geen herschrijven, geen zoeken."*

---

**Vorige:** [09-spec-wachtwoord-vergeten](09-spec-wachtwoord-vergeten.md) · **Volgende:** _(nog te schrijven: 11-import-script-spec)_ · **Terug naar:** [README](README.md)
