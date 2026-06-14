# Verbouw-modus — vrijwillig opleverdossier

Een lichte tweede projecttak naast GK1-nieuwbouw: dezelfde foto- en
controlepunt-vastlegging, maar zonder de wettelijke Wkb-stappen die voor verbouw
(nog) niet gelden. Eerlijk gelabeld als **vrijwillig privaat dossier**, geen
formeel "dossier bevoegd gezag".

## Juridische status (expliciet)

- Wkb geldt sinds 1-1-2024, nu alleen **GK1-nieuwbouw**.
- **Verbouw/renovatie is uitgesteld zonder vastgestelde invoeringsdatum** (reden:
  kosten van kwaliteitsborging te zwaar voor kleine projecten). Bron: IPLO, VNG,
  Rijksoverheid. "Nog niet" — geen afstel; bij de driejaars-evaluatie kan de
  verbouw-schil alsnog aangezet worden.
- Verbouw kent daarom (nu nog) **geen bouwmelding, geen verplichte
  kwaliteitsborger en geen wettelijke gereedmelding** bij bevoegd gezag.

## Projecttype

| Type | Betekenis |
|---|---|
| `gk1` | Nieuwbouw gevolgklasse 1 — volledige Wkb-flow (ongewijzigd). |
| `verbouw` | Verbouw/renovatie — vrijwillig privaat kwaliteitsdossier. |

Opgeslagen per project in de **per-tenant** Supabase (niet de master-DB).

## Wettelijk vs vrijwillig per dossieronderdeel

Voor `verbouw` zijn de zuiver wettelijke onderdelen **niet van toepassing** —
ze worden gemarkeerd ("valt nog niet onder de Wkb"), niet als open taak getoond.

| Dossieronderdeel | GK1 | Verbouw |
|---|---|---|
| Keuringsrapporten per controlepunt (foto's) | verplicht | **blijft** (kwaliteit) |
| As-built tekeningen | verplicht | blijft (kwaliteit) |
| Constructieberekeningen | verplicht | blijft (kwaliteit) |
| Installaties & gebruiksfuncties | verplicht | blijft (kwaliteit) |
| Afwijkingenregister | verplicht | blijft (kwaliteit) |
| Borgingsplan | verplicht | **n.v.t.** (wettelijk) |
| Verklaring kwaliteitsborger | verplicht | **n.v.t.** (wettelijk) |
| Bouwmelding (stap) | verplicht | **n.v.t.** (wettelijk) |
| Gereedmelding bevoegd gezag (stap) | verplicht | **n.v.t.** (wettelijk) |

## Disclaimer (kort, zichtbaar op project + export)

> Dit is een **vrijwillig privaat kwaliteitsdossier** voor verbouw/renovatie —
> geen wettelijk verplicht Wkb-dossier en geen formeel dossier bevoegd gezag.
> Verbouw valt op dit moment nog niet onder de Wet kwaliteitsborging voor het
> bouwen.

## Service

`frontend/src/services/VerbouwModusService.ts` — pure functies:
`isVrijwilligDossier`, `filterDossierVoorProjecttype` (markeert wettelijke
onderdelen als n.v.t. bij verbouw), `wettelijkeStappenStatus`,
`disclaimerVoorProjecttype`. Hergebruikt `DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN`;
GK1-flow blijft volledig ongewijzigd. Tests dekken de projecttype-splitsing.
