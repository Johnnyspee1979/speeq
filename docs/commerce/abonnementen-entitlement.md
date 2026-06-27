# Abonnementen & toegang (entitlement)

SpeeQ wordt per tenant als abonnement verkocht. Dit document beschrijft de
**toegangsbeslissing** — wie mag de app gebruiken op basis van zijn
abonnementstatus. De afdwinging (écht blokkeren) zit in de backend/edge-laag;
hier staat de zuivere beslissing.

## Provider: Lemon Squeezy (Merchant of Record)

Lemon Squeezy treedt op als Merchant of Record: zij verzorgen checkout, facturen
en de EU-btw (MOSS). Voor een eenmanszaak scheelt dat veel administratie. SpeeQ
krijgt de abonnementstatus binnen via een webhook en legt die genormaliseerd vast
op de tenant.

## Statussen

| Lemon Squeezy | Intern (`AbonnementStatus`) | Toegang |
|---|---|---|
| `on_trial` | `op_proef` | ja, zolang proef loopt |
| `active` | `actief` | ja |
| `past_due` / `unpaid` | `betaling_te_laat` | ja, tot einde betaalde periode |
| `paused` | `gepauzeerd` | nee |
| `cancelled` | `opgezegd` | ja, tot einde betaalde periode |
| `expired` | `verlopen` | nee |
| (onbekend / leeg) | `geen` | nee (fail-closed) |

## Beslissing

`EntitlementService.bepaalToegang(abonnement, nu?)` geeft een `ToegangsBesluit`:
toegang ja/nee, of de tenant in de proefperiode zit, hoeveel hele dagen er nog
resteren tot `geldigTot`, en een leesbare reden.

Kernregels:

- **Actief** → toegang.
- **Proef** → toegang zolang er geen einddatum is of de einddatum nog niet
  verstreken is.
- **Opgezegd / betaling te laat** → toegang loopt door tot het einde van de al
  betaalde periode (`geldigTot`); daarna niet meer. Zo verliest niemand abrupt
  toegang midden in een betaalde maand.
- **Gepauzeerd / verlopen / geen** → geen toegang.
- **Fail-closed**: bij een ontbrekende of onbekende status is er géén toegang.

## Opslag

De master `tenants`-tabel krijgt de abonnement-kolommen via migratie
`20260627_tenant_abonnement.sql` (GATED): `abonnement_status`, `abonnement_plan`,
`abonnement_geldig_tot`, `proef_eindigt_at`, `ls_customer_id`,
`ls_subscription_id`, `abonnement_bijgewerkt_at`. Deze tabel is service-role-only;
alleen de backend/webhook schrijft hierin, nooit een tenant-gebruiker.

## Scope-grens

`EntitlementService` neemt alleen de beslissing — het int geen geld, doet geen
checkout en spreekt geen provider-API aan. De webhook-mapper (status → DB) en de
afdwinging in de routes zijn aparte lagen. De échte Lemon-Squeezy-account, API-
keys en go-live blijven handmatig (GATED).

## Service

`frontend/src/services/EntitlementService.ts` — `mapLemonSqueezyStatus`,
`bepaalToegang`, `formatToegangsRegel`. Zuiver en provider-neutraal; volledig
getest in `__tests__/EntitlementService.test.ts`.
