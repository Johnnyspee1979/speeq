# Staging-omgeving — runbook

Doel: een tweede, identieke omgeving waar je code en migraties test **zonder
dat een live klant (zoals Combivo) er last van heeft**. Een deploy raakt nu
alle klanten tegelijk; staging breekt die koppeling.

## Het model

```
                    ┌─────────────────────────────┐
  git branch        │  Railway service "speeq-be" │      Supabase
  ──────────        │                             │      ────────
  staging   ──────► │  environment: staging       ├────► STAGING-project (eigen DB)
                    │    APP_ENV=staging           │
  main      ──────► │  environment: production    ├────► PRODUCTIE-project (klantdata)
                    │    APP_ENV=production        │
                    └─────────────────────────────┘
```

- **Eén codebase**, twee Railway-environments, elk met eigen variabelen.
- **Twee aparte Supabase-projecten** — staging deelt NOOIT een database met productie.
- `APP_ENV` is zichtbaar in `GET /health` en `GET /api/health` → zo zie je
  altijd wélke omgeving je raakt vóór je iets doet.

## Eenmalige setup (Railway-dashboard — door Johnny)

1. **Maak een Supabase staging-project** aan (los van productie). Noteer
   `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + anon key.
2. In Railway → het backend-project → **Environments** → **New Environment**
   → naam `staging`. Dupliceer de variabelen van productie.
3. Zet in de **staging**-environment deze variabelen om:
   - `APP_ENV=staging`
   - `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` → die van het **staging**-Supabase-project
   - Gebruik **test-keys** voor externe diensten (OpenAI test-key, DSO op `DSO_ENV=LTO`,
     Resend test, Adobe test-creds). Nooit productie-secrets in staging.
4. In Railway → staging-environment → **Settings → Source** → koppel de
   git-branch **`staging`** (productie blijft op `main`).
5. Zet in de **production**-environment expliciet `APP_ENV=production`.

## Eenmalige setup (git)

```bash
# staging-branch aanmaken vanaf main
git checkout main
git checkout -b staging
git push -u origin staging
```

## Werkstroom daarna

```
feature-branch  →  merge in staging  →  Railway deployt staging automatisch
                ↓
        testen op staging-URL (check /health toont "env":"staging")
                ↓
        akkoord?  →  merge staging in main  →  productie deployt
```

- **Migraties**: draai een nieuwe migratie EERST op het staging-Supabase-project.
  Pas na groen op staging → draai 'm op productie. (Migraties draait Johnny
  handmatig; ze komen niet automatisch mee met de deploy.)
- **Verifieer altijd** met `curl https://<url>/health` dat `env` klopt vóór je
  een migratie of test uitvoert.

## Checklist vóór een klant (Combivo) live gaat

- [ ] Staging-environment draait en `/health` toont `"env":"staging"`
- [ ] Productie-environment toont `"env":"production"`
- [ ] Staging- en productie-Supabase zijn fysiek aparte projecten
- [ ] Externe secrets in staging zijn test-keys, niet productie
- [ ] `main` is beschermd (geen directe pushes; alles via staging)
