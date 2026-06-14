-- ─────────────────────────────────────────────────────────────────────────────
-- leads_checklist — zachte e-mail-capture van de gratis WKB-checklist
-- ─────────────────────────────────────────────────────────────────────────────
-- Hoort in de MASTER-DB (niet per-klant). Slaat alleen e-mail + opt-in + bron +
-- timestamp op, na expliciete opt-in. Insert-only vanaf de publieke pagina;
-- GEEN publieke read (privacy/AVG). Lezen gebeurt alleen server-side/admin.

create table if not exists public.leads_checklist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  opt_in          boolean not null default false,
  bron            text not null default 'gratis-wkb-checklist',
  aangemeld_at    timestamptz not null default now()
);

create index if not exists leads_checklist_email_idx
  on public.leads_checklist (email);

alter table public.leads_checklist enable row level security;

-- Alleen inserts toestaan (anon mag een lead achterlaten); geen select/update/delete
-- via de publieke rol. Beheer leest server-side met de service-key (omzeilt RLS).
create policy "leads_checklist_insert" on public.leads_checklist
  for insert with check (opt_in = true);
