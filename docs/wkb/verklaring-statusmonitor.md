# Verklaring-statusmonitor

Eén blik, één kleur, één knop: staat de input voor de **verklaring van de
kwaliteitsborger** op orde, en waarschuwt SpeeQ op tijd vóór de geplande
gereedmelding?

> Achtergrond: in het Bbl kan een gemeente via een *maatwerkbesluit* een
> gereedmelding toch toelaten als de borger-verklaring ontbreekt. Dat is een
> noodklep waar geen aannemer van afhankelijk wil zijn. Deze monitor zorgt dat de
> verklaring tijdig en compleet aangeleverd kan worden, zodat dat besluit nooit
> nodig is.

## Verschil met de dossier-compleetheidscheck

| | DossierCheckService | VerklaringMonitorService |
|---|---|---|
| Focus | hele opleverdossier (bevoegd gezag) | alleen de borger-*verklaring* |
| Bron | vaste categorieën bevoegd gezag | afgeleid uit het **borgingsplan** |
| Doel | dossier compleet voor gemeente | klaar voor aftekenen door borger |

Geen dubbel werk: deze monitor bouwt bovenop de compleetheidscheck en pakt
specifiek het verklaring-risico.

## Statuskleuren

| Kleur | Betekenis |
|---|---|
| 🟢 Groen | alle vereiste bewijsstukken aanwezig en afgetekend — klaar voor aftekenen |
| 🟠 Oranje | meeste stukken er, alleen niet-kritische items ontbreken nog |
| 🔴 Rood | een kritisch stuk ontbreekt; de gereedmelding loopt risico |

## Checklist uit het borgingsplan

De checklist is **niet** een vaste lijst maar wordt afgeleid uit het
borgingsplan. Elke eis wordt een af te vinken item:

```ts
interface BorgingsplanEis {
  id: string;
  naam: string;
  soort: 'foto' | 'keuringsrapport' | 'as-built' | 'afwijking' | 'overig';
  kritisch?: boolean;        // ontbreekt → rood
  deadline?: string | null;  // optionele eigen deadline (ISO)
}
```

`bouwVerklaringChecklist(eisen, gedekt[])` markeert een item als aanwezig als
zijn id in `gedekt` zit (bewijs aantoonbaar: foto met tijdstempel + locatie,
keuringsrapport, as-built, afwijking gedocumenteerd).

## Tijdlijn-trigger

`evalueerTijdlijn({ gereedmeldingDatum, status, nu?, drempel? })` rekent terug
in **werkdagen** (ma–vr) en waarschuwt zodra er minder dan `drempel` werkdagen
resten en de status nog niet groen is. Standaard `drempel = 10` werkdagen,
instelbaar. Een verstreken datum die nog niet groen is, waarschuwt altijd.

## Export

Het verklaring-pakket hergebruikt de vendor-neutrale export
(`VendorExportService`): bundel alle input voor de borger in één nette export
(PDF + losse bestanden + `manifest.txt` met SHA-256), zodat de borger direct kan
aftekenen zonder achter losse foto's en bonnetjes aan te hoeven.

## Offline-first

De monitor rekent zuiver lokaal: checklist + status + tijdlijn draaien zonder
verbinding op de bouwplaats en syncen later. De UI/sync levert per item aan of
het bewijs aanwezig is; de service voegt geen netwerk-afhankelijkheid toe.

## Service

`frontend/src/services/VerklaringMonitorService.ts` — `bouwVerklaringChecklist`,
`bepaalVerklaringStatus`, `werkdagenTussen`, `evalueerTijdlijn`,
`formatVerklaringRegel`. UI-indicator op het projectoverzicht + export-knop zitten
eromheen.
