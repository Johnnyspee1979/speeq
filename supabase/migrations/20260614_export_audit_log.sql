-- ─────────────────────────────────────────────────────────────────────────────
-- Vendor-neutrale dossier-export — audit-log
-- ─────────────────────────────────────────────────────────────────────────────
-- Logt elke export (wie, wanneer, welk project) + een korte samenvatting van het
-- manifest (aantal OK/ontbrekend/corrupt). Per tenant; geen data van andere
-- klanten. Append-only in de praktijk.

create table if not exists public.export_audit_log (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text,
  project_id        text not null,
  schema_versie     text not null default 'speeq-wkb-export/1.0',
  bestanden_ok      integer not null default 0,
  bestanden_ontbreekt integer not null default 0,
  bestanden_corrupt integer not null default 0,
  uitgevoerd_door   uuid references auth.users(id),
  uitgevoerd_at     timestamptz not null default now()
);

create index if not exists export_audit_log_project_idx
  on public.export_audit_log (project_id, uitgevoerd_at desc);

alter table public.export_audit_log enable row level security;

create policy "export_audit_log_select" on public.export_audit_log
  for select using (auth.uid() is not null);
create policy "export_audit_log_insert" on public.export_audit_log
  for insert with check (auth.uid() is not null);
