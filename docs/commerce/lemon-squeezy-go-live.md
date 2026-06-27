# Lemon Squeezy — go-live checklist (verkoopklaar maken)

Alles wat in **code** kan, is gebouwd en getest. Dit document is de brug naar
"klanten kunnen betalen". Wat hier staat is wat **jij** (Johnny) handmatig doet —
account, producten, keys, de migratie en de aan-schakelaar. Geen code meer nodig.

> Kernidee: Lemon Squeezy is **Merchant of Record**. Zij verkopen namens jou,
> innen de betaling én dragen de EU-BTW af. Jij krijgt een nette uitbetaling en
> hoeft geen MOSS-aangifte te doen.

---

## 0. Wat is er al klaar in code ✅

| Onderdeel | Bestand | Status |
|---|---|---|
| Toegangsbeslissing (fail-closed, grace) | `frontend/.../EntitlementService.ts` + backend `entitlementService.ts` | ✅ getest |
| Status-mapping LS → intern | beide bovenstaande | ✅ |
| Checkout-URL met tenant-koppeling | `frontend/.../CheckoutService.ts` | ✅ getest |
| Webhook-verificatie (HMAC) + parse | `backend/.../lemonSqueezyWebhook.ts` | ✅ getest |
| Webhook-endpoint → tenant bijwerken | `backend/routes/billingRoutes.ts` | ✅ |
| Betaalmuur (env-gated) | `backend/middleware/requireActiveSubscription.ts` | ✅ getest |
| Abonnement-kolommen op `tenants` | migratie `20260627_tenant_abonnement.sql` | ⏳ GATED |
| Juridisch (MoR i.p.v. Mollie/Stripe) | `docs/juridisch/*` | ✅ |

---

## 1. In Lemon Squeezy aanmaken (max 3 stappen tegelijk)

1. **Store aanmaken** → noteer je store-subdomein (bijv. `speesolutions` →
   `https://speesolutions.lemonsqueezy.com`).
2. **Producten + varianten** (abonnement, terugkerend):
   - Basis — €299/mnd en €2.990/jaar
   - Professional — €599/mnd en €5.990/jaar
   - (Enterprise = "op maat", géén variant — loopt via contact)
   - Zet variant-namen met "(maandelijks)"/"(jaarlijks)" — de code herkent het plan
     en interval daaraan (`herkenPlan`/`herkenInterval`).
3. **Noteer elke variant-ID** (nodig voor de checkout-knoppen).

> Stop hier en geef de store-subdomein + variant-ID's door, dan kan de
> Pricing-knop config ingevuld worden.

## 1b. Backend-domein koppelen (`api.speesolutions.com`)

De webhook moet bij de backend op Railway uitkomen. Daarvoor krijgt de backend een
eigen subdomein, los van `www` (website) en `app` (admin-tool).

| Stap | Waar | Wat |
|---|---|---|
| 1 | Railway → je backend-service → **Settings → Networking → Custom Domain** | Voer `api.speesolutions.com` in. Railway toont een **CNAME-doel** (iets als `xxx.up.railway.app`). |
| 2 | Je domeinregistrar (DNS van speesolutions.com) | Voeg een **CNAME**-record toe: naam `api`, waarde = het Railway-doel uit stap 1. |
| 3 | Wachten | DNS + TLS-certificaat actief (meestal < 15 min). Railway zet "Active" zodra het rond is. |

> Dit zijn account-/DNS-acties in jóuw dashboards — die doe jij. Zodra
> `https://api.speesolutions.com/api/health` `200` geeft, is de koppeling klaar en
> kun je door naar de webhook.

## 2. Webhook instellen

1. Lemon Squeezy → Settings → Webhooks → **+ Add endpoint**.
2. URL: `https://api.speesolutions.com/api/billing/lemon-squeezy/webhook`
3. Signing secret: kies een sterke string → zet die als env-var (zie §4).
4. Events aanvinken: alle `subscription_*` events.

## 3. Migratie draaien (GATED)

`supabase/migrations/20260627_tenant_abonnement.sql` voegt de abonnement-kolommen
toe aan de master `tenants`-tabel (service-role-only). Draai 'm op de master-DB op
het moment dat je álle gestapelde migraties uitrolt.

## 4. Env-vars zetten

**Backend (Railway):**

| Var | Waarde |
|---|---|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | het signing secret uit §2 |
| `ENFORCE_SUBSCRIPTION` | **laat eerst leeg/uit** — pas op `true` bij §6 |

**Frontend (Vercel / Expo public):**

| Var | Waarde |
|---|---|
| `EXPO_PUBLIC_LS_STORE` | je store-subdomein (bijv. `speesolutions`) |
| `EXPO_PUBLIC_LS_VARIANT_BASIS_MAAND` | variant-ID |
| `EXPO_PUBLIC_LS_VARIANT_BASIS_JAAR` | variant-ID |
| `EXPO_PUBLIC_LS_VARIANT_PRO_MAAND` | variant-ID |
| `EXPO_PUBLIC_LS_VARIANT_PRO_JAAR` | variant-ID |

## 5. Verkoopflow (hoe het straks loopt)

1. Jij maakt een tenant aan (status `pending`) en stuurt de checkout-link; die
   draagt de `tenant_id` mee als custom data.
2. Klant betaalt bij Lemon Squeezy (zij innen + BTW).
3. LS stuurt `subscription_created` → onze webhook verifieert de handtekening,
   leest de status en schrijft die op de juiste tenant.
4. Vervolg-events (verlenging, opzegging, betaling mislukt) updaten de tenant
   automatisch; de toegangsbeslissing volgt vanzelf.

## 6. Betaalmuur activeren (de bewuste schakelaar)

De muur (`requireActiveSubscription`) staat op dossier-export en STAM/DSO-melding,
maar is **standaard uit** zodat hij nooit per ongeluk live klanten blokkeert.
Aanzetten:

1. Zorg dat alle betalende tenants een `abonnement_status` hebben (via §5).
2. Zorg dat de frontend de tenant meestuurt via de **`x-company-id`-header** op
   de calls naar `/api/wkb-dossier` en `/api/stam` (nu nog niet bedraad — voeg de
   header toe in `frontend/src/services/dossierAuth.ts` / `dso.ts`).
3. Zet `ENFORCE_SUBSCRIPTION=true` op de backend.
4. Test met een tenant zónder abonnement → moet `402` geven met NL-melding.

## 7. Testen vóór scherpzetten

- Webhook: stuur een test-event vanuit Lemon Squeezy → controleer dat de tenant-
  rij de status krijgt.
- Verkeerde handtekening → `401`.
- Onbekend event → `200` met `ignored: true`.

---

### Wat ik (Claude) niet doe
Geen account aanmaken, geen keys invoeren, geen geld-acties, geen productie-
deploy of -migratie. Dat blijft bij jou — ik lever de werkende, geteste code.
