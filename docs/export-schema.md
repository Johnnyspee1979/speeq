# Vendor-neutrale dossier-export — JSON-schema

De SpeeQ-export bundelt een compleet WKB-dossier **zonder leverancier-lock-in**:
één ZIP met een leesbaar `dossier.pdf`, een machine-leesbaar `dossier.json`, de
originele bijlagen in `/bijlagen/`, en een `manifest.txt` met SHA-256-hashes voor
integriteit.

> Belofte: *jouw dossier, jouw data, in één klik overdraagbaar.* Het JSON-schema
> gebruikt **alleen open/neutrale velden** — niets dat alleen in één
> concurrent-tool betekenis heeft.

## ZIP-inhoud

```
project-export.zip
├─ dossier.pdf          leesbaar opleverdossier
├─ dossier.json         gestructureerde data (dit schema)
├─ manifest.txt         alle bestanden + SHA-256 + status
└─ bijlagen/            originele foto's/documenten, naam + metadata intact
```

## dossier.json (schema v1)

| Veld | Type | Betekenis |
|---|---|---|
| `schemaVersie` | string | `"speeq-wkb-export/1.0"` |
| `gegenereerdAt` | ISO-datum | exportmoment |
| `project.id` | string | projectreferentie |
| `project.naam` | string | projectnaam |
| `project.adres` | string? | bouwadres |
| `project.opdrachtgever` | string? | opdrachtgever |
| `project.gevolgklasse` | string? | bijv. `GK1` |
| `project.projecttype` | string? | `gk1` / `verbouw` |
| `risicobeoordeling` | string? | samenvatting risico's |
| `borgingsplan` | string? | referentie/omschrijving |
| `controlepunten[]` | array | zie hieronder |
| `afwijkingen[]` | array | omschrijving + herstel + opgelostAt |
| `bijlagen[]` | array | bestandsnaam + type + beschrijving |

### controlepunt

```json
{
  "id": "cp-101",
  "omschrijving": "Wapening fundering",
  "status": "akkoord",
  "discipline": "constructie",
  "vastlegdatum": "2026-06-01T10:14:00.000Z",
  "verantwoordelijke": "J. Vakman",
  "locatie": { "lat": 52.08, "lng": 4.31 },
  "fotos": ["bijlagen/cp-101-1.jpg"]
}
```

`status` is genormaliseerd en vendor-neutraal: `akkoord` / `in_behandeling` /
`afgekeurd` / `onbekend`.

## manifest.txt

Eén regel per bestand: `<sha256>  <bytes>  <status>  <pad>`. Status is `OK`,
`ONTBREEKT` (bijlage niet gevonden) of `CORRUPT` (niet te lezen). Een ontbrekende
of corrupte bijlage **stopt de export niet** — het wordt zichtbaar genoteerd.

## Voorbeeld (verkort)

```json
{
  "schemaVersie": "speeq-wkb-export/1.0",
  "gegenereerdAt": "2026-06-14T12:00:00.000Z",
  "project": { "id": "p-1", "naam": "Woning 12", "gevolgklasse": "GK1", "projecttype": "gk1" },
  "controlepunten": [
    { "id": "cp-101", "omschrijving": "Wapening fundering", "status": "akkoord",
      "discipline": "constructie", "vastlegdatum": "2026-06-01T10:14:00.000Z",
      "verantwoordelijke": "J. Vakman", "fotos": ["bijlagen/cp-101-1.jpg"] }
  ],
  "afwijkingen": [],
  "bijlagen": [ { "bestandsnaam": "bijlagen/cp-101-1.jpg", "type": "image/jpeg", "beschrijving": "Wapening fundering" } ]
}
```

## Hoe lever ik mijn dossier aan de kwaliteitsborger

1. Open het project → **Dossier-export (vendor-neutraal)**.
2. Wacht tot de bundel klaar is (achtergrond-job; je krijgt bericht).
3. Download de ZIP en stuur die door, óf deel hem via de bestaande deellink.
4. De borger opent `dossier.pdf` om te lezen, gebruikt `dossier.json` om in te
   lezen, en controleert `manifest.txt` voor de integriteit van de bijlagen.

## Service

`frontend/src/services/VendorExportService.ts` — pure `bouwDossierJson` +
`bouwManifest` (SHA-256 via injecteerbare hash-functie; ontbrekende/corrupte
bijlagen worden genoteerd, niet fataal). ZIP/PDF-assemblage, achtergrond-job en
audit-log zitten eromheen.
