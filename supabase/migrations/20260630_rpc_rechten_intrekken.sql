-- ─────────────────────────────────────────────────────────────────────────────
-- Uitvoerrechten op de nieuwe RPC's beperken tot ingelogde gebruikers
-- ─────────────────────────────────────────────────────────────────────────────
-- Postgres geeft nieuwe functies standaard EXECUTE aan PUBLIC. Daardoor waren de
-- RPC's uit de juni-migraties ook voor de anon-rol aan te roepen via
-- /rest/v1/rpc/<naam>. Ze weigeren niet-ingelogde aanroepen intern al met
-- 'Niet ingelogd', maar dat hoort niet de enige drempel te zijn.

revoke execute on function public.register_gereedmelding(text) from anon, public;
revoke execute on function public.seal_dossier(text, integer, text) from anon, public;
revoke execute on function public.log_evidence_herstel(bigint, text, text, timestamptz, numeric, numeric, text, text) from anon, public;
revoke execute on function public.set_evidence_review(bigint, text, text) from anon, public;

grant execute on function public.register_gereedmelding(text) to authenticated;
grant execute on function public.seal_dossier(text, integer, text) to authenticated;
grant execute on function public.log_evidence_herstel(bigint, text, text, timestamptz, numeric, numeric, text, text) to authenticated;
grant execute on function public.set_evidence_review(bigint, text, text) to authenticated;

-- `get_shared_project` blijft bewust wél voor anon uitvoerbaar: dat is de
-- deellink waarmee de kwaliteitsborger zonder account meekijkt. De functie
-- valideert het token zelf (niet verlopen, niet ingetrokken) en filtert strikt
-- op het ene gedeelde project.
