# Migraties — hoe dit werkt

Deze map is sinds 25 juli 2026 de **bron van waarheid** voor het databaseschema.
Daarvóór was dat niet zo: het kernschema was met de hand in het Supabase-dashboard
gemaakt en de map liep uit de pas met productie.

## Regels

1. **Bestandsvolgorde = uitvoervolgorde.** De Supabase CLI draait de bestanden op
   alfabetische naam. Zet een nieuwe migratie dus met een tijdstempel dat ná de
   vorige komt, en verwijs nooit naar een tabel die later in de rij wordt gemaakt.
2. **Nooit een toegepast bestand aanpassen.** Fout gevonden? Nieuwe migratie erachter.
3. **Idempotent schrijven** (`if not exists`, `create or replace`, `drop policy if exists`)
   zodat opnieuw draaien nooit schade doet.
4. **Elke migratie eerst op een branch**, daarna pas naar productie.

## De keten testen of een nieuwe klantomgeving uitrollen

```bash
npx supabase db push --db-url "postgresql://postgres:WACHTWOORD@db.PROJECTREF.supabase.co:5432/postgres"
```

Op 25 juli 2026 getest op een verse Supabase-branch: de volledige keten draait
in één keer door en levert **43 tabellen** op. Daarmee is een nieuwe tenant-database
met één commando uit te rollen.

## Wat er aan de basis is toegevoegd

| Bestand | Waarom |
|---|---|
| `00000000000000_baseline_kernschema.sql` | `projects`, `evidence`, `evidence_review`, `presets`, `push_subscriptions`, `tenant_features`, `drawing_change_requests` — stonden in geen enkele migratie |
| `20260612_baseline_tenant_kolommen_en_functies.sql` | `tenant_id`-kolommen en `get_user_enrolled_organization_ids()` c.s. — nodig door het tenant-hek |
| `20260628_baseline_relaties.sql` | foreign keys die pas kunnen als `dossiers` en `floor_plans` bestaan |
| `20260629_dossierslot_captured_at_fix.sql` | het dossierslot las `captured_at`, een kolom die niet bestaat |

`20260601_floor_plan_annotations.sql` is hernoemd naar `20260508_...` omdat
`20260509_sprint2_rls_and_sync.sql` beleidsregels zet op `floor_plans`.

## Niet in de keten opgenomen

`notify_evidence_status_change()` en de trigger `evidence_status_push_trigger`
staan wél in productie maar bewust niet hier: die functie bevat een vast
ingebakken Edge-Function-URL én een webhook-secret. Dat hoort niet in een
migratie die per klant wordt uitgerold. Zet dit per omgeving apart in met de
juiste URL en een secret uit de omgevingsvariabelen.
