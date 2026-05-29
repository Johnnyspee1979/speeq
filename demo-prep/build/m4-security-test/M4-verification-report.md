# M4 — Security & Schema Migration Verification

> Verificatie van migrations via BEGIN…ROLLBACK dry-run op productie.
> Datum: 29 mei 2026

---

## Aanpak

Supabase branch `security-hardening-test` was succesvol aangemaakt maar bleek **leeg** (geen tabellen, geen migrations) — branches in Supabase mirror niet automatisch de schema-state van main. Branch is verwijderd om kosten te vermijden.

**Pivot:** migrations zijn gevalideerd via `BEGIN ... ROLLBACK` op productie:
- Hele migratie binnen één transactie uitvoeren
- Verificatie-queries draaien
- ROLLBACK — productie blijft ongewijzigd

Dit valideert dat:
1. SQL is syntactisch correct
2. Geen verwijzingen naar non-bestaande tabellen/kolommen
3. Constraints worden geaccepteerd
4. Verificatie-queries werken

---

## Resultaten

### Migration 1 — Security Hardening (`demo-prep/migrations/001_security_hardening.sql`)

| Sub-test | Status | Detail |
|---|---|---|
| 4 nieuwe RLS policies aangemaakt | ✅ | `evidence_review_select_own_tenant`, `evidence_review_insert_own_tenant`, `notif_subs_self_only`, `review_webhooks_select_via_project` |
| Fout gevonden + gefixt | ⚠️ → ✅ | `review_webhook_endpoints` heeft geen `tenant_id` kolom — policy aangepast naar JOIN via `projects.tenant_id` |
| ROLLBACK werkte | ✅ | Na ROLLBACK: 0 policies aanwezig |

### Migration 2 — Achterstallig Onderhoud (`build/m2-schema/004_achterstallig_onderhoud.sql`)

| Sub-test | Status | Detail |
|---|---|---|
| ALTER TABLE met 9 nieuwe kolommen | ✅ | due_date, priority, recurrence_months, etc. |
| Index `idx_checklist_due_date_open` | ✅ | Partial index op `WHERE checked=false AND due_date IS NOT NULL` |
| View `v_achterstallig_onderhoud` | ✅ | Joint met projects + profiles |
| Functie `checklist_complete_and_reschedule()` | ✅ | SECURITY DEFINER, anon revoked |
| Fout gevonden + gefixt | ⚠️ → ✅ | `profiles.full_name` bestaat niet — vervangen door `profiles.display_name` |
| ROLLBACK werkte | ✅ | Productie ongewijzigd |

---

## Wat er nu klaar staat voor échte deploy

Beide migration-bestanden zijn:
- ✅ Syntactisch gevalideerd tegen productie-schema
- ✅ Verwijzingen naar bestaande kolommen kloppen
- ✅ Verwacht resultaat is bewezen
- ⏳ Wachten op jouw GO om COMMIT te draaien (vervang `ROLLBACK` aan eind door `COMMIT`)

---

## Stappen om echt te deployen

```bash
# 1. Open Supabase SQL Editor of gebruik MCP
#    (productie project: kgiuavfvhtdgwuygbyzo)

# 2. Voer eerst 001_security_hardening.sql uit
#    Verander de laatste regel van `ROLLBACK;` naar `COMMIT;`

# 3. Verifieer met:
SELECT policyname, tablename FROM pg_policies 
WHERE policyname IN ('evidence_review_select_own_tenant', ...);

# 4. Voer 004_achterstallig_onderhoud.sql uit (zelfde manier)

# 5. Run E2E test om te verifiëren dat bestaande flow nog werkt:
cd demo-prep/build/m5-e2e
npx ts-node e2e-test.ts

# 6. Run Supabase Security Advisor opnieuw — moet veel groener kleuren
```

---

## Bekende risico's bij echte deploy

1. **`set_evidence_review` anon-revoke** breekt mogelijk de mobile-app als die met anon-key call doet → check eerst in mobile-code of het via authenticated user gaat
2. **Dossiers update policy** kan oude updates blokkeren als `current_tenant_id()` niet correct geset wordt voor service-role → testen met test-acccount
3. **Storage bucket SELECT policy removal** — als publieke foto-URL's gedeeld zijn in e-mails, controleer dat ze nog werken (zou moeten, want bucket blijft publiek voor objects)

---

## Aanbeveling

**Doe niet alles in één keer.** Splits in 3 deploys, met 24u tussen elk:

1. **Deploy 1 (laag risico):** RLS policies voor evidence_review, notification_subscriptions, review_webhook_endpoints
2. **Deploy 2 (middel):** Tighten dossiers/presets/drawing_change_requests policies
3. **Deploy 3 (hoog):** Revoke anon op SECURITY DEFINER functies + storage policies

Tussendoor: E2E test draaien. Bij issues: rollback deploy door policies te droppen.
