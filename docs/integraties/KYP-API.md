# KYP-API — integratie-onderzoek (stap 1)

> Doel: read-only koppeling tussen SpeeQ en KYP zodat de planning/mijlpalen uit
> KYP zichtbaar worden in het WerkvoorbereiderDashboard, gekoppeld aan
> SpeeQ-bewijscontrolepunten. Sluit een verkoopgat t.o.v. Ed Controls.
>
> Onderzoeksdatum: 2026-05-30 · Bron: officiële KYP Swagger + help-center.

## Samenvatting

KYP heeft een **echte, gedocumenteerde REST-API** (Swagger). Een read-only
planning-sync is haalbaar. Schrijven naar KYP doen we **niet** in V1.

| | |
|---|---|
| Base-URL (productie) | `https://kyp.nl/rest` |
| Base-URL (acceptatie) | `https://accept.kyp.nl/rest` |
| Swagger | `https://kyp.nl/swagger/swagger.json` (UI: `/static/swagger/index.html`) |
| Auth | `Authorization: Bearer <access_token>` (API-key header) |
| Webhooks | Geen (alleen e-mailnotificaties). Wel `resthooks`-endpoints. |
| Rate limit | Geen harde limiet; vooraf verwacht volume opgeven |
| Responstijd | ~126 ms gemiddeld, uitschieters tot ~1 min |

## Authenticatie

Er is geen OAuth-flow. Het token wordt zo verkregen:

1. KYP-account aanmaken op `https://kyp.nl/account/registration`.
2. Een projectmanager voegt deze gebruiker als deelnemer toe met de rol
   **Projectmanager** (anders geen API-rechten).
3. Inloggen op `https://kyp.nl/rest/login/api` — het `access_token` verschijnt
   in de browser-URL.
4. Token veilig bewaren en meesturen als header: `Authorization: Bearer <token>`.

> **Belangrijk:** dit token is een persoonlijke integratie-sleutel. In SpeeQ
> wordt het **per tenant** opgeslagen in de tenant-eigen Supabase (niet in de
> master-DB), achter RLS die alleen ADMIN/KEYUSER van die tenant toelaat.
> Johnny / de klant levert dit token zelf aan; het wordt nooit in code of git
> opgenomen.

## Endpoints die we gebruiken (alleen lezen)

| Methode | Pad | Doel |
|---|---|---|
| GET | `/projects` | Lijst projecten (id, name, status, start, end) |
| GET | `/company/projects` | Projecten van het bedrijf (incl. adres) |
| GET | `/projects/{id}` | Volledig project incl. `planning[]` en `calendar[]` |
| GET | `/projects/{id}/phases` | Fases met geneste `activities[]` = de planning-mijlpalen |

### Datamodel (relevant deel)

**Project**
```
id: integer, name: string, type: string, status: string,
start: string (date), end: string (date), paidUntil: string, kypFactor: number
```

**Phase** (een planning-fase)
```
id: integer, name: string, type: string, activities: Activity[]
```

**Activity** (een mijlpaal/taak binnen een fase)
```
id: integer, name: string, type: string,
startDate: string, endDate: string, dateFinished: string|null,
responsible: string, color: string, phaseName: string
```

`Activity.dateFinished` (gevuld = afgerond) bepaalt de status die we als
`StatusPill` tonen. `startDate`/`endDate` geven de planning-strook.

## Mapping naar SpeeQ

```
KYP Project        ──>  SpeeQ-project (handmatige koppeling door KEYUSER)
KYP Phase          ──>  sectie-kop in de planning-kaart
KYP Activity       ──>  planning-mijlpaal (naam, datum, status)
Activity.dateFinished gevuld  ──>  StatusPill "afgerond" (success)
endDate < vandaag & niet af   ──>  StatusPill "te laat" (warning)
anders                        ──>  StatusPill "gepland" (neutral)
```

## Wat V1 NIET doet

- Geen schrijven naar KYP (geen terugmelden "klaar"). Komt in V2 op klantverzoek.
- Geen server-side cron over álle tenants tegelijk: de backend (Railway) heeft
  alleen master-credentials, geen per-tenant service-key. Daarom draait de sync
  **client-side** vanuit de actieve tenant: automatisch bij openen van de
  planning-kaart (stale-while-revalidate) plus een handmatige "ververs"-knop.
  Een centrale dagelijkse cron is V2 zodra per-tenant service-keys centraal
  beschikbaar zijn.
- Geen reverse-engineering: we gebruiken uitsluitend de officiële Swagger-API.

## Openstaand (heeft Johnny / de klant nodig om live te gaan)

1. Een KYP-account met **Projectmanager**-rol op de relevante KYP-projecten.
2. Het `access_token` daarvan (zelf invoeren in het SpeeQ KYP-configuratiescherm).
3. Per SpeeQ-project de juiste KYP-project-koppeling kiezen.

Zolang stap 1–3 niet gedaan zijn, toont de planning-kaart een nette lege staat
met uitleg; er crasht niets.

---

# V2 — status-terugmelding (write-back)

> Onderzoeksdatum: 2026-06-09 · Aanleiding: Ed Controls koppelt nu
> bidirectioneel met KYP; de terugmelding wordt een verkoopbezwaar.

## Wat V2 toevoegt

Eén minimale, expliciet geaccordeerde write-back: als een gekoppeld
SpeeQ-controlepunt op **afgerond** gaat, schrijven we de bijbehorende
KYP-activiteit op **gereed** terug. **Alleen het statusveld** (`dateFinished`).
Nooit planning, documenten, structuren of verwijderingen.

## Schrijf-endpoint (Swagger)

| Methode | Pad | Doel |
|---|---|---|
| PUT | `/projects/{projectId}/activities/{activityId}` | Werk één activiteit bij |

We sturen **uitsluitend** het veld `dateFinished` mee (gevuld = gereed, `null` =
heropenen). Alle andere velden laten we ongemoeid; KYP behoudt ze. Het endpoint
vereist dezelfde Bearer-auth en de **Projectmanager**-rol als de leesroutes.

> Blijkt dit endpoint in een latere KYP-versie niet (meer) beschikbaar of niet
> beperkt tot status, dan valt V2 stil terug op read-only V1 — de write-back is
> per project **opt-in (default uit)** en blokkeert nooit de SpeeQ-workflow.

## Veiligheidsmodel

- **Opt-in per gekoppeld project** (`kyp_project_mapping.writeback_enabled`,
  default `false`). Staat het uit → geen enkele schrijfpoging.
- **Bevestiging per actie** in de UI vóór er iets naar KYP gaat (de service zelf
  schrijft nooit ongevraagd; de werkvoorbereider drukt bewust op terugmelden).
- **Statusmapping** (`kyp_status_mapping`): koppelt een SpeeQ-controlepunt aan een
  KYP-activiteit (`kyp_activity_id`) binnen het gekoppelde project.
- **Audit-log** (`kyp_writeback_log`): elke poging — wie, wat, wanneer, de
  KYP-HTTP-status en of het lukte. Mislukt = `status='mislukt'`, het SpeeQ-punt
  blijft afgerond; opnieuw proberen kan.
- Het token blijft versleuteld per tenant (zoals V1); nooit in code/git/master-DB.

## Service-uitbreiding

`frontend/src/services/KypService.ts`: `buildWritebackPayload` (puur — alleen
`dateFinished`), `mapAction` (statusmapping opslaan), `pushStatus` (PUT + log,
respecteert opt-in), `getWritebackLog`. Tests dekken payload-opbouw, opt-in-gate,
succes-log en mislukt-log.
