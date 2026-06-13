-- Storage privé maken (publieke buckets → privé + signed-URL-leesrecht)
-- Datum: 2026-06-13
--
-- CONTEXT
-- Alle vijf storage-buckets stonden PUBLIEK: bestanden waren wereldleesbaar via
-- hun URL (foto's, plattegronden, documenten, dossiers). De app bewaart sinds
-- de storage-hardening het PAD i.p.v. een publieke URL en tekent dat pad bij het
-- ophalen tot een kortlevende signed URL (zie frontend/src/lib/storageUrl.ts en
-- de omgezette upload-plekken). Daardoor kunnen we de gevoelige buckets nu privé
-- zetten zonder de app te breken.
--
-- WAT SIGNED URLS NODIG HEBBEN
--   * Een signed URL MAKEN (createSignedUrl) vereist SELECT-recht op
--     storage.objects voor de rol die tekent.
--   * Een signed URL GEBRUIKEN vereist GEEN RLS: de handtekening (JWT in de URL)
--     is zelf de autorisatie tot de vervaldatum. Daarom blijven gemailde
--     dossier-links voor niet-ingelogde consumenten gewoon werken.
--
-- KEUZES PER BUCKET
--   wkb-evidence     → privé. SELECT van rol `public` → `authenticated`
--                       (app-gebruikers zijn ingelogd; reviewers tekenen de
--                        dossier-mail-link, consument gebruikt die signed URL).
--   project-documents → privé. SELECT `public` → `authenticated`. INSERT óók
--                       `public` → `authenticated` (anon-insert-gat dichten).
--   floor-plans      → privé, maar SELECT BLIJFT `public`: het consument-
--                       goedkeurscherm (TekenGoedkeuringScreen, niet ingelogd)
--                       tekent zelf een signed URL met de anon-key. Tighten kan
--                       pas als dat scherm via een getokende backend-route leest
--                       (follow-up). INSERT blijft auth-gated (ongemoeid).
--   dossiers         → NIEUW, privé. De backend (dossierService) uploadt hier
--                       met service_role; bestond nog niet.
--   tenant-branding  → ONGEMOEID, blijft publiek (logo's; bewust laag-gevoelig).
--   speeq-voice-cache → ONGEMOEID, blijft publiek (TTS-cache; laag-gevoelig).
--
-- SERVICE_ROLE BYPASST RLS → de backend (dossiermotor, AI-upload, STAM) blijft
-- werken. Alleen frontend-anon/authenticated-toegang verandert.
--
-- LET OP (te verwachten neveneffecten, bewust):
--   * Oude rijen waarin nog een VOLLEDIGE publieke Supabase-URL is opgeslagen
--     (i.p.v. een pad) verliezen hun afbeelding zodra de bucket privé is: die
--     /object/public/...-URL werkt dan niet meer. Nieuwe uploads (paden) zijn
--     ongevoelig (worden getekend). Externe demo-URLs (picsum e.d.) en lokale
--     file://-URI's blijven werken (passthrough).
--   * Reeds gemailde PUBLIEKE dossier-links van vóór deze wijziging stoppen.
--
-- ROLLBACK: zet de buckets terug op public=true en herstel de SELECT-rol naar
-- `public` (zie onderaan).

-- ── 1. Privé dossiers-bucket aanmaken (bestond niet) ─────────────────────────
insert into storage.buckets (id, name, public)
values ('dossiers', 'dossiers', false)
on conflict (id) do update set public = false;

-- ── 2. Gevoelige buckets op privé zetten ─────────────────────────────────────
update storage.buckets
   set public = false
 where id in ('wkb-evidence', 'project-documents', 'floor-plans');

-- ── 3. wkb-evidence: SELECT van `public` → `authenticated` ───────────────────
drop policy if exists "Evidence photos are publicly readable" on storage.objects;
drop policy if exists "wkb_evidence_authenticated_read" on storage.objects;
create policy "wkb_evidence_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'wkb-evidence');

-- ── 4. project-documents: SELECT en INSERT van `public` → `authenticated` ────
drop policy if exists "project_documents_public_read" on storage.objects;
drop policy if exists "project_documents_authenticated_read" on storage.objects;
create policy "project_documents_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-documents');

drop policy if exists "project_documents_anon_insert" on storage.objects;
drop policy if exists "project_documents_authenticated_insert" on storage.objects;
create policy "project_documents_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-documents');

-- ── 5. dossiers: alleen service_role schrijft; authenticated mag tekenen ──────
drop policy if exists "dossiers_service_role_all" on storage.objects;
create policy "dossiers_service_role_all" on storage.objects
  as permissive for all to service_role
  using (bucket_id = 'dossiers')
  with check (bucket_id = 'dossiers');

drop policy if exists "dossiers_authenticated_read" on storage.objects;
create policy "dossiers_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'dossiers');

-- floor-plans: BEWUST ongemoeid (SELECT blijft `public` voor het consument-
-- goedkeurscherm). Bucket is in stap 2 wel privé gezet; de bestaande
-- floor_plans_storage_select-policy (rol public) houdt het tekenen werkend.

-- ── Verificatie (handmatig draaien na toepassen) ─────────────────────────────
-- select id, public from storage.buckets order by id;
--   verwacht privé (false): dossiers, floor-plans, project-documents, wkb-evidence
--   verwacht publiek (true): speeq-voice-cache, tenant-branding
-- select policyname, cmd, roles from pg_policies
--   where schemaname='storage' and tablename='objects' order by policyname;
--
-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- update storage.buckets set public = true
--   where id in ('wkb-evidence','project-documents','floor-plans');
-- (en eventueel) delete from storage.buckets where id = 'dossiers';
-- Herstel de oude SELECT-policies op rol `public` voor wkb-evidence /
-- project-documents indien gewenst.
