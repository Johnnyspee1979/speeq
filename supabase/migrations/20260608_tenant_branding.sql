-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant branding (logo + bedrijfsnaam) per klant-Supabase
-- ─────────────────────────────────────────────────────────────────────────────
-- Architectuur: elke klant heeft zijn eigen Supabase-project, dus we slaan de
-- branding lokaal op in dat project. Singleton-row: er is altijd precies één
-- branding-record per tenant.
--
-- Velden:
--   company_name  → de naam die in headers + PDF's verschijnt
--   logo_url      → publieke URL naar het geüploade logo in Storage
--   primary_color → optionele hex-kleur die hero-knoppen kleurt (CTA's etc.)
--   updated_at    → laatste wijziging (audit)
--
-- Rol-check: ADMIN / WERKVOORBEREIDER / KEYUSER / PROJECTLEIDER mogen wijzigen.

create table if not exists public.tenant_branding (
  id            int primary key default 1,
  company_name  text,
  logo_url      text,
  primary_color text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  constraint tenant_branding_singleton check (id = 1)
);

alter table public.tenant_branding enable row level security;

drop policy if exists "tenant_branding_select" on public.tenant_branding;
create policy "tenant_branding_select"
  on public.tenant_branding for select to authenticated using (true);

drop policy if exists "tenant_branding_upsert" on public.tenant_branding;
create policy "tenant_branding_upsert"
  on public.tenant_branding for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role,'')) in ('ADMIN','WERKVOORBEREIDER','KEYUSER','PROJECTLEIDER')
    )
  );

drop policy if exists "tenant_branding_update" on public.tenant_branding;
create policy "tenant_branding_update"
  on public.tenant_branding for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.role,'')) in ('ADMIN','WERKVOORBEREIDER','KEYUSER','PROJECTLEIDER')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket voor logo's — publieke read (PDF + <img> moet werken)
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('tenant-branding', 'tenant-branding', true)
on conflict (id) do nothing;

drop policy if exists "tenant_branding_storage_read" on storage.objects;
create policy "tenant_branding_storage_read"
  on storage.objects for select using (bucket_id = 'tenant-branding');

drop policy if exists "tenant_branding_storage_write" on storage.objects;
create policy "tenant_branding_storage_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-branding');

drop policy if exists "tenant_branding_storage_update" on storage.objects;
create policy "tenant_branding_storage_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'tenant-branding');
