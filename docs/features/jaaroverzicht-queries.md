# Wkb-jaaroverzicht — datavragen

Read-only spiegel op bestaande tenant-data. Geen nieuwe tabellen, geen dubbele
opslag. RLS zorgt voor tenant-isolatie; deze laag filtert nogmaals op periode
zodat alle cijfers consistent zijn. Geen benchmarking tegen andere aannemers.

Bron-module: `frontend/src/services/JaaroverzichtService.ts`.

## Periode

- Default = lopend kalenderjaar (`lopendKalenderjaar`).
- Keuzes: heel jaar / lopend jaar / vrije van–tot.
- Lege periode → nette nul-staat (`leeg: true`), geen crash.

## KPI's (per ingelogde tenant, binnen periode)

| KPI | Afleiding |
|---|---|
| Projecten | projecten met opleverdatum in periode **óf** met controlepunt-activiteit in periode |
| Controlepunten | `controlepunten` met `vastgelegdAt` in periode |
| Foto's | controlepunten in periode met `heeftFoto = true` |
| Dossiers | opgeleverde dossiers (`bevoegd-gezag` + `consument`) met `gegenereerdAt` in periode |
| Gem. controlepunten/project | controlepunten ÷ projecten, 1 decimaal |

Een lopend project zonder activiteit in de periode telt **niet** mee — voorkomt
dat hetzelfde project elke periode meetelt.

## Maandtrend

Controlepunten gegroepeerd per `YYYY-MM` (op `vastgelegdAt`), oplopend
gesorteerd. Voedt een simpele staaf/lijn zodat de aannemer ziet hoe consequent
hij vastlegt.

## SQL-schets (indicatief, per tenant-instance)

```sql
-- Controlepunten in periode
select date_trunc('month', vastgelegd_at) as maand, count(*)
from controlepunten
where vastgelegd_at between :van and :tot
group by 1 order by 1;

-- Dossiers in periode
select count(*) from dossiers
where soort in ('bevoegd-gezag','consument')
  and gegenereerd_at between :van and :tot;
```

Een cijfer dat niet betrouwbaar uit de huidige tabellen komt, wordt weggelaten —
liever vijf kloppende cijfers dan acht die discussie opleveren.

## Status

Functionele aggregatiekern klaar en getest (`bouwJaaroverzicht`). De pagina
`/jaaroverzicht` (periodekiezer, KPI-tegels, maandtrend) + PDF-export horen bij de
visuele laag (losse branch + PR, conform de bouwprompt).
