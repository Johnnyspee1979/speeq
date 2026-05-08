-- Sprint 7 — tenants tabel verplaatsen van backend/data/tenants.json
-- naar Supabase, zodat Railway-redeploys geen klantdata meer wissen.
--
-- Service-role schrijft, anon mag niets. De backend leest/schrijft
-- via de service_role key in supabaseAdmin.ts.

create table if not exists public.tenants (
  company_id           text primary key,
  name                 text not null,
  status               text not null default 'active',
  users                int  not null default 0,
  created_at           timestamptz not null default now(),
  supabase_url         text not null default '',
  supabase_anon_key    text not null default '',
  admin_email          text,
  provisioning_status  text not null default 'pending'
    check (provisioning_status in ('pending', 'provisioned'))
);

create index if not exists tenants_admin_email_idx on public.tenants (admin_email);

alter table public.tenants enable row level security;

-- alleen service_role mag iets met deze tabel; anon-key heeft geen toegang
drop policy if exists "tenants_service_all" on public.tenants;
create policy "tenants_service_all" on public.tenants
  for all to service_role using (true) with check (true);

-- Seed: bestaande demo-tenant uit tenants.json zodat tests blijven slagen.
-- Idempotent via ON CONFLICT.
insert into public.tenants (
  company_id, name, status, users, created_at,
  supabase_url, supabase_anon_key, admin_email, provisioning_status
) values (
  'demo',
  'Demo Bouwgroep BV',
  'active',
  3,
  '2026-01-15T00:00:00Z',
  'https://kgiuavfvhtdgwuygbyzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc',
  'demo@speesolutions.nl',
  'provisioned'
)
on conflict (company_id) do nothing;
