# Woningborg WKI — export-koppeling (V1)

Eerste **eenrichtings-export** van SpeeQ-bewijs naar de Woningborg-WKI-werkwijze
(Woningborg Kwaliteitsborgingsinstrument). Geen live API in V1 — een nette,
gedocumenteerde, gestructureerde export (data + foto-bijlagen) die de
kwaliteitsborger kan inlezen of overnemen.

## Waarom V1 = export, geen live koppeling

Woningborg publiceert **geen openbaar gedocumenteerde import-API** voor het WKI.
Een koppeling reverse-engineeren op een ongedocumenteerd formaat is fragiel.
Daarom: een stabiel, zelf-gedefinieerd uitwisselpakket (JSON + bijlage-referenties)
met een heldere mapping. Live tweerichtingsverkeer pas in V2 als Woningborg een
bruikbare API blijkt te bieden.

## Uitwisselpakket (zelf-gedefinieerd, stabiel)

```
WoningborgExportPakket
├─ profiel: "woningborg-wki"
├─ versie: "1.0"
├─ project: { projectId, naam, gegenereerdAt }
├─ punten: [
│    { woningborgCode, omschrijving, status, vastlegdatum,
│      verantwoordelijke, fotoReferenties: [path…] }
│  ]
└─ nietGemapt: [ { controlepuntId, omschrijving } ]   // eerlijk zichtbaar
```

`nietGemapt` is bewust onderdeel van het pakket: controlepunten zonder
Woningborg-mapping verdwijnen niet stilletjes — de borger ziet wat nog handmatig
moet.

## Mapping

| Veld | Betekenis |
|---|---|
| `speeq_controlepunt_id` | SpeeQ-controlepunt (bron). |
| `woningborg_code` | Het corresponderende Woningborg-checkpunt. |
| `woningborg_omschrijving` | Leesbare naam van het Woningborg-punt. |

Per **tenant** bewaard (`woningborg_checkpoint_mapping`), zodat elke aannemer zijn
eigen controlepunt-set op de Woningborg-structuur kan leggen. Eenmalig instellen,
daarna hergebruik per project.

## Offline-first

De export draait op **lokaal gecachte projectdata** — geen netwerk-blokkade. Het
pakket wordt lokaal samengesteld; verzenden/overdragen gebeurt los.

## Status-mapping

SpeeQ-review-status → Woningborg-leesbare status:

| SpeeQ | Woningborg-export |
|---|---|
| APPROVED / FINALIZED | `akkoord` |
| PENDING_REVIEW | `in_behandeling` |
| REJECTED | `afgekeurd` |
| (overig/leeg) | `onbekend` |

## Service

`frontend/src/services/WoningborgExportService.ts` — pure
`bouwWoningborgExport(project, controlepunten, mappings)`. Tests dekken: gemapte
punten, niet-gemapte punten, status-mapping, foto-referenties.
