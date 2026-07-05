# EKV- en montage-dossier

Uitbreiding van het bestaande projectdossier voor prefab/industrieel bouwen.
Bewijs zit deels in een **fabrieks-EKV** (erkende kwaliteitsverklaring) en deels
in wat de aannemer bij de **montage op de bouwplaats** vastlegt. Wat er ook met
de bouwmelding/borger gebeurt: de aansprakelijkheid blijft bij de aannemer, dus
hij moet beide kunnen aantonen.

## Waarom

De TloKB/VKBN waarschuwen dat een EKV de **fabriek** borgt, niet de hele woning.
SpeeQ dicht het gat: koppel de fabrieks-EKV én volg de montage-stappen als apart
spoor. Eén compleet aansprakelijkheidsdossier, onafhankelijk van het wettelijke
spoor.

## Datamodel — inpassing (geen tweede systeem)

| Onderdeel | Waar |
|---|---|
| EKV (nummer, uitgever, geldig-tot, bewijsbestand) | `project_ekv` (1 per project) |
| Montage-checks (apart controlepunten-spoor) | `project_montage_checks` |

De montage-checks zijn **niet** een nieuwe dossier-engine — ze hangen aan het
project en rollen mee in de bestaande dossier-/export-structuur naast de reguliere
controlepunten. Offline-first: lokaal invulbaar, later sync naar de juiste tenant.

## EKV-status

| Status | Wanneer |
|---|---|
| `GELDIG` | nummer + uitgever + geldig-tot in de toekomst |
| `VERLOPEN` | geldig-tot in het verleden |
| `ONVOLLEDIG` | nummer of uitgever ontbreekt |
| `GEEN` | geen EKV vastgelegd |

## Montage-spoor

Elke montage-check: `id`, `omschrijving`, `status` (`OPEN`/`AKKOORD`/`AFGEKEURD`),
`vastgelegdAt`, `verantwoordelijke`, optioneel `fotoPath`. Het spoor is **gereed**
als alle checks `AKKOORD` zijn.

## Dossier-bijdrage

`vatDossierbijdrageSamen(ekv, checks)` geeft één regel voor export: EKV-status +
montage-voortgang (`x/y akkoord`). Breekt de bestaande exportstructuur niet —
het is een extra blok.

## Service

`frontend/src/services/EkvMontageService.ts` — pure functies: `beoordeelEkv`,
`montageVoortgang`, `montageGereed`, `vatDossierbijdrageSamen`,
`formatEkvRegel`. Tests dekken geldig/verlopen/onvolledig + montage-voortgang.
