-- ─────────────────────────────────────────────────────────────────────────────
-- Woningborg WKI — controlepunt-mapping (per tenant)
-- ─────────────────────────────────────────────────────────────────────────────
-- Mapping tussen SpeeQ-controlepunten en Woningborg-checkpunten, zodat de
-- WKI-export de juiste structuur krijgt. Eenmalig instellen per tenant, daarna
-- hergebruik per project. V1 = eenrichtings-export (geen live API).

create table if not exists public.woningborg_checkpoint_mapping (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                text,
  speeq_controlepunt_id    text not null,
  woningborg_code          text not null,
  woningborg_omschrijving  text,
  updated_by               uuid references auth.users(id),
  updated_at               timestamptz not null default now(),
  unique (tenant_id, speeq_controlepunt_id)
);

create index if not exists woningborg_checkpoint_mapping_tenant_idx
  on public.woningborg_checkpoint_mapping (tenant_id);

alter table public.woningborg_checkpoint_mapping enable row level security;

create policy "woningborg_checkpoint_mapping_select" on public.woningborg_checkpoint_mapping
  for select using (auth.uid() is not null);
create policy "woningborg_checkpoint_mapping_insert" on public.woningborg_checkpoint_mapping
  for insert with check (auth.uid() is not null);
create policy "woningborg_checkpoint_mapping_update" on public.woningborg_checkpoint_mapping
  for update using (auth.uid() is not null);
create policy "woningborg_checkpoint_mapping_delete" on public.woningborg_checkpoint_mapping
  for delete using (auth.uid() is not null);
