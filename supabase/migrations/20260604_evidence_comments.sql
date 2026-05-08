-- Opmerkingen per bewijsstuk (feedback-loop WV ↔ vakman)
-- WV kan een afwijzing toelichten; vakman ziet het in zijn workspace.

create table if not exists public.evidence_comments (
  id          uuid primary key default gen_random_uuid(),
  evidence_id bigint not null references public.evidence(id) on delete cascade,
  project_id  text,
  user_id     uuid references auth.users(id),
  author_name text,
  role        text not null default 'WV',  -- WV | VAKMAN | ADMIN
  body        text not null check (char_length(body) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists evidence_comments_evidence_idx on public.evidence_comments (evidence_id);
create index if not exists evidence_comments_project_idx  on public.evidence_comments (project_id);

alter table public.evidence_comments enable row level security;

create policy "evidence_comments_select" on public.evidence_comments
  for select using (true);

create policy "evidence_comments_insert" on public.evidence_comments
  for insert with check (auth.uid() is not null);

create policy "evidence_comments_delete" on public.evidence_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data->>'role') in ('ADMIN', 'WV')
    )
  );
