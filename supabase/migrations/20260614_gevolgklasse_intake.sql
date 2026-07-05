-- ─────────────────────────────────────────────────────────────────────────────
-- GK1-intake — indicatieve gevolgklasse per project
-- ─────────────────────────────────────────────────────────────────────────────
-- Slaat de antwoorden + uitkomst van de lichte GK1-intake op. Read-only indicatie,
-- GEEN juridisch bindend advies — bij twijfel verwijst de app naar gemeente/borger.
-- Eén rij per project; opnieuw invullen overschrijft de vorige indicatie.

create table if not exists public.project_gevolgklasse_intake (
  project_id           text primary key,
  tenant_id            text,
  bouwwerk_type        text not null
    check (bouwwerk_type in (
      'grondgebonden-woning','klein-bedrijfsgebouw','appartementen',
      'winkel-plus-wonen','anders'
    )),
  fase                 text check (fase in ('nieuwbouw','verbouw')),
  meerdere_bouwwerken  boolean not null default false,
  samenstelling        text check (samenstelling in ('een-eenheid','losse-gebouwen')),
  uitkomst             text not null
    check (uitkomst in ('GK1','BUITEN_GK1','TWIJFEL')),
  basis                text not null
    check (basis in ('GK1','HOGER','GEMENGD','ONBEKEND')),
  uitleg               text,
  ingevuld_door        uuid references auth.users(id),
  ingevuld_at          timestamptz not null default now()
);

alter table public.project_gevolgklasse_intake enable row level security;

create policy "project_gevolgklasse_intake_select" on public.project_gevolgklasse_intake
  for select using (auth.uid() is not null);

create policy "project_gevolgklasse_intake_insert" on public.project_gevolgklasse_intake
  for insert with check (auth.uid() is not null);

create policy "project_gevolgklasse_intake_update" on public.project_gevolgklasse_intake
  for update using (auth.uid() is not null);
