# SpeeQ — Hiërarchie & Permissies

**Versie:** 1.0
**Datum:** 2026-05-09
**Eigenaar:** Johnny Spee (SpeeQ Solutions)
**Status:** Single source of truth — alle permissions-besluiten verwijzen hierheen.

---

## 0. Wat is dit document?

Dit is de **blauwdruk** voor wie wat mag in het SpeeQ Wkb-platform. Het beantwoordt drie vragen:

1. Wie zit waar in de hiërarchie?
2. Wie mag wie uitnodigen?
3. Wie ziet welke data en mag welke acties uitvoeren?

Elk codewijziging die met permissies, rollen of zichtbaarheid te maken heeft, wordt **eerst aan dit document getoetst**. Wijkt code af? Dan past de code zich aan, niet dit document.

---

## 1. De vier lagen

```
LAAG 0 — PLATFORM (SpeeQ zelf)
┌────────────────────────────────────────────────────────┐
│  Johnny Spee                              SUPER_ADMIN  │
│  • Houdt platform draaiend (uptime, deploys, fixes)   │
│  • Onboardt nieuwe key-users                          │
│  • Ondersteunt + traint klanten                       │
│  • Factureert                                         │
│  • Ziet alleen anonieme metrics — géén klantdata      │
└────────────────────────┬───────────────────────────────┘
                         │ verkoopt licentie + provisioneert tenant
                         ▼
LAAG 1 — BEDRIJF (de klant — "tenant")
┌────────────────────────────────────────────────────────┐
│  Key-user (klant-admin)                       ADMIN    │
│  • Eén ADMIN per bedrijf                              │
│  • Richt het bedrijfsproces in                        │
│  • Schakelt disciplines aan/uit                       │
│  • Nodigt projectleiders + externe rollen uit         │
│  • Betaalt SpeeQ                                      │
└────────────────────────┬───────────────────────────────┘
                         │ delegeert projecten
                         ▼
LAAG 2 — PROJECT (een bouwplaats)
┌────────────────────────────────────────────────────────┐
│  Projectleider                          PROJECTLEIDER  │
│  • Beheert 1 of meer projecten                        │
│  • Nodigt werkvoorbereiders + voormannen + vakmensen  │
│  • Verdeelt taken en disciplines per project          │
└────────────────────────┬───────────────────────────────┘
                         │ stuurt werk aan
                         ▼
LAAG 3 — UITVOERING (de bouwplaats)
┌────────────────────────────────────────────────────────┐
│  Werkvoorbereider                  WERKVOORBEREIDER    │
│    Bereidt borgingspunten + checklists voor           │
│  Voorman                                  VOORMAN      │
│    Leidt de ploeg op de bouwplaats                    │
│  Vakman                                    VAKMAN      │
│    Maakt foto + GPS-pin + invult-formulier            │
└────────────────────────────────────────────────────────┘

GAST-ROLLEN (staan náást de hiërarchie):
  KWALITEITSBORGER  — extern, beoordeelt namens bevoegd gezag
  OPDRACHTGEVER     — extern, krijgt alleen lees-toegang tot finale dossier
  AANNEMER          — synoniem voor ADMIN bij hoofdaannemers (legacy)
  ONDERAANNEMER     — vakgroep onder AANNEMER (legacy, mapt op VAKMAN)
```

---

## 2. Verantwoordelijkheidsverdeling

| Laag | Verantwoordelijkheid | Niet verantwoordelijk voor |
|---|---|---|
| **SpeeQ (Johnny)** | Platform-uptime, security, releases, support, training, factureren | Bedrijfsproces van klanten, inhoud van dossiers, AVG-verwerking van klantdata |
| **Key-user (ADMIN)** | Bedrijfsinrichting, disciplines, betalen, gebruikersbeheer op bedrijfsniveau | Dagelijkse projectaansturing, foto-bewijs maken |
| **Projectleider** | Project-aansturing, vakmensen toewijzen, kwaliteitsborger inschakelen | Bedrijfsbrede instellingen, andere bedrijven |
| **Werkvoorbereider** | Borgingspunten klaarzetten, checklists, dossier-voorbereiding | Goedkeuring (alleen voorbereiden) |
| **Voorman** | Ploeg op de bouwplaats, dagrapportage | Beoordeling op systeemniveau |
| **Vakman** | Foto's, GPS-pin, veldnotities op eigen taken | Andermans taken zien of bewerken |
| **Kwaliteitsborger** | Beoordelen of bewijs voldoet aan Wkb | Operationele aansturing |
| **Opdrachtgever** | Eindafname dossier | Tussentijdse inzage in werkproces |

---

## 3. Wie mag wie uitnodigen?

> **Hoofdregel:** je mag alleen mensen uitnodigen die één laag onder je staan, plus gast-rollen die op jouw niveau zinvol zijn.

| Wie ben je → | Mag uitnodigen | Mag NIET uitnodigen |
|---|---|---|
| **SUPER_ADMIN** (Johnny) | ADMIN (key-user per nieuwe klant) | Lagere rollen direct — die delegatie loopt via de klant |
| **ADMIN** (key-user) | PROJECTLEIDER, KWALITEITSBORGER, OPDRACHTGEVER | Vakmensen, voormannen, werkvoorbereiders direct (delegeert via projectleider) |
| **PROJECTLEIDER** | WERKVOORBEREIDER, VOORMAN, VAKMAN — *binnen eigen projecten* | Andere projectleiders, externe partijen, mensen op andere projecten |
| **WERKVOORBEREIDER** | — | — |
| **VOORMAN** | — | — |
| **VAKMAN** | — | — |
| **KWALITEITSBORGER** | — | — |
| **OPDRACHTGEVER** | — | — |

### Waarom deze regel?

Als ADMIN direct vakmensen kan uitnodigen, breekt de keten en weet je niet meer onder welke projectleider die vakman valt. Bij dossier-vragen ("wie heeft dit foto goedgekeurd in de keten?") krijg je geen bevredigend antwoord. **Hiërarchie = traceerbaarheid.**

### Uitzondering: kleine bedrijven

Bij een 1-mansbedrijf is de ADMIN ook PROJECTLEIDER. Oplossing: één persoon mag meerdere rollen hebben. We slaan dit op als `roles: string[]` in plaats van één `role`. **(Toekomstige uitbreiding — niet in MVP.)**

---

## 4. Wat ziet wie?

| Rol | Ziet projecten | Ziet bewijs van | Mag goedkeuren | Mag dossier exporteren |
|---|---|---|---|---|
| SUPER_ADMIN | — *(alleen anonieme metrics)* | — | — | — |
| ADMIN | alle van eigen bedrijf | alle van eigen bedrijf | ja, allemaal | ja |
| PROJECTLEIDER | toegewezen projecten | iedereen op die projecten | ja, op die projecten | ja, voor die projecten |
| WERKVOORBEREIDER | toegewezen projecten | iedereen op die projecten | nee (bereidt voor) | conceptversie |
| VOORMAN | toegewezen projecten | eigen ploeg | nee | nee |
| VAKMAN | toegewezen projecten | alleen eigen werk | nee | nee |
| KWALITEITSBORGER | toegelaten projecten | alle bewijs op die projecten | ja, namens gezag | ja, beoordeelde versie |
| OPDRACHTGEVER | toegelaten projecten | alleen finale dossier | nee | ja, alleen finale versie |

### Discipline-filter

Vakmensen, voormannen en werkvoorbereiders zien alleen borgingspunten van de **disciplines** die aan hun profiel hangen. Een loodgieter ziet geen timmer-checklists, een dakdekker ziet geen elektra-borging.

ADMIN, PROJECTLEIDER en KWALITEITSBORGER zien álles, ongeacht discipline.

---

## 5. Tenant-isolatie (data-scheiding tussen klanten)

**Eén klant = één tenant.** Tussen tenants is data **volledig gescheiden**:

- Standaard model: elke tenant heeft een eigen Supabase-project (eigen URL + anon-key)
- Master-DB houdt alleen het register `tenants` bij — geen gebruikersdata
- SUPER_ADMIN heeft alleen toegang tot master-DB, niet tot tenant-DB's

### Wat ziet SUPER_ADMIN dan wél?

Anonieme metrics, geschreven door clients naar een aparte `usage_events` tabel op master:

- Aantal users per tenant (getal)
- Aantal foto's deze week per tenant (getal)
- Welke features worden gebruikt ("hot vs not-hot")
- Sync-errors / openstaande klachten

**Géén:** projectnamen, GPS-coördinaten, persoonsnamen, foto-inhoud, dossiers.

### Impersonatie ("ik moet een klacht oplossen")

Als een klant met een klacht komt, gaat het zo:

1. Klant meldt klacht via support-kanaal
2. SUPER_ADMIN past code aan (op platform-niveau, voor iedereen)
3. **Niet:** SUPER_ADMIN logt in als de klant
4. Als data-onderzoek nodig is: klant geeft expliciet toestemming + SUPER_ADMIN krijgt een tijdelijke read-only toegang die in een audit-log komt

> Reden: AVG-compliance + jouw eigen bescherming. "Ik kon niet bij de data" is een sterker juridisch verhaal dan "ik kon erbij maar deed het netjes."

---

## 6. Tenant-instellingen (door key-user)

De ADMIN kan binnen het eigen bedrijf bepalen:

| Instelling | Voorbeeld |
|---|---|
| Bedrijfstype-preset | Loodgieter / Timmerbedrijf / Aannemer / Scheepsbouw / Aangepast |
| Actieve disciplines | aan/uit per discipline |
| Actieve rollen | bv. geen Kwaliteitsborger nodig → uit |
| Logo + huisstijlkleur | (Pro+ feature) |
| Standaard-projectleider | wie nieuwe projecten standaard krijgt |
| E-mail templates | invite-tekst, reminder-tekst |

Effect: een loodgieter ziet geen tab "Timmerwerk", krijgt geen vakman-rol "elektricien" voorgesteld bij invite. **De UI past zich aan het bedrijf aan.**

---

## 7. Onboarding-flows

### A. Nieuwe klant (key-user) — door Johnny

```
Moederboard → "+ Nieuwe klant"
  → vul in: bedrijfsnaam, admin-email, plan, disciplines
  → automatisch: Supabase aanmaken, migrations runnen,
                 invite-token genereren, welkomstmail sturen
  → klant klikt link in mail → zet wachtwoord → is binnen
```

### B. Projectleider — door key-user (ADMIN)

```
Team Beheer → "+ Projectleider toevoegen"
  → naam + email + (optioneel) telefoon
  → invite-link via email + WhatsApp + QR
  → projectleider klikt → JoinScreen → wachtwoord → is binnen
```

### C. Werkvoorbereider / Voorman / Vakman — door projectleider

```
Project X → Team → "+ Lid toevoegen"
  → naam + email/telefoon + rol + disciplines + project(en)
  → invite-link via email + WhatsApp + QR
  → vakman scant QR op telefoon → JoinScreen → wachtwoord → is binnen
```

### D. Externe partijen (kwaliteitsborger / opdrachtgever) — door key-user

```
Project X → Externe partijen → "+ Kwaliteitsborger toelaten"
  → email + welke projecten
  → invite-link met beperkte scope
  → KB klikt → ziet alleen toegelaten projecten
```

---

## 8. Permissies-matrix (acties)

> Legenda: ✅ = mag • 🔒 = alleen op eigen scope • ❌ = mag niet

| Actie | SUPER | ADMIN | PROJ-L | WV | VOOR | VAK | KB | OG |
|---|---|---|---|---|---|---|---|---|
| Nieuwe tenant aanmaken | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant-instellingen wijzigen | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Project aanmaken | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Projectleider uitnodigen | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Vakman uitnodigen | ❌ | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Borgingspunt toevoegen aan project | ❌ | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Foto/bewijs uploaden | ❌ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| Bewijs goedkeuren | ❌ | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | ❌ |
| Bewijs afkeuren met opmerking | ❌ | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | ❌ |
| Dossier-PDF genereren (concept) | ❌ | ✅ | 🔒 | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Dossier-PDF genereren (finaal) | ❌ | ✅ | 🔒 | ❌ | ❌ | ❌ | 🔒 | ❌ |
| Dossier-PDF inzien (alleen finaal) | ❌ | ✅ | 🔒 | 🔒 | 🔒 | ❌ | 🔒 | 🔒 |
| Tenant verwijderen | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Anonieme metrics inzien | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Beslisregels bij twijfel

Als je niet zeker weet of een rol iets mag, gebruik deze checklist:

1. **Hoort de actie bij hun laag?** Een vakman die een tenant-instelling wijzigt = nee.
2. **Heeft de rol scope op de doel-resource?** Een projectleider die foto's van een ander project ziet = nee.
3. **Breekt het de keten?** ADMIN die direct vakmensen aanmaakt = ja, dus nee.
4. **Schaadt het AVG?** SUPER_ADMIN die foto's bekijkt = ja, dus nee.
5. **Is het een gast-rol op jouw niveau?** ADMIN die kwaliteitsborger uitnodigt = ja, dus mag.

Bij echte twijfel: **default = nee, vraag toestemming aan een laag hoger.**

---

## 10. Mapping op huidige code

> Stand: branch `docs/hierarchy-blueprint`, 2026-05-09. Hier staat wat al klopt en wat niet.

### ✅ Reeds aanwezig

| Rol uit dit document | Bestaat in `frontend/src/types/Auth.ts:1-10`? |
|---|---|
| ADMIN | ✅ |
| PROJECTLEIDER | ✅ |
| WERKVOORBEREIDER | ✅ |
| VOORMAN | ✅ |
| VAKMAN | ✅ |
| KWALITEITSBORGER | ✅ |
| OPDRACHTGEVER | ✅ |
| AANNEMER (legacy) | ✅ |
| ONDERAANNEMER (legacy) | ✅ |
| **SUPER_ADMIN** | ❌ — **toevoegen** |

### ⚠️ Wat afwijkt van dit document

| # | Code-locatie | Afwijking | Fix |
|---|---|---|---|
| 1 | `TeamBeheerScreen.tsx:320` | Nieuwe leden krijgen altijd `role: 'ONDERAANNEMER'` | Rol-selector toevoegen, gefilterd op `wat-mag-jij-uitnodigen` |
| 2 | `Auth.ts` | Geen `SUPER_ADMIN` rol | Toevoegen |
| 3 | `profiles` (Supabase) | Geen `invited_by` kolom | Migration: `add column invited_by uuid references profiles(id)` |
| 4 | RLS-policies | Geen "wie-mag-wie-uitnodigen" check | Policy toevoegen op `profiles` insert |
| 5 | `useWkbAuth.ts:94-105` | `enableDevBypass` zet hardcoded ADMIN | Gaten op `__DEV__` of weghalen |
| 6 | `JoinScreen.tsx:163` | Verwijst naar policy `invite_accept_update` die niet bestaat | Policy aanmaken in migration |

---

## 11. Roadmap — gefaseerde implementatie

### Fase 1 — Basis (sprint Mama-1)
- ☐ Voeg `SUPER_ADMIN` toe aan `Auth.ts`
- ☐ Voeg `invited_by` kolom toe op `profiles`
- ☐ Schrijf RLS-policy `invite_accept_update` (zoals JoinScreen verwacht)
- ☐ Bouw `/admin` route met read-only moederboard

### Fase 2 — Provisioning (sprint Mama-2)
- ☐ Edge Function `provision-tenant` (Supabase aanmaken via Management API)
- ☐ E-mail welkomst via Resend
- ☐ Migration-runner script

### Fase 3 — Bedrijfsinrichting (sprint Mama-3)
- ☐ Pagina "Bedrijfsinrichting" voor ADMIN
- ☐ Disciplines aan/uit (filtert overal in UI)
- ☐ Bedrijfstype-presets (loodgieter, aannemer, etc.)
- ☐ Telemetrie-tracker + hot/not-hot widget in moederboard

### Fase 4 — Permissies hardening
- ☐ RLS-policies "wie-mag-wie-uitnodigen" op `profiles`
- ☐ Frontend permission-helper `canInvite(currentRole, targetRole)`
- ☐ UI-knoppen tonen op basis van rol
- ☐ Audit-log tabel voor gevoelige acties

---

## 12. Glossarium

| Term | Betekenis |
|---|---|
| **Tenant** | Een klant van SpeeQ. Eén bedrijf = één tenant. Eigen Supabase-project. |
| **Key-user** | De ADMIN van een tenant. Eén persoon per bedrijf. Betaler. |
| **Discipline** | Vakgebied (Bouw, Installatie, Elektra, Bouwfysica, etc.) — bepaalt zichtbaarheid van borgingspunten. |
| **Borgingspunt** | Een Wkb-controlepunt dat met foto + GPS bewezen moet worden. |
| **Bewijs** | Een foto + metadata die een borgingspunt onderbouwt. |
| **Dossier** | Verzameling bewijzen + checklist + handtekeningen, ingediend bij gezag. |
| **KiK** | Kwaliteitsinformatie-Knooppunt — landelijk register voor Wkb-bewijzen. |
| **DSO** | Digitaal Stelsel Omgevingswet — Rijksoverheid-portaal. |

---

## 13. Wijzigingsgeschiedenis

| Versie | Datum | Wijziging | Door |
|---|---|---|---|
| 1.0 | 2026-05-09 | Initiële versie | Johnny + Claude |

> **Hoe wijzig je dit document?** Maak een aparte branch `docs/hierarchy-vN`, doe je wijziging, krijg akkoord, merge. Versie bovenin opbouwen, regel toevoegen aan deze tabel.
