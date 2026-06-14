# Controlepunt-bibliotheek

Gestandaardiseerde namen voor bevindingen en gebreken die een vakman vastlegt.

## Waarom

De vakman typt nu vrije tekst in het veldnotitie-veld: "scheurtje", "barst",
"haarscheur" — drie woorden voor één gebrek. In het dossier en de PDF wordt dat
een onfilterbare bende, en een kwaliteitsborger of consument kan er niet op
zoeken.

De bibliotheek geeft elk gebrek **één vaste naam** + categorie. De vakman blijft
typen wat hij gewend is; SpeeQ herkent het synoniem en zet het om naar de
standaardnaam. Filteren en rapporteren wordt daarmee betrouwbaar.

## Ontwerpregels

- **Offline + lokaal gebundeld.** Geen AI, geen netwerk-afhankelijkheid. De man
  op de bouw heeft vieze handen en soms geen bereik.
- **Eén vaste naam per gebrek.** Synoniemen mappen terug; de naam zelf verandert
  niet (alleen de `id` is gegarandeerd stabiel).
- **Tenant-eigen punten mogen erbij.** Worden naast de basisset doorzocht via de
  `extra`-optie; verdwijnen nooit in de basisset.
- **Typeahead i.p.v. vrij typen.** Fuse.js (al een projectdependency) doet de
  tolerante zoekactie over naam + synoniemen + trefwoorden.

## Datastructuur

`frontend/src/constants/ControlepuntBibliotheek.ts`

| Veld | Betekenis |
|---|---|
| `id` | Stabiele slug — verandert nooit. |
| `naam` | Dé gestandaardiseerde naam (dossier + PDF). |
| `categorie` | Discipline: `BOUW`, `BOUWFYSICA`, `INSTALLATIE`, `ELEKTRA`, `BRANDVEILIGHEID`, `AFBOUW_SCHILDER` (spiegelt de `categoryId`-taxonomie van ContextForm). |
| `synoniemen` | Wat een vakman intypt; matcht terug naar `naam`. |
| `trefwoorden` | Extra zoektermen (gereedschap, context). |
| `omschrijving` | Korte uitleg voor de typeahead-regel. |

## Service-API

`frontend/src/services/ControlepuntBibliotheekService.ts`

- `searchControlepunten(query, { extra?, categorie?, limit? })` — fuzzy
  typeahead. Lege query → focuslijst (gefilterd op categorie indien gezet).
- `normalizeControlepunt(query, { extra? })` — zet vrije tekst om naar één
  controlepunt. Volgorde: exacte naam → exact synoniem → fuzzy. `via` geeft aan
  hoe zeker de match is. `null` als niets binnen de drempel valt.
- `standaardiseerControlepuntNaam(query, { extra? })` — snelkoppeling naar alleen
  de standaardnaam (of `null`).

## Basisset

24 controlepunten over zes disciplines.

### BOUW / constructie
- **Scheurvorming** — scheur, scheurtje, barst, haarscheur, breuk
- **Onvoldoende betondekking wapening** — wapening bloot, roest wapening
- **Verzakking / zetting** — zetting, fundering zakt
- **Maatafwijking** — scheef, niet haaks, uit het lood

### Bouwfysica
- **Koudebrug** — koude brug, thermische brug
- **Ontbrekende of onvoldoende isolatie** — isolatie te dun, kier isolatie
- **Luchtlek / kierdichting onvolledig** — kier, tocht, naad open
- **Condens / vochtophoping** — condens, beslagen, aanslag

### Installatie
- **Onvoldoende afschot riolering** — afschot, te weinig verval, staand water
- **Lekkage leiding / koppeling** — leidinglek, koppeling lek, druppelt
- **Ontbrekende mantelbuis bij doorvoer** — beschermbuis ontbreekt
- **Waterslot sifon te laag** — sifon te laag, stankafsluiter

### Elektra
- **Ontbrekende aardlekschakelaar** — geen rcd, differentieel ontbreekt
- **Onvoldoende aarding / vereffening** — niet geaard, aarddraad los
- **Onjuiste kleurcodering bedrading** — verkeerde kleur, fase op nul

### Brandveiligheid
- **Brandwerende doorvoer niet afgedicht** — brandmanchet ontbreekt
- **WBDBO-scheiding onderbroken** — compartiment lek, gat in brandwand
- **Ontbrekend brandwerend label deur** — deurlabel ontbreekt

### Afbouw / schilder
- **Stucwerk onvlak** — bobbel, hol, golvend
- **Gebrekkige kitnaad** — kit los, kitnaad scheurt
- **Veiligheidsglas ontbreekt in risicozone** — glasstempel, gehard glas ontbreekt
- **Verfgebrek** — druiper, kraters, verf bladdert

## Uitbreiden

Voeg een item toe aan `CONTROLEPUNT_BIBLIOTHEEK` met een nieuwe, stabiele `id`.
Houd `naam` uniek (de data-integriteitstest bewaakt dat). Geef minstens één
synoniem en trefwoord. Tests staan in
`frontend/src/services/__tests__/ControlepuntBibliotheekService.test.ts`.
