-- Sprint Bon-Scanner: bonnen, leveringsbrieven, certificaten per project
-- Aparte tabel zodat ze NIET mengen met de bewijs-foto's.

create table if not exists public.project_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      text not null,
  doc_type        text not null default 'BON', -- BON | LEVERINGSBON | CERTIFICAAT | FACTUUR | WERKBON | OVERIG
  title           text,
  photo_url       text not null,
  ocr_text        text,
  ocr_confidence  real,
  detected_fields jsonb,                       -- {leverancier, datum, bedrag, ...}
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists project_documents_project_idx
  on public.project_documents (project_id);

create index if not exists project_documents_type_idx
  on public.project_documents (doc_type);

alter table public.project_documents enable row level security;

create policy "project_documents_select"
  on public.project_documents for select
  using (true);

create policy "project_documents_insert"
  on public.project_documents for insert
  with check (auth.uid() is not null);

create policy "project_documents_delete"
  on public.project_documents for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ADMIN', 'WERKVOORBEREIDER', 'PROJECTLEIDER')
    )
  );
