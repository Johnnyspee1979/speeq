# 04 — Klant onboarding flow

> Wat de klant ziet en doet, vanaf het moment dat jij de link verstuurt tot ze hun eerste foto maken.

## De volledige reis van een klant

```
1. Krijgt mail/WhatsApp van Johnny met link
   speeq-wkb.vercel.app/?t=jansen
        │
        ▼
2. Klikt link → tool laadt (1-2 sec)
   Onder water: tool praat met master, schakelt naar Jansen's Supabase
        │
        ▼
3. Login-scherm verschijnt (geen code 0987!)
   Optie A: Inloggen (heb je al account)
   Optie B: Account aanmaken (eerste keer)
        │
        ▼
4. Klant maakt account: mark@jansen.nl + sterk wachtwoord
        │
        ▼
5. Eerste login → ziet lege workspace
        │
        ▼
6. Tab Branding → upload logo + bedrijfsnaam
        │
        ▼
7. Tab Team → nodig collega's uit
        │
        ▼
8. Eerste project aanmaken → eerste foto → eerste dossier
```

## Wat zien ze precies, scherm voor scherm

### Scherm 1: Tenant login (na link)

```
┌─────────────────────────────────────────────────┐
│             [SpeeQ logo of Jansen logo]         │
│                                                 │
│              Welkom bij SpeeQ                   │
│              Bouwgroep Jansen                   │
│                                                 │
│  E-mail:     [_______________________]          │
│  Wachtwoord: [_______________________]          │
│                                                 │
│  [        Inloggen        ]                     │
│                                                 │
│  Nog geen account? → Account aanmaken           │
└─────────────────────────────────────────────────┘
```

### Scherm 2: Account aanmaken (eerste keer)

```
┌─────────────────────────────────────────────────┐
│              Account aanmaken                   │
│                                                 │
│  E-mail:     [mark@jansen.nl     ]              │
│  Wachtwoord: [********           ]              │
│  Bevestig:   [********           ]              │
│                                                 │
│  [        Maak account        ]                 │
│                                                 │
│  ← Terug naar inloggen                          │
└─────────────────────────────────────────────────┘
```

**Als e-mail-bevestiging AAN staat**: klant krijgt mail met link → moet klikken → daarna pas inloggen.
**Als e-mail-bevestiging UIT staat**: direct binnen, geen wachten.

### Scherm 3: Lege workspace (eerste keer)

```
┌────────────────────────────────────────────────────────┐
│  [Jansen logo]  Bouwgroep Jansen          [Mark ▼]     │
├────────────────────────────────────────────────────────┤
│  Camera | Dossier | Kaart | Team | Branding | Info     │
├────────────────────────────────────────────────────────┤
│                                                        │
│              Welkom, Mark!                             │
│                                                        │
│        Je hebt nog geen project.                       │
│        Begin met je workspace inrichten:               │
│                                                        │
│        1. Tab Branding → upload jullie logo            │
│        2. Tab Team → nodig collega's uit               │
│        3. Tab Camera → start eerste project            │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Rolverdeling binnen klant-team

| Rol | Wat mag deze persoon | Voor wie |
|---|---|---|
| **ADMIN** | Alles, ook andere admins maken | Eigenaar bouwbedrijf |
| **PROJECTLEIDER** | Projecten beheren, dossiers exporteren | Hoofduitvoerder |
| **WERKVOORBEREIDER** | Kwaliteitsdashboard, dossiers reviewen | Backoffice |
| **KEYUSER** | Team uitnodigen, branding aanpassen | Hoofdcontact klant |
| **VOORMAN** | Team aansturen op de bouwplaats | Voorman per project |
| **VAKMAN** | Camera + eigen dossier | Bouwvakkers |
| **OPDRACHTGEVER** | Alleen-lezen portaal | Klant van de klant |
| **KWALITEITSBORGER** | Externe inspecteur | Onafhankelijke borger |

De **eerste persoon** die een account aanmaakt wordt automatisch **ADMIN** (via Supabase trigger). Hij kan vervolgens collega's met andere rollen uitnodigen.

## Team uitnodigen — hoe het echt werkt

Geen e-mail-server nodig. Het werkt via **share-links**:

```
1. KeyUser opent Team-tab
2. Vult in: naam, e-mail, rol, project
3. Klikt "Toevoegen"
4. Profile-row wordt aangemaakt met invite_token
5. KeyUser klikt 🔗 Kopieer link
   → krijgt: speeq-wkb.vercel.app/?join=<token>
6. KeyUser plakt link in mail/WhatsApp naar collega
7. Collega opent link → JoinScreen
   → kiest e-mail + wachtwoord (zoals klant zelf eerder deed)
8. Account wordt gekoppeld aan de gereserveerde profile-row
9. Collega is binnen, in zijn eigen rol
```

### Waarom geen e-mail-server?
- **Eenvoud**: geen SMTP-config, geen mail-bounces, geen spam-filters
- **WhatsApp wint**: 95% van de bouwvakkers krijgt collega-uitnodigingen via WhatsApp, niet mail
- **Controle**: KeyUser ziet welke uitnodigingen open staan en kan zelf opnieuw delen

## Wat als klant z'n wachtwoord vergeet?

Klant zelf:
1. Op login-scherm → "Wachtwoord vergeten?" (TODO: nog te bouwen knop)
2. Krijgt Supabase recovery-mail
3. Klikt link → kiest nieuw wachtwoord

Jij als maker (noodgeval):
1. Open Supabase project van die klant
2. Auth → Users → zoek mailadres → "Send password recovery"

## Mobiele installatie (PWA)

Op telefoon (iOS Safari):
1. Open speeq-wkb.vercel.app/?t=jansen
2. Login (zoals normaal)
3. Tik op deel-icoon onderin
4. Kies **"Zet op beginscherm"**
5. Geef naam (default: SpeeQ WKB) → toevoegen
6. SpeeQ icoon verschijnt op beginscherm
7. Open vanaf icoon → fullscreen, voelt als echte app

Op telefoon (Android Chrome):
1. Open speeq-wkb.vercel.app/?t=jansen
2. Login
3. Chrome popup: "App toevoegen aan startscherm?" → JA
4. Of menu rechtsboven → "App installeren"

---

**Volgende doc:** [`05-deploy-vercel.md`](05-deploy-vercel.md) — hoe wijzigingen live komen.
