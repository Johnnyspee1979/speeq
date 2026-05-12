# 03 — Maker-paneel handleiding

> Het `/maker` paneel is jouw klantenadministratie. Hier voeg je nieuwe klanten toe, kopieer je links en bewaak je status.

## Hoe je erin komt

URL: **https://speeq-wkb.vercel.app/maker**

Login:
- Email: `johnny@speesolutions.nl`
- Wachtwoord: je persoonlijke wachtwoord (je hebt 'm gereset via Supabase)

**Belangrijk:** alleen jij kunt erin. RLS in de master-DB checkt elke query tegen je e-mail. Een ander persoon die zou inloggen op de master-Supabase ziet de `tenants` tabel niet eens.

## Wat je ziet

```
┌──────────────────────────────────────────────────────────────┐
│  [SpeeQ logo]  Maker-paneel             [+ Klant toevoegen] [Uitloggen]
│                3 van 40 klanten · nog 37 plekken vrij        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ [BJ]     │  │ [PV]     │  │ [DB]     │                    │
│  │ Jansen   │  │ Peters   │  │ Demo BV  │                    │
│  │ jansen   │  │ peters   │  │ demo     │                    │
│  │ ACTIVE   │  │ ACTIVE   │  │ ACTIVE   │                    │
│  │          │  │          │  │          │                    │
│  │ Supabase:│  │ Supabase:│  │ Supabase:│                    │
│  │ jansen-* │  │ peters-* │  │ kgiuavf* │                    │
│  │          │  │          │  │          │                    │
│  │ [Open ▶] │  │ [Open ▶] │  │ [Open ▶] │                    │
│  │ [🔗 Link]│  │ [🔗 Link]│  │ [🔗 Link]│                    │
│  │ [✏️ Edit]│  │ [✏️ Edit]│  │ [✏️ Edit]│                    │
│  │ [🗑️]     │  │ [🗑️]     │  │ [🗑️]     │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Wat je kunt doen

### ➕ Klant toevoegen
Vereist info:
- **Bedrijfsnaam** (verplicht) — bv. "Bouwgroep Jansen"
- **Slug** (optioneel) — wordt automatisch afgeleid uit naam
- **Supabase URL** (verplicht) — uit klant's Supabase project
- **Anon key** (verplicht) — uit klant's Supabase project
- **Admin-mail** (optioneel) — hoofdcontact bij klant
- **Telefoon** (optioneel) — voor noodgevallen
- **Notities** (optioneel) — bv. "Eerste klant, gestart 12 mei"

### 🔧 Open als klant
- Schakelt jouw browser om naar die klant's Supabase
- Je ziet de tool zoals een klant 'm ziet
- Handig voor support of demo

### 🔗 Kopieer link
- Genereert `speeq-wkb.vercel.app/?t=<slug>`
- Komt op klembord
- Plak in mail/WhatsApp naar klant

### ✏️ Bewerk
- Pas naam, contact, of zelfs Supabase-credentials aan
- Handig als klant z'n Supabase-project verhuist

### 🗑️ Verwijderen
- Verwijdert ALLEEN de registry-entry uit jouw master
- De klant z'n Supabase-data blijft volledig intact
- Pas op: oude `?t=<slug>` link werkt daarna niet meer

## De 40-klant limiet

In `MakerDashboard.tsx` staat:
```typescript
const TENANT_LIMIT = 40;
```

Dit is geen technische limiet — de tool zou ook 400 of 4000 aankunnen. Het is een bewuste keuze omdat:
- Bij 40 klanten passen alle kaarten op één scherm
- Boven de 40 wil je waarschijnlijk groei via een eigen bedrijf in plaats van solo

Wijzigen kan in 1 regel als je dat moment bereikt.

## Veiligheid

### Wat is veilig
- ✅ Master-DB toegang alleen voor jouw e-mail (RLS)
- ✅ Geen Supabase-passwords in de tool — alleen anon keys (publieke keys)
- ✅ Service-role keys staan NOOIT in client-code — die heb je alleen lokaal nodig
- ✅ Tenants verwijderen wist nooit klantdata

### Wat is een risico
- ⚠️ Iemand die jouw maker-wachtwoord steelt kan klanten toevoegen/verwijderen
- ⚠️ Anon keys zijn publiek — alle beveiliging zit in Supabase RLS van de klant zelf

### Aanbevolen extra's
1. Zet 2-factor authentication aan op je Supabase-account
2. Bewaar database-passwords in 1Password / Bitwarden
3. Maak elke 6 maanden een database-export-backup van de master-tabel `tenants`

---

**Volgende doc:** [`04-klant-onboarding.md`](04-klant-onboarding.md) — wat de klant doet als hij de link opent.
