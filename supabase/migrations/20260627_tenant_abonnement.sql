-- ─────────────────────────────────────────────────────────────────────────────
-- Abonnement-kolommen op de master `tenants`-tabel (entitlement-laag)
-- ─────────────────────────────────────────────────────────────────────────────
-- SpeeQ verkoopt per tenant een abonnement (Lemon Squeezy als Merchant of
-- Record). De betaalprovider levert ruwe statussen via een webhook; die worden
-- genormaliseerd (zie EntitlementService.mapLemonSqueezyStatus) en hier vastgelegd
-- op de tenant. De toegangsbeslissing (bepaalToegang) leest deze kolommen.
--
-- Master-DB: `tenants` is service-role-only (policy tenants_service_all). Deze
-- kolommen worden dus uitsluitend door de backend/webhook geschreven, nooit door
-- een ingelogde tenant-gebruiker. Fail-closed: default 'geen' → geen toegang.

alter table public.tenants
  add column if not exists abonnement_status text not null default 'geen'
    check (abonnement_status in (
      'op_proef', 'actief', 'betaling_te_laat', 'gepauzeerd',
      'opgezegd', 'verlopen', 'geen'
    )),
  add column if not exists abonnement_plan text,
  -- Tot wanneer de huidige (betaalde of proef-)periode loopt. Bepaalt voor
  -- 'opgezegd' en 'betaling_te_laat' tot wanneer toegang doorloopt.
  add column if not exists abonnement_geldig_tot timestamptz,
  add column if not exists proef_eindigt_at timestamptz,
  -- Provider-referenties (Lemon Squeezy). Puur voor reconciliatie/webhook-match.
  add column if not exists ls_customer_id text,
  add column if not exists ls_subscription_id text,
  add column if not exists abonnement_bijgewerkt_at timestamptz not null default now();

-- Webhook matcht inkomende events op de LS-subscription-id.
create index if not exists tenants_ls_subscription_idx
  on public.tenants (ls_subscription_id);
