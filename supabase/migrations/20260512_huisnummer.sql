-- Fase 1B: huisnummer toevoegen aan evidence
-- Reden: GPS vult straat + plaats, vakman vult huisnummer handmatig.
-- Zonder dit veld kan een registratie niet uniek aan een adres gekoppeld worden.

alter table public.evidence
  add column if not exists huisnummer text;

-- Index niet nodig — huisnummer wordt alleen gefilterd in combinatie met project_id,
-- en project_id heeft al een index.

comment on column public.evidence.huisnummer is
  'Huisnummer van het pand waar het bewijs is geregistreerd. Handmatig ingevuld door vakman, niet uit GPS-reverse-geocode (te onbetrouwbaar voor exacte nummer-aanduiding). Format: vrije tekst, max 10 chars, bv "12A".';
