# Supabase Seed — Nieuwe klant in 1 stap

> Gebruik dit bestand om een nieuwe klant-Supabase volledig op te zetten zonder 17 migraties handmatig te runnen.

## Wat zit erin?

`seed.sql` is een samenvoeging van alle 17 productie-migraties uit `supabase/migrations/` in chronologische volgorde:

1. `20260313_wkb_rbac.sql` — rollen en RLS basis
2. `20260313_wkb_schema_alignment.sql` — schema-corrects
3. `20260314_wkb_evidence_audit_fields.sql` — audit kolommen
4. `20260314_wkb_review_notifications.sql` — review meldingen
5. `20260315_consumer_dossier_context.sql` — consumenten dossier
6. `20260501_team_disciplines.sql` — disciplines per teamlid
7. `20260509_sprint2_rls_and_sync.sql` — RLS + sync uitbreiding
8. `20260510_sprint3_dossier_lock.sql` — dossier vergrendelen
9. `20260511_sprint8_insert_lock.sql` — insert lock
10. `20260512_huisnummer.sql` — huisnummer split
11. `20260601_floor_plan_annotations.sql` — bouwtekening pins
12. `20260602_task_assignments.sql` — taak toewijzingen
13. `20260604_evidence_comments.sql` — opmerkingen op foto's
14. `20260605_tenants_table.sql` — tenant config (alleen master)
15. `20260606_project_documents.sql` — project documenten
16. `20260607_review_workflow.sql` — review workflow
17. `20260608_tenant_branding.sql` — branding per klant

## Hoe gebruik je dit?

### Stap 1 — Maak nieuwe Supabase project
1. Login op https://supabase.com/dashboard
2. **New Project** → naam: bv. `wkb-jansen`
3. Wacht ~2 min tot project klaar is
4. Noteer **Project URL** en **anon public key** (Settings → API)

### Stap 2 — Run seed.sql
1. In het nieuwe project: **SQL Editor** → **New query**
2. Open `seed.sql` lokaal, kopieer **ALLE** inhoud (1235 regels)
3. Plak in de query editor
4. Klik **Run** (rechtsonder)
5. Wacht ~10 sec — alle 17 migraties draaien achter elkaar

### Stap 3 — Maak Storage buckets
In **Storage** → **Create bucket** voor elk:

| Bucket | Public | Max size | MIME types |
|---|---|---|---|
| `wkb-evidence` | ✅ | 50 MB | `image/jpeg,image/png,image/heic,application/pdf` |
| `tenant-branding` | ✅ | 5 MB | `image/png,image/jpeg,image/svg+xml` |
| `floor-plans` | ✅ | 20 MB | `image/png,image/jpeg,application/pdf` |
| `project-documents` | ✅ | 25 MB | `application/pdf,image/jpeg,image/png` |

### Stap 4 — Voeg klant toe in /maker
1. Open https://speeq-wkb.vercel.app/maker
2. Login als `johnny@speesolutions.nl`
3. **+ Klant toevoegen**
4. Vul in:
   - Bedrijfsnaam
   - Supabase URL (uit stap 1)
   - Anon key (uit stap 1)
5. Opslaan → 🔗 Kopieer link → deel met klant

### Stap 5 — Klaar
Klant opent `speeq-wkb.vercel.app/?t=<slug>` → maakt account → wordt automatisch ADMIN.

## Tips

- **Email confirmation uit zetten** voor minder friction: Auth → Providers → Email → "Confirm email" toggle UIT
- **RLS check**: `select count(*) from pg_policies where schemaname = 'public';` — moet ~30+ zijn
- **Migraties check**: alle tabellen moeten bestaan met `\dt` in psql, of via Table Editor

## Bij fouten

| Foutmelding | Oplossing |
|---|---|
| `relation already exists` | Migratie al gedraaid — veilig om door te gaan |
| `permission denied` | Run als `postgres` user in SQL Editor (default) |
| `function gen_random_uuid does not exist` | Run eerst: `create extension pgcrypto;` |

## Bron-migraties bijwerken

Als je een nieuwe migratie toevoegt aan `supabase/migrations/`, regenereer `seed.sql`:

```bash
cd "/Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq"
> supabase/seed/seed.sql
for f in supabase/migrations/*.sql; do
  echo "-- ============================================" >> supabase/seed/seed.sql
  echo "-- $(basename $f)" >> supabase/seed/seed.sql
  echo "-- ============================================" >> supabase/seed/seed.sql
  cat "$f" >> supabase/seed/seed.sql
  echo "" >> supabase/seed/seed.sql
done
```

---

Terug naar [handboek README](../../docs/handboek/README.md).
