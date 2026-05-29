# M5 — End-to-end smoke test

> Verifieert de complete WKB-flow van vakman-foto tot dossier-lock.

## Run lokaal

```bash
cd demo-prep/build/m5-e2e

# Met env uit backend/.env
export SUPABASE_URL=$(grep ^SUPABASE_URL ../../../backend/.env | cut -d= -f2)
export SUPABASE_SERVICE_KEY=$(grep ^SUPABASE_SERVICE_KEY ../../../backend/.env | cut -d= -f2)

# Tegen productie (tenant=demo, opgeruimd na test)
npx ts-node e2e-test.ts

# Met behoud van data (handig voor debug)
npx ts-node e2e-test.ts --keep

# Tegen specifiek project
npx ts-node e2e-test.ts --project=sales-demo-2026-05-29 --keep
```

## Wat de test verifieert

| # | Stap | Wat |
|---|---|---|
| 1 | Project aanmaken | INSERT in `projects` |
| 2 | Vakman zet evidence in | INSERT in `evidence` (sync_status=SYNCED) |
| 3 | AI-validatie | UPDATE `ai_status`, `ai_confidence`, `review_status=PENDING_REVIEW` |
| 4 | Projectleider keurt goed | RPC `set_evidence_review` |
| 5 | Verifieer status APPROVED | SELECT check |
| 6 | Dossier aanmaken | INSERT in `dossiers` |
| 7 | Lock dossier | RPC `lock_dossier` |
| 8 | Verifieer locked_at gezet | SELECT check |

## Output bij succes

```
E2E test — project: e2e-test-1748496000000, keep: false
────────────────────────────────────────────────────────────
✓ Project aanmaken (240ms)
✓ Vakman zet evidence in (180ms)
✓ AI-validatie zet status (95ms)
✓ Projectleider keurt goed (set_evidence_review) (120ms)
✓ Verifieer evidence.review_status = APPROVED (75ms)
✓ Dossier aanmaken (110ms)
✓ Lock dossier (lock_dossier RPC) (130ms)
✓ Verifieer evidence is_locked = true ná dossier-lock (80ms)
────────────────────────────────────────────────────────────
Cleanup...
✓ cleanup klaar
────────────────────────────────────────────────────────────
E2E rapport:

  8/8 steps passed
  totaal: 1030ms

ALLE TESTS GESLAAGD ✓
```

## Toevoegen in CI

```yaml
# .github/workflows/e2e.yml
- name: Run E2E smoke test
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: |
    cd demo-prep/build/m5-e2e
    npm install @supabase/supabase-js typescript ts-node
    npx ts-node e2e-test.ts
```
