# demo-data — Schoon Sales-demo project

> Maakt een schoon "Sales Demo 29-05" project aan met 4 representatieve foto's
> die de complete WKB-flow tonen (AI passed + needs review + rejected + approved).

---

## Inhoud

| Bestand | Doel |
|---|---|
| `sales_demo_project.sql` | Het SQL-script dat 1 project + 4 evidence rows insert |
| `cleanup_sales_demo_project.sql` | Verwijdert het demo-project ná de sales (opruim) |

---

## Wanneer uitvoeren

### Vóór de demo (28 mei avond):

```bash
# Via Supabase MCP (in Claude) of de Supabase SQL Editor:
# Plak inhoud van sales_demo_project.sql, voer uit.
```

Resultaat: project `sales-demo-2026-05-29` is aangewezen, met 4 foto's:

| # | Inspectiepunt | AI status | Review status | Wat het toont |
|---|---|---|---|---|
| 1 | KIK-INSTALLATIE-001 (sanitair) | PASSED 96% | APPROVED | "AI doet het zelf" |
| 2 | KIK-BRANDVEILIGHEID-006 | PASSED 91% | APPROVED | "Brandveiligheid auto-OK" |
| 3 | KIK-AFBOUW_SCHILDER-007 | NEEDS_REVIEW 73% | PENDING_REVIEW | "Project leader krijgt notificatie" |
| 4 | KIK-ELEKTRA-003 | FAILED 41% | REJECTED | "AI vangt fouten" |

### Ná de demo (29 mei avond):

```bash
# Voer cleanup_sales_demo_project.sql uit om de demo data weer weg te halen.
```

---

## Belangrijke notitie

Het demo-project gebruikt de tenant `demo` (bestaat al).
De foto's verwijzen naar Unsplash-placeholders — dezelfde die de bestaande demo-foto's gebruiken.
Geen storage upload nodig, geen netwerk-traffic, geen kosten.

Als je écht echte foto's wilt voor de demo:
1. Maak ze nu vooraf met je telefoon op locatie
2. Upload via vakman-flow in de tool (productie)
3. Tag het project handmatig in Supabase als `sales-demo-2026-05-29` (UPDATE projects SET ...)
