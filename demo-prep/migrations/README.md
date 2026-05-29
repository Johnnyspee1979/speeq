# migrations — Security hardening

> ⚠️ **NIET DIRECT UITVOEREN OP PRODUCTIE.**
> Deze migratie is een **draft** op basis van de Supabase Security Advisor.
> Eerst testen op een Supabase development branch.

---

## Wat is dit?

De Supabase Security Advisor signaleert op 28 mei 2026 een aantal issues:

| Severity | Issue | Tabel/Functie |
|---|---|---|
| INFO | RLS aan zonder policy | `evidence_review`, `notification_subscriptions`, `review_webhook_endpoints` |
| WARN | RLS-policy `USING (true)` | `dossiers`, `drawing_change_requests`, `presets`, `project_documents` |
| WARN | Public bucket allows listing | `wkb-evidence`, `floor-plans`, `project-documents`, `tenant-branding` |
| WARN | SECURITY DEFINER callable door anon | `set_evidence_review`, `lock_dossier`, `current_tenant_id`, etc. |
| WARN | `search_path` mutable | 5 functies |
| WARN | Password leak protection | Auth-instelling (zet aan via dashboard) |

---

## Risico voor sales-demo

**Nul.** De warnings zijn voor productie-grade pilot, niet voor demo.
Klant ziet niets van deze issues tenzij hij actief penetratietesten doet.

## Risico voor pilot ná sale

**Hoog.** `set_evidence_review` is callable door **anonieme** users — in theorie kan iedereen reviews zetten met alleen de Supabase URL. Voor een echte pilot moet dit dicht.

---

## Volgorde bij uitvoeren

1. **Maak Supabase branch** (via dashboard of `mcp__07264839...__create_branch`)
2. **Voer `001_security_hardening.sql` uit op branch**
3. **Test de complete flow:** vakman foto → review → finaliseer
4. **Als alles werkt** → merge branch naar production
5. **Run Security Advisor opnieuw** om te verifiëren

## Wat de migratie NIET doet

- Geen functie-search-path fixes (te risicovol zonder code-review)
- Geen password-leak-protection (moet via Supabase dashboard)
- Geen Supabase Auth-instellingen
