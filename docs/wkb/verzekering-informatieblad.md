# Verzekering & financiële zekerheid — informatieblad

Een 1-pagina document dat de aannemer **vóór de start** aan de opdrachtgever
geeft. Het vervult de wettelijke informatieplicht: vooraf informeren over hoe de
aansprakelijkheid voor gebreken is gedekt — aantoonbaar, in hetzelfde dossier als
de rest van het project.

> Twee Wkb-plichten staan los van de politiek: bij oplevering een compleet
> opleverdossier, én vooraf informeren over verzekering/financiële zekerheid. Die
> tweede plicht sneeuwt in de praktijk onder. Dit blad vinkt 'm in één handeling
> af en legt het vast.

## Verschil met andere features

| Feature | Moment |
|---|---|
| Dossier-compleetheidscheck | ná de bouw — is alles aanwezig? |
| Kwaliteitssamenvatting | ná de bouw — presenteert de kwaliteit |
| **Verzekering-informatieblad** | **vóór de start** — informatieplicht dekking |

## Inhoud

1. **Projectkop** — naam, adres, gevolgklasse, aannemer, opdrachtgever, datum.
2. **Wijze van dekking** — één blok per gekozen vorm: verborgen-gebreken-/
   garantieverzekering, bankgarantie, waarborgregeling of andere financiële
   zekerheid.
3. **Dekkingsomvang in mensentaal** — wat valt eronder, voor welke periode, wat
   de opdrachtgever doet bij een later gebrek. Geen polisjargon.
4. **Verwijzing naar bewijs** — waar de polis/garantie te vinden is (bijlage/
   verwijzing), zonder de hele polis in te plakken.
5. **Ondertekenregel** — datum + paraaf opdrachtgever ("ontvangen en gelezen vóór
   start werk").

## Functionele uitgangspunten

- **Minimale invoer.** De aannemer stelt eenmalig een **bedrijfsstandaard** in
  (`BedrijfsStandaardDekking`); per project alleen bevestigen of aanpassen
  (`projectDekkingen` override).
- **Eerlijk benoemd.** Ontbrekende velden staan expliciet in `ontbrekend`.
- **Tijdstempel.** `registreerOverhandiging` legt datum/tijd vast, net als bij de
  controlepunten — zo is "vooraf geïnformeerd" aantoonbaar in de projecttijdlijn.
- **Offline-first + neutrale toon.** Lokaal samen te stellen; geen verkooptaal.

## Scope-grens

SpeeQ legt vast wat de aannemer heeft geregeld — geen verzekering verkopen,
vergelijken of adviseren, geen oordeel of de dekking "voldoende" is, geen
automatische verzending.

## Service

`frontend/src/services/VerzekeringInformatiebladService.ts` —
`bouwInformatieblad`, `registreerOverhandiging`, `formatInformatieblad`,
`dekkingsVormLabel`. Opslag (bedrijfsstandaard + per-project blad + overhandiging-
bevestiging) via de migratie `20260614_verzekering_informatieblad.sql` (GATED).
