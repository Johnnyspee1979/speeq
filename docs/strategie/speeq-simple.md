# SpeeQ Simple — terug naar wat de klant écht nodig heeft

**Datum:** 23 mei 2026
**Status:** voorstel — Johnny beslist morgen
**Aanleiding:** vandaag eindelijk zelf de tool getest, te complex bevonden.

---

## Het echte doel (Johnny's woorden, 23 mei)

> Bedrijf heeft projectleider + werkvoorbereider.
> WKB-werkzaamheden moeten voldoen aan wet en regelgeving.
> Vakman maakt foto met mobiel: wie, wat, waar, met wat, hoe — met GPS.
> Werkvoorbereider en projectleider kunnen aanpassen.
> Bij goedkeuring → Supabase voor gecontroleerde opslag.
>
> **"Het hoeft niet groter."**

---

## De flow in 1 plaatje

```
VAKMAN (mobiel)                WERKVOORBEREIDER + PL (desktop)
────────────────                ────────────────────────────────
1. Open app          ───foto──►   1. Inbox: nieuwe foto's
2. Tik "Maak foto"                2. Open foto → zie metadata
3. App vult in:                   3. Pas aan / vul aan
   • GPS                          4. Akkoord / Afkeur
   • Tijdstempel                                   │
   • Project                                       ▼
   • Borgingspunt           ────goedgekeurd────► Supabase
   • Wie (jij)                                  (definitief)
   • Wat (omschrijving)
   • Hoe (eigen notitie)
4. Verstuur
```

---

## Wat al gebouwd is (verstopt onder complexiteit)

| Functie | Bestaande code |
|---|---|
| Camera + GPS-tagging op mobiel | `CameraView.tsx` |
| Foto + metadata naar Supabase | `evidence` tabel + cloud-repository |
| Werkvoorbereider-inbox | `WerkvoorbereiderDashboard.tsx` (Bewijs-tab) |
| Aanpassen door werkvoorbereider | `reviewRoutes.ts` (backend) |
| Akkoord / afkeur | `updateEvidenceStatus` |

**Conclusie:** geen nieuwe features bouwen. Bestaande tool verbergen onder eenvoudige modus.

---

## Wat NIET in SpeeQ Simple komt (= verbergen, niet weggooien)

| Verbergen | Reden |
|---|---|
| Offline-mode toggle | Vakman heeft op de meeste bouwplaatsen netwerk |
| Voice (ElevenLabs) | Eerst tool werkend krijgen, dan plezier-features |
| MobileNet AI-categorisatie | Cloud-AI doet het al, lokaal hoeft niet |
| 50+ Presets | Eerste klant heeft 5-10 punten, niet 50 |
| Modules-toggles | "Simple" = geen toggles |
| Bedrijfsbranding | Komt later in "Pro" pakket |
| Team Beheer | Eerst 1 werkvoorbereider, dan complexer |
| DSO-koppeling | Later, niet voor MVP |
| AI Model dashboard | Intern, niet voor klant zichtbaar |
| Conflict-resolution UI | Pas relevant met meerdere offline-gebruikers |
| Telemetry diagnose-paneel | Voor jou, niet voor klant |

Alles blijft in de codebase — alleen niet zichtbaar in de "Simple"-modus.

---

## Wat WEL in SpeeQ Simple zichtbaar is

### Mobiel (vakman)
1. **Home** — 1 knop "Maak foto" + lijst van recente foto's
2. **Camera** — foto maken + metadata-formulier (project, borgingspunt, omschrijving)

### Desktop (werkvoorbereider + projectleider)
1. **Inbox** — lijst van nieuwe foto's wachten op beoordeling
2. **Detail** — foto + alle metadata + edit-velden + Akkoord/Afkeur knoppen
3. **Project-overzicht** — goedgekeurd / afgekeurd / wachtend + PDF-export per project

**Totaal: 2 mobiel-schermen + 3 desktop-schermen.** Niet 14.

---

## Hoe technisch implementeren

Niet slopen — **verbergen** via een `simple_mode` vlag in `tenant_features`:

```ts
tenant_features: {
  ...,
  simple_mode: boolean  // default: true voor nieuwe tenants
}
```

In de zijbalk + hoofdroutes:
```ts
if (tenantFeatures.simple_mode) {
  // toon alleen: Vakman (mobiel) / Inbox (desktop)
  // verberg: Modules, Presets, DSO, Team Beheer, Bedrijfsbranding, etc.
}
```

**Estimate:** 2-3 werkdagen om dit te wiren in de bestaande code.

---

## Eerste klant-tactiek

1. **Geef tool weg gratis** aan 1 mkb-aannemer voor 3 maanden in ruil voor wekelijkse 30-min feedback-call
2. Observeer waar ze vastlopen → fix die punten
3. Pas dán: prijs vaststellen + meer klanten

**Voor maand 1 niet bouwen — kijken.**

---

## Wat dit document NIET is

- Geen sprint-planning met PRs en deadlines.
- Geen technisch ontwerp-document.
- Geen verkoop-pitch.

Het is **één A4 om vandaag mee af te sluiten en morgen mee te beginnen**.

---

## Beslissing voor Johnny (morgen)

**Een van twee:**

1. **JA, dit is wat ik bedoelde** → we maken een 3-dagen plan om Simple-modus te wiren
2. **NEE, ik wil iets anders** → we praten morgen over een 3e route

Geen druk om vandaag te beslissen. Eet lunch.

---

*Auteur: Claude + Johnny · 23 mei 2026 · 13:00*
*Bij twijfel: dit document is leidend boven `STATUS.md`.*
