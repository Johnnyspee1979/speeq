# UX Ultraplan — SpeeQ toegankelijk maken

**Datum:** 23 mei 2026
**Aanleiding:** demo-walkthrough met Johnny in live productie. Hij raakte zelf het pad kwijt in zijn eigen tool. Vakman zou hetzelfde overkomen.

---

## Diagnose

### Wat ik live zag gebeuren

| Symptoom | Wat dat betekent |
|---|---|
| "Waar moet ik beginnen?" | Geen onboarding-flow voor lege account |
| 14 items in zijbalk | Mengt vakman + werkvoorbereider + admin |
| Camera-icoon doet niets op desktop | Geen platform-detectie of hint |
| "Bewijs" vs "Dossier" vs "Punchlist" | 3 woorden voor ~hetzelfde |
| Lege schermen met alleen tekst | Geen call-to-action, geen wizard |
| Klik op verkeerd icoon → raw JSON | Niet user-proof |
| Klik op Wkb-link → overheid-site | Onbedoelde uitstap |

### Kern-observatie

> 26 PRs in 2 dagen aan AI/voice/offline-features.
> 0 PRs aan onboarding/empty-states/rol-clarity.

De tool is technisch geweldig, gebruikers-moeilijk.

---

## Quick wins (1-3 dagen totaal)

### #1 — Leeg-project wizard met QR-code
**Tijd:** 1 dag
**Wat:** Bij 0 foto's tonen we een vriendelijk blok: "👋 Eerste foto maken? Open op je telefoon" + QR-code naar productie-URL met project-deeplink.
**Effect:** Niemand staart meer naar lege schermen. Direct duidelijk wat de volgende stap is.

### #2 — Rol-keuze bij eerste login
**Tijd:** 2 dagen
**Wat:** Bij eerste login modal: "Wat is jouw rol?" → Vakman / Werkvoorbereider / Kwaliteitsborger / Admin. Zijbalk past zich aan, toont alleen wat relevant is voor die rol. Opslaan in user metadata.
**Effect:** Van 14 zijbalk-items naar 5 per rol. Gebruiker raakt niet meer verloren.

### #3 — Desktop-camera disable
**Tijd:** 0.5 dag
**Wat:** Op desktop (geen camera) krijgt het camera-icoon een grijze styling + tooltip "Werkt op telefoon" + optionele QR-code-popover.
**Effect:** Geen klikken op knoppen die niets doen.

---

## Medium prio (week 1-2 na quick wins)

### #4 — Terminologie-cleanup
**Wat:** Eén woord voor één ding.
- "Foto" overal (niet bewijs / evidence / upload / media)
- "Project" niet dossier (dossier = de PDF-export)
- "Beoordeling" niet review / status / akkoord
**Tijd:** 1 dag (vooral search-replace + review)

### #5 — Klik-veilige externe links
**Wat:** Links naar overheid/Wkb-info openen in een modal met "We sturen je naar buiten — wil je doorgaan?" + new-tab.
**Tijd:** 0.5 dag

### #6 — Demo-modus toggle
**Wat:** Knop in admin-scherm: "Voeg 5 demo-foto's toe" — voor verkoopgesprekken. Achteraf 1-klik wissen.
**Tijd:** 1 dag

---

## Grote refactors (eigen sprint, na medium prio)

### #7 — 2-scherm vakman-app
**Wat:** Op mobiel detecteren → tonen alleen 2 schermen: "Take Photo" + "My Photos". Andere modes verbergen.
**Tijd:** 1 week
**Effect:** Vakman opent app → kan binnen 3 seconden foto maken. Geen menu-zoeken.

### #8 — Werkvoorbereider Kanban-view
**Wat:** Trello-achtig: Pending / Akkoord / Afgekeurd kolommen. Drag-and-drop tussen kolommen = status wijzigen.
**Tijd:** 1-2 weken
**Effect:** Beoordelen wordt 10× sneller, visueel duidelijk wat status is.

---

## Volgorde

```
Week 0 (NU)      → #1, #2, #3 quick wins
Week 1           → Eerste klant op de tool, observeer hun gedrag
Week 2-3         → #4, #5, #6 op basis van klant-observatie
Sprint Q3        → #7, #8 grote refactors
```

**Niet doen voordat dit alles af is:** nieuwe AI-features, nieuwe voice-features, nieuwe modules. Eerst maken dat wat er is goed werkt.

---

## Hoe meet je succes

Voor elke wijziging één KPI:

| Wijziging | Meet |
|---|---|
| Empty-state wizard | % nieuwe users die binnen 5 min eerste foto maken |
| Rol-keuze | Klikken-tot-eerste-actie (verwacht: -60%) |
| Desktop-camera | Aantal verwarrings-vragen aan support |
| Terminologie | % users die "wat is het verschil tussen bewijs en dossier?" vraagt |
| Kanban-view | Tijd-per-beoordeling werkvoorbereider |

---

*Auteur: Claude + Johnny · 23 mei 2026 · Spee Solutions*
