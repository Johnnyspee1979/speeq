# Dossier-sjabloon (Word → Adobe Document Generation API)

Dit document beschrijft de **merge-tags** voor het Word-sjabloon dat de
Adobe-dossiermotor (`backend/src/services/dossierService.ts`) gebruikt. Jij maakt
het `.docx` zelf met de **Adobe Document Generation Tagger** (Word Add-In), zodat
de opmaak (logo, koptekst, lettertype) volledig van jou is. De motor vult alleen
de gegevens in — hij raakt de opmaak niet aan.

> **Belangrijk:** de tag-namen hieronder zijn de bron-van-waarheid. De motor
> bouwt een JSON met exact deze sleutels. Verander je een tag in Word, verander
> dan ook de mapping in `dossierService.ts` (functie `buildTemplateData`).

---

## 1. Projectkop (losse tags, één keer in het document)

| Merge-tag in Word        | Betekenis                                  | Bron (DB-kolom)            |
|--------------------------|--------------------------------------------|----------------------------|
| `{{project.naam}}`       | Projectnaam                                | `projects.name`            |
| `{{project.adres}}`      | Bouwadres                                   | `projects.address`         |
| `{{project.opdrachtgever}}` | Opdrachtgever / initiatiefnemer         | `projects.initiator_name`  |
| `{{project.aannemer}}`   | Aannemer (indien vastgelegd)               | `projects.aannemer_name`*  |
| `{{project.id}}`         | Technisch project-ID                       | `projects.id`              |
| `{{gegenereerd_op}}`     | Datum/tijd van genereren (NL-notatie)      | server-klok                |

\* `aannemer_name` bestaat mogelijk nog niet als kolom. Als de kolom ontbreekt
valt de tag terug op een leeg veld (`""`) — de motor crasht hier nooit op.

---

## 2. Bewijs-blok (herhaalt per evidence-foto)

Maak in Word een **herhaal-sectie** (Adobe: *Insert Repeating Section*) gekoppeld
aan de lijst `evidence`. Binnen die sectie gebruik je per item:

| Merge-tag in Word          | Betekenis                                   | Bron (DB-kolom)                       |
|----------------------------|---------------------------------------------|---------------------------------------|
| `{{punt.omschrijving}}`    | Korte omschrijving / veldnotitie            | `evidence.field_note`                 |
| `{{punt.timestamp}}`       | Moment van vastleggen (NL-notatie)          | `evidence.timestamp`                  |
| `{{punt.locatie}}`         | GPS-locatie (lat, lng + nauwkeurigheid)     | `evidence.latitude/longitude`         |
| `{{punt.status}}`          | AI-beoordeling (bv. GOEDGEKEURD)            | `evidence.ai_status`                  |
| **afbeelding-tag**         | De foto zelf (zie hieronder)                | `evidence.media_uri` → base64         |

### Afbeelding invoegen (image-tag)
Adobe Document Generation ondersteunt afbeeldingen via een **image placeholder**:

1. Voeg in de herhaal-sectie een afbeelding in (een tijdelijke placeholder-foto).
2. Selecteer de afbeelding → in de Tagger kies je *Image* en koppel je het veld
   **`punt.foto`**.
3. De motor levert `punt.foto` aan als **base64 data-URI**
   (`data:image/jpeg;base64,...`), geschaald tot max **1600px breed, kwaliteit 80**.
   De originelen in de `wkb-evidence`-bucket blijven onaangeroerd.

---

## 3. Voorbeeld van de JSON die de motor genereert

Dit is wat `buildTemplateData` oplevert en aan Adobe wordt gevoerd — puur ter
referentie, je hoeft dit niet zelf te maken:

```json
{
  "project": {
    "id": "f1e2…",
    "naam": "Nieuwbouw Vinkenstraat 12",
    "adres": "Vinkenstraat 12, Den Haag",
    "opdrachtgever": "Aannemersbedrijf De Vries B.V.",
    "aannemer": "De Vries Bouw"
  },
  "gegenereerd_op": "31 mei 2026, 14:22",
  "evidence": [
    {
      "omschrijving": "Wapening fundering noordzijde",
      "timestamp": "28 mei 2026, 09:14",
      "locatie": "52.0705, 4.3007 (±4 m)",
      "status": "GOEDGEKEURD",
      "foto": "data:image/jpeg;base64,/9j/4AAQSk…"
    }
  ]
}
```

---

## 4. Welke evidence komt in het dossier?

De motor selecteert alleen **goedgekeurd** bewijs (`ai_status` ∈
`APPROVED`, `PASSED`), gesorteerd op `timestamp` oplopend — dezelfde regel als de
bestaande `generateBevoegdGezagDossier`. Afgekeurde of nog niet beoordeelde foto's
verschijnen niet in het dossier.

---

## 5. Workflow samengevat

```
Word-sjabloon (.docx, door Johnny getagd)
        │
        ▼
dossierService.buildDossier(projectId)
        │  ├─ haalt project + goedgekeurde evidence uit Supabase
        │  ├─ downloadt elke foto (geschaald 1600px/q80) → base64
        │  ├─ bouwt JSON met bovenstaande tags
        │  └─ Adobe Document Generation API: sjabloon + JSON → PDF
        ▼
Upload PDF → bucket `dossiers` op pad `project_id/dossier-<timestamp>.pdf`
        │
        ▼
Schrijf nieuwste URL terug → projects.dossier_url
```

Bij een (tijdelijke) Adobe-storing logt de motor netjes en laat het **oude**
dossier staan — er wordt nooit een half PDF weggeschreven.

---

## 6. Waar zet je het sjabloon neer?

Upload je getagde `.docx` naar de Supabase-bucket **`dossier-templates`** met
bestandsnaam **`dossier-sjabloon.docx`** (of zet het pad in
`DOSSIER_TEMPLATE_PATH`). De motor downloadt het sjabloon bij elke run, zodat je
de opmaak kunt bijwerken zonder de code aan te raken.
