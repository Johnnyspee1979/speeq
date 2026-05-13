# Verwerkersovereenkomst (DPA)

**Tussen:**

**Verwerkingsverantwoordelijke** (de klant):
- Naam: [KLANT_BEDRIJFSNAAM]
- KvK: [KLANT_KVK]
- Adres: [KLANT_ADRES]
- Vertegenwoordigd door: [KLANT_CONTACTPERSOON]

**Verwerker** (SpeeQ-leverancier):
- Naam: Spee Solutions
- KvK: 99314770
- BTW: NL005384070B84
- Adres: Escamplaan 870 F, 2547 EX 's-Gravenhage
- Vertegenwoordigd door: Johnny Spee

**Datum ingang:** 2026-05-13
**Versie:** 1.0

---

## Artikel 1 — Definities

1. **AVG**: de Algemene Verordening Gegevensbescherming (EU) 2016/679.
2. **Persoonsgegevens**: elk gegeven dat herleidbaar is tot een natuurlijke persoon.
3. **Verwerking**: elke handeling met betrekking tot persoonsgegevens.
4. **Verantwoordelijke**: de partij die het doel en de middelen van de verwerking bepaalt (klant).
5. **Verwerker**: de partij die persoonsgegevens verwerkt namens de verantwoordelijke (Spee Solutions).
6. **Sub-verwerker**: een door verwerker ingeschakelde derde (in dit geval o.a. Supabase, Vercel).
7. **Datalek**: een inbreuk op de beveiliging die leidt tot verlies, ongeoorloofde toegang of openbaarmaking van persoonsgegevens.

## Artikel 2 — Onderwerp en duur

1. Deze verwerkersovereenkomst is een bijlage bij de SpeeQ Service-Overeenkomst tussen partijen.
2. Looptijd: gelijk aan de Service-Overeenkomst.
3. Bij beëindiging van de Service-Overeenkomst eindigt ook deze DPA.

## Artikel 3 — Aard, doel en categorieën

1. **Aard van de verwerking:**
   - Opslag, verwerking en doorgifte van foto's, projectinformatie, gebruikersgegevens en kwaliteitsdossiers ten behoeve van de Wkb-verplichting van de Verantwoordelijke.

2. **Doel van de verwerking:**
   - Het faciliteren van een digitaal kwaliteitsdossier voor de bouwsector conform de Wet kwaliteitsborging voor de bouw.

3. **Categorieën persoonsgegevens:**
   - Naam, e-mailadres, functie binnen het bedrijf
   - IP-adres, device-info, GPS-locatie (gerelateerd aan foto's)
   - Profielfoto (optioneel)
   - Activiteit-logs (welke gebruiker welke handeling verrichtte, wanneer)

4. **Categorieën betrokkenen:**
   - Medewerkers van de Verantwoordelijke
   - Onderaannemers en externen die door de Verantwoordelijke zijn uitgenodigd
   - Opdrachtgevers/consumenten die door de Verantwoordelijke toegang krijgen tot het klantportaal

## Artikel 4 — Plichten van Verwerker

1. Verwerker verwerkt persoonsgegevens **uitsluitend op schriftelijke instructie** van de Verantwoordelijke.
2. Verwerker zorgt voor passende technische en organisatorische maatregelen (zie Artikel 7).
3. Verwerker waarborgt dat personen die toegang hebben tot persoonsgegevens een geheimhoudingsplicht hebben.
4. Verwerker assisteert de Verantwoordelijke bij verzoeken van betrokkenen (inzage, rectificatie, verwijdering, dataportabiliteit).
5. Verwerker meldt datalekken **binnen 24 uur na ontdekking** aan de Verantwoordelijke per e-mail aan [KLANT_CONTACTPERSOON].

## Artikel 5 — Sub-verwerkers

1. Verwerker mag de volgende sub-verwerkers inschakelen:

| Sub-verwerker | Doel | Locatie | Privacybeleid |
|---|---|---|---|
| Supabase Inc. | Database-hosting, authenticatie, opslag | EU (Frankfurt of Amsterdam) | https://supabase.com/privacy |
| Vercel Inc. | Hosting van webapplicatie | EU (regio Frankfurt/Amsterdam) | https://vercel.com/legal/privacy-policy |
| GitHub Inc. | Broncode-opslag (géén persoonsgegevens van klant) | VS (geen klantdata) | https://docs.github.com/site-policy/privacy-policies |

2. **Elke klant krijgt een eigen Supabase-database in de EU.** Data is fysiek gescheiden van andere klanten.
3. Bij nieuwe sub-verwerkers: Verwerker informeert Verantwoordelijke minimaal 30 dagen vooraf. Verantwoordelijke kan bezwaar maken; bij ongegrond bezwaar geldt 60 dagen opzegrecht.
4. Verwerker waarborgt dat sub-verwerkers ten minste dezelfde verplichtingen op zich nemen.

## Artikel 6 — Doorgifte buiten de EU

1. Persoonsgegevens worden **uitsluitend binnen de EU** verwerkt.
2. Indien doorgifte buiten de EU onvermijdelijk wordt (bv. via support van een sub-verwerker), zal Verwerker:
   - Gebruik maken van Standard Contractual Clauses (SCC's) zoals goedgekeurd door de Europese Commissie
   - De Verantwoordelijke schriftelijk informeren
   - Aanvullende waarborgen treffen waar nodig

## Artikel 7 — Beveiligingsmaatregelen

Verwerker neemt ten minste de volgende maatregelen:

**Technisch:**
- TLS 1.3 voor alle dataverkeer
- Versleuteling at-rest (AES-256) op database en storage
- Row-Level Security (RLS) per tabel
- Multi-factor authenticatie voor administratieve toegang
- Geautomatiseerde back-ups (24-uurs retentie + 7-daagse point-in-time recovery)
- Intrusion detection op infrastructuur-niveau (via Supabase + Vercel)

**Organisatorisch:**
- Toegang tot productie-systemen alleen voor geautoriseerd personeel
- Logboek van alle administratieve handelingen
- Jaarlijkse evaluatie van beveiligingsmaatregelen
- Wachtwoorden in versleutelde manager (1Password / Bitwarden)
- Geen lokale opslag van klantdata op werkapparaten

## Artikel 8 — Audit

1. Verantwoordelijke heeft het recht **eenmaal per jaar** een audit uit te (laten) voeren.
2. Audit op locatie vergt minimaal 30 dagen opzegging.
3. Kosten van de audit zijn voor rekening van de Verantwoordelijke, tenzij de audit een **wezenlijke schending** aantoont, in welk geval Verwerker de kosten draagt.
4. Verwerker kan bestaande audits/certificeringen overleggen (bv. SOC 2 van Supabase) ter beperking van de audit-scope.

## Artikel 9 — Bewaartermijn en teruggave

1. Persoonsgegevens worden bewaard zolang de Service-Overeenkomst loopt, plus 30 dagen daarna.
2. Bij beëindiging exporteert Verwerker op verzoek alle persoonsgegevens als ZIP-archief naar Verantwoordelijke.
3. Na export en bevestiging worden alle persoonsgegevens binnen 60 dagen vernietigd, inclusief back-ups.
4. Op verzoek levert Verwerker een **verklaring van vernietiging** binnen 14 dagen na vernietiging.

## Artikel 10 — Aansprakelijkheid

1. Voor aansprakelijkheid geldt de algemene aansprakelijkheidsregeling uit de Service-Overeenkomst.
2. Bij overtreding van AVG-verplichtingen door Verwerker: directe schade tot maximaal de jaarvergoeding onder de Service-Overeenkomst.
3. Boetes opgelegd door de Autoriteit Persoonsgegevens die specifiek voortvloeien uit een toerekenbare tekortkoming van Verwerker, komen voor rekening van Verwerker.

## Artikel 11 — Beëindiging en gevolgen

1. Deze DPA eindigt automatisch bij beëindiging van de Service-Overeenkomst.
2. Bij ontbinding wegens AVG-overtreding door Verwerker: Verantwoordelijke heeft recht op restitutie van vooruitbetaalde bedragen pro rata.

## Artikel 12 — Toepasselijk recht

1. Nederlands recht.
2. Geschillen worden voorgelegd aan de **Rechtbank Oost-Brabant, locatie Eindhoven**, tenzij dwingend recht anders bepaalt.

---

## Ondertekening

**Namens Verantwoordelijke:**

Naam: ___________________________________

Functie: _________________________________

Datum: __________________________________

Handtekening: ___________________________


**Namens Verwerker (Spee Solutions):**

Naam: Johnny Spee

Functie: Directeur/eigenaar

Datum: __________________________________

Handtekening: ___________________________

---

*Versie 1.0 · gepubliceerd 2026-05-13 · contact: privacy@speesolutions.com*
