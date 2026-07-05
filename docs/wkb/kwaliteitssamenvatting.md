# Kwaliteitssamenvatting (1-pagina voorpagina)

Eén A4 vooraan het opleverdossier die borger én bevoegd gezag in 30 seconden
overtuigt dat het dossier op orde is. Geen losse module met eigen invoer — het
leunt volledig op data die al in het project zit.

> Achtergrond: gemeenteambtenaren zijn kritisch op de private toetsing. Wie zijn
> eigen kwaliteit helder op één pagina laat zien, neemt de twijfel weg vóórdat de
> gemeente bij de gereedmelding gaat zoeken.

## Verschil met de dossier-compleetheidscheck

| DossierCheckService | KwaliteitssamenvattingService |
|---|---|
| controleert óf alles aanwezig is | *presenteert* de kwaliteit van wat er ligt |
| interne checklist-score | leesbare voorpagina, feitelijk, op één A4 |

## Wat de samenvatting bevat

1. **Projectkop** — naam, adres, gevolgklasse, aannemer, borger + instrument, gereedmelding.
2. **Controlepunten in cijfers** — totaal, met foto-bewijs, met tijdstempel+locatie, % afgerond.
3. **Afwijkingen** — geconstateerd / opgelost / open (met reden). Het eerlijke deel: niets weggemoffeld.
4. **Dekking per bouwfase** — fundering, ruwbouw, installaties, afbouw, oplevering (+ overig). Een gat is meteen zichtbaar.
5. **Bewijs-integriteit** — elke foto draagt tijdstempel + (waar beschikbaar) locatie, offline vastgelegd.

## Functionele uitgangspunten

- **Nul extra invoer.** Alles komt uit bestaande projectdata.
- **Eerlijk benoemd.** Ontbrekende data staat expliciet in `ontbrekend`
  ("Geen foto bij 3 controlepunt(en)."), nooit stilzwijgend leeg.
- **Offline-first.** Samenstellen gebeurt zuiver lokaal; geen serverafhankelijkheid.
- **Neutrale toon.** Alleen cijfers en feiten in het document — geen marketingtaal.
- **Scope-grens.** SpeeQ toetst niet, SpeeQ legt vast: geen oordeel namens de
  borger, geen benchmarks, geen automatisch versturen.

## Service

`frontend/src/services/KwaliteitssamenvattingService.ts`:

- `bouwKwaliteitssamenvatting(bron)` → `Kwaliteitssamenvatting` (cijfers,
  afwijkingen, fasedekking, eerlijke gaten, bewijs-integriteit-regel).
- `formatSamenvatting(s)` → leesbare 1-pagina-tekst voor de PDF-voorpagina.
- `BOUWFASEN` — vaste fase-volgorde.

De export-knop voegt deze samenvatting vooraan het opleverdossier in
(zelfde knop, geen aparte stap).
