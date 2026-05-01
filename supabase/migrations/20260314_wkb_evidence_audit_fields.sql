-- Aanvullende auditvelden voor Wkb-bewijsvoering
-- Doel: lokale capturebevestigingen, locatie-integriteit en OCR-uitbreiding
-- end-to-end beschikbaar maken in Supabase.

do $$
begin
  if to_regclass('public.evidence') is not null then
    alter table public.evidence add column if not exists milieuklasse text;
    alter table public.evidence add column if not exists stop_moment_confirmed boolean;
    alter table public.evidence add column if not exists measurement_tool_confirmed boolean;
    alter table public.evidence add column if not exists location_verified boolean;
    alter table public.evidence add column if not exists location_spoof_risk text;
    alter table public.evidence add column if not exists location_security_message text;

    create index if not exists evidence_location_verified_idx
      on public.evidence (location_verified);
    create index if not exists evidence_location_spoof_risk_idx
      on public.evidence (location_spoof_risk);
  end if;
end $$;
