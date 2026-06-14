# Bewijs-van-aanwezigheid bij controlepunten

Een lichte laag bovenop de bestaande controlepunten die een **controleerbaar
spoor** geeft van wáár en wánneer een controle is vastgelegd — geen juridisch
hardgemaakt bewijs, wel een eerlijk, narekenbaar spoor.

## Aanleiding

De Wkb-evaluatie 2026 (Arcadis-onderzoek + gemeentelijke jaarverslagen + peiling
onder ~150 bouwambtenaren) bekritiseert dat private kwaliteitsborging te licht
zou zijn en dat bouwplaatsen soms niet fysiek worden bezocht. Twee derde van de
bevraagde gemeenten is ontevreden. Wie kan aantonen dat de controle écht op
locatie gebeurde — juiste plek, juiste moment — staat sterker richting gemeente,
borger en verzekeraar.

## Toon en grenzen (belangrijk)

- De badge zegt **"vastgelegd op locatie"**, niet "wettelijk bewijs".
- **Geen** continue tracking of achtergrond-volgen — alleen een momentopname op
  het bewuste vastlegmoment.
- **Geen** harde blokkade als locatie ontbreekt; netjes markeren als "zonder
  locatiebewijs".
- Locatie is **opt-in per project** en uit te zetten.

## Velden (per controlepunt/evidence)

| Veld | Betekenis |
|---|---|
| `presence_lat` / `presence_lng` | Locatie op het vastlegmoment (opt-in). |
| `presence_accuracy_m` | Nauwkeurigheid in meters (GPS). |
| `presence_device_time` | Tijd volgens het apparaat bij vastleggen. |
| `presence_server_time` | Server-ontvangsttijd bij sync (referentie). |
| `presence_status` | `OP_LOCATIE` / `ZONDER_LOCATIE`. |

Project-instelling: `location_evidence_enabled` (aan/uit, opt-in).

## Tijdstempel-integriteit

Naast de apparaat-tijd bewaren we de **server-ontvangsttijd** bij sync. Wijkt de
apparaat-tijd meer dan **5 minuten** af van de server-tijd, dan toont het dossier
"tijd onder voorbehoud" — eerlijk, geen verborgen correctie. We claimen geen
onweerlegbaarheid; we maken een afwijkende kloktijd juist zichtbaar.

## Nauwkeurigheid

| Nauwkeurigheid | Oordeel |
|---|---|
| ≤ 20 m | goed (groen) |
| ≤ 50 m | matig (oranje) |
| > 50 m | laag (oranje, met nuance) |

## Service

`frontend/src/services/AanwezigheidsbewijsService.ts` — pure functies:
`beoordeelAanwezigheid`, `formatAanwezigheidsBadge`, `detecteerKlokafwijking`.
Unit-tests dekken: met locatie, zonder locatie, grote tijdsafwijking, lage
nauwkeurigheid.
