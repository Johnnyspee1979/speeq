# Klant-Onboarding Plan — SpeeQ

> **Status:** v1.0 — beslissingen vastgelegd, klaar voor uitvoering
> **Datum:** 14 mei 2026
> **Eigenaar:** Johnny Spee
> **Scope:** Hoe een klant van eerste contact tot werkende workspace komt

---

## 1. De grote beslissingen (alles op één plek)

### Merk & domein

| Onderdeel | Beslissing |
|---|---|
| Eigen merk-domein voor SpeeQ? | **Nee.** Alle `speeq.nl/com/app/io` zijn bezet |
| Product-pagina | `speesolutions.com/speeq` |
| Web-app voor klanten | `app.speesolutions.com` |
| Status-pagina | `status.speesolutions.com` (privé, in-app voor klanten) |
| Mail | `johnny@speesolutions.com` |
| Help-pagina | `speesolutions.com/speeq/help` |

### Pricing (definitief)

| Pakket | Prijs | Projecten | Branding | Support |
|---|---|---|---|---|
| **Basis** | €299/mnd of €2.990/jr | 5 actief, tot 10 app-gebruikers | SpeeQ + klant-logo | mail |
| **Professional** | €599/mnd of €5.990/jr | 25 actief + KiK/ERP zodra live | volledig eigen branding | mail + telefoon |
| **Enterprise** | op maat, via contact | onbeperkt | custom + SLA | dedicated |

**Founder-deal (eerste 10 klanten):** 12 maanden Basis à €149/mnd i.p.v. €299, in ruil voor testimonial + logo.

**Geen instap-tier onder €299** — premium-positionering, instap is Basis. Concurrenten (STA/Vastlegg/BKapp) zitten lager, maar zonder eigen database per klant.

### Architectuur

| Onderdeel | Beslissing |
|---|---|
| Database-isolatie | Eigen Supabase-project per klant (Frankfurt, EU) |
| Tenant-routing | Klant intoetst tenant-code op `app.speesolutions.com` |
| Subdomain per klant (`comcivo.app.speesolutions.com`) | Nog niet — bij klant #5 evalueren |
| Data-residency | Frankfurt (Supabase) |
| Backup | Supabase auto-dagelijks, 7 dagen retentie (Pro plan inbegrepen) |
| SLA | Geen formele SLA — "best effort" (te herzien bij Professional/Enterprise) |
| Audit-trail | Volledig (BRL-conform) — elke wijziging gelogd |
| 2FA | Optioneel per user |

### Login & flow

| Onderdeel | Beslissing |
|---|---|
| Primaire login-methode | Magic-link via mail (geen wachtwoord nodig) |
| Wachtwoord-optie | Klant kan in instellingen alsnog wachtwoord instellen |
| Wachtwoord-reset | Klant mailt jou → jij reset (v1) → bij klant #5: zelfbediening |
| Tenant-code | Eénmalig intoetsen, daarna onthouden in browser/app |

### Onboarding-flow (5 stappen)

```
LEAD
  ↓
LinkedIn / cold-mail (jij stuurt 1-pager)
  ↓
DEMO-CALL (20 min Zoom, jij toont app)
  ↓
TRIAL START (jij maakt workspace handmatig — 30 min)
  ↓ 30 dagen volledige Basis-toegang gratis
TRIAL EIND
  ↓
Geen actie van klant = automatische conversie naar 12 maanden Basis
(5 dagen vooraf: 5 mails + 5 in-app popups als waarschuwing)
```

### Per-klant Supabase: wat & waarom uitleggen

Tekst voor 1-pager, landingpage en welkomstmail:

> Waar andere aanbieders uw data laten staan in een gedeelde Postgres-tabel
> met al hun klanten, bieden wij een compleet ontzorgingspakket: een eigen
> Supabase-database in Frankfurt, **alleen voor uw bedrijf, alleen door u
> in te kijken**. Inbegrepen in de abonnementsprijs — geen verborgen
> kosten, geen "data-storage extra". Altijd automatisch veilig en
> georganiseerd.

### Eerste scherm na login

Combinatie: leeg dashboard mét één voorbeeld-project ("Demo Verbouwing Wassenaar") dat alle modules toont. Verwijderen = 1 klik.

### Welkomstmail-pakket

Per nieuwe keyuser:
1. Link `app.speesolutions.com` + tenant-code (uniek per klant)
2. Magic-link voor eerste login
3. Telefoonnummer Johnny + WhatsApp
4. Link naar 5-min onboarding-video
5. PDF **"Eerste 7 dagen in SpeeQ"** (dag-voor-dag stappen)

### Branding klant → in app + in PDF-dossier

| Optie | Inbegrepen vanaf |
|---|---|
| Klant upload eigen logo in instellingen | Alle pakketten verplicht |
| Klant kiest tussen "alleen SpeeQ-branding" of "eigen branding" | Professional+ |
| Klant verbergt SpeeQ helemaal (white-label) | Enterprise |

### Users binnen klant-workspace

| Wie | Wat |
|---|---|
| Keyuser | Door klant zelf aangewezen, jij maakt eerste login |
| Extra users | Keyuser nodigt uit via mail-invite |
| Plafond bereikt | In-app popup: "Pakket-upgrade nodig — akkoord?" → klant klikt → abonnement +1 tier |
| Verloop | Klant geheel vrij — wel popup bij te lang inactieve users |

### Sales-funnel

```
Lead (LinkedIn/cold-mail)
  ↓
Demo-call (20-30 min, jij toont)
  ↓
Trial-start (30 dagen, Basis-toegang)
  ↓
Trial-eind → auto-conversie 12 mnd Basis
```

Geen tussenstap "offerte" — pricing is publiek op landingpage, transparant.

### Trial-conversie (juridisch correct)

- Bij signup verplicht vinkje: *"Ik begrijp dat na 30 dagen trial automatisch een 12-maanden Basis-abonnement à €299/mnd ingaat, tenzij ik vóór dag 25 opzeg."*
- 5 dagen vooraf: dagelijks 1 mail + 1 in-app popup
- Wel-vink = bewijsmateriaal in audit-log
- Vermeld duidelijk in algemene voorwaarden
- **B2B mag stilzwijgende verlenging** — consument-regels gelden niet

### Bij opzegging / einde contract

- Klant kan in app zelf alle dossiers exporteren als ZIP **tot 30 dagen na opzeg**
- Daarna: Supabase-project pauzeert → 90 dagen retentie → automatisch verwijderd
- Klant krijgt 3 herinneringen vóór definitieve verwijdering

### Notificaties (klant-instelbaar)

| Kanaal | Wat |
|---|---|
| In-app | Realtime (foto geüpload, dossier klaar, deadline) |
| Mail | Klant kiest: alle / alleen kritiek / dagelijkse samenvatting / wekelijks |
| SMS | Alleen voor kritieke deadlines (Professional+) |

### Tools & integraties

| Onderdeel | Tool | Kosten |
|---|---|---|
| Betalingen | Mollie (automatische incasso) | 1,8% + €0,25 |
| Mail-versturen | Resend / Postmark | €15/mnd |
| Demo-bookings | Calendly (free tier) | €0 |
| Status-pagina | UptimeRobot | €0 (gratis tier) |
| Help-center v1 | Statische pagina in Vercel-deploy | €0 |
| Help-center v3 (vanaf 20 klanten) | HelpScout | €20/mnd |

### Communicatie & marketing

| Touchpoint | Beslissing |
|---|---|
| Eerste contact | LinkedIn + cold-mail (zelfde funnel) |
| Demo-video | 2 versies: 30 sec op landingpage + 2 min in welkomstmail (zelf opnemen met QuickTime) |
| Audio-podcast | NotebookLM-prompt klaar (zie sectie 5) |
| Klant-feedback | "Stuur feedback"-knop in app + maandelijkse NPS-enquête |
| Nieuwe klant vieren | LinkedIn-post + handgeschreven kaart naar bedrijf |
| Sprint-ritme | Elke 6 weken nieuwe features, kritieke fixes direct |

### Talen

| Fase | Talen |
|---|---|
| Launch (v1) | NL + EN (i18n-structuur al klaar — zie Sprint 1 plan) |
| Vanaf 10 klanten | DE erbij (Duitse markt) |

### Mobiel-strategie

| Fase | Wat |
|---|---|
| Nu | PWA op `app.speesolutions.com` — werkt op iOS 16.4+ en Android |
| Vanaf klant #3 | Apple Developer + Google Play Console aanvragen |
| Vanaf klant #5 | Native apps via Expo EAS Build → TestFlight → stores |

### Kickoff-call schaalplan

| Klanten | Wie | Hoe |
|---|---|---|
| 1–10 | Johnny | 30 min Zoom, gratis |
| 10–30 | Johnny + opname-bibliotheek | Live of zelfstandig via in-app video-academy |
| 30+ | ZZP onboarder (€2k/mnd) | Hij doet kickoffs, jij keynote-call op verzoek |

---

## 2. Bouwlijst — wat moet er gemaakt worden

### A. Marketing & landingpage (1 week)

- [ ] `speesolutions.com/speeq` landingpage maken (hero + video achter knop + USP-blok + pricing + CTA)
- [ ] 30-sec demo-video opnemen (QuickTime + jouw stem, in app)
- [ ] 2-min onboarding-video opnemen (zelfde stijl, dieper)
- [ ] FAQ-pagina `speesolutions.com/speeq/help` (10 vragen + antwoorden)
- [x] **Alle bestaande marketing-materialen verbouwd:** speeq.nl → speesolutions.com/speeq
  - `docs/marketing/pdf/1pager.html` + PDF herrenderen
  - 6× LinkedIn templates (banner + 5 posts) herrenderen
  - `docs/marketing/verzonden/concept-01-abdel.md` aanpassen
  - Juridische PDF's footer-tekst checken
- [x] **Prijzen aanpassen in alle materialen:** definitief Basis €299 / Professional €599 / Enterprise op maat (besluit juli 2026)

### B. Auth & tenant (2 weken)

- [ ] Magic-link login implementeren (Supabase Auth heeft dit, schakelen)
- [ ] Tenant-code intoetsen-scherm verbeteren (UX-check)
- [ ] In-app wachtwoord-instellen voor wie dat wil (optioneel)
- [ ] 2FA-flow (optioneel per user)
- [ ] Wachtwoord-reset-flow: v1 = mail naar Johnny, v2 = self-service

### C. Provisioning-script (3 dagen)

Doel: nieuwe klant in 5 min in plaats van 30.

- [ ] CLI-script `scripts/provision-klant.sh`:
  - Maakt nieuw Supabase-project via API
  - Runt alle migrations
  - Maakt admin-user aan
  - Genereert tenant-code
  - Stuurt welkomstmail met magic-link + tenant-code

### D. Onboarding-flow in app (1 week)

- [ ] Eerste-login-detectie: toon welkomst-wizard
- [ ] Voorbeeld-project "Demo Verbouwing Wassenaar" auto-aanmaken
- [ ] In-app vraagteken-knop (v2 — niet nu)
- [ ] Logo-upload verplicht in instellingen bij eerste sessie

### E. Trial & billing (2 weken)

- [ ] Mollie-integratie + recurring incasso
- [ ] Vinkje juridisch correct bij signup (audit-log)
- [ ] Trial-teller (30 dagen) + 5-dagen-vooraf-waarschuwing
- [ ] Auto-conversie-flow naar 12 mnd contract
- [ ] In-app upgrade-popup bij users-plafond

### F. Notificaties (1 week)

- [ ] Mail-templates (Resend/Postmark): welkom, trial-waarschuwing, conversie, factuur, deadline
- [ ] In-app realtime notificaties
- [ ] Klant-instellingen voor mail-frequentie

### G. Audit & data-export (3 dagen)

- [ ] `audit_log` tabel + triggers op key-tabellen
- [ ] Export-functie: alle data als ZIP downloaden
- [ ] 30-dagen-retentie na opzeg

### H. Status & support (2 dagen)

- [ ] UptimeRobot configureren op `app.speesolutions.com`
- [ ] Status-widget in app (klant-only)
- [ ] `support@speesolutions.com` mail-alias

---

## 3. Volgorde & tijdsplanning

| Fase | Wat | Wanneer | Klant-impact |
|---|---|---|---|
| **0. Cleanup** | Marketing materialen aanpassen (domein + prijs) | Vandaag-morgen | Abdel-mail kan dan correct uit |
| **1. MVP-launch** | A + B + C + D | Mei-juni 2026 | Founder-klanten kunnen instappen |
| **2. Commerce** | E + F | Juli 2026 | Eerste auto-conversie loopt |
| **3. Schaal** | G + H + native apps | Aug-sep 2026 | Volwaardig product |

---

## 4. Open risico's & beslissingen

| Punt | Risico | Mitigatie |
|---|---|---|
| Status-pagina privé (Q38=b) | Bij outage kan klant niet inloggen om status te zien | Bij Professional+ ook publieke status overwegen |
| Wachtwoord-reset handmatig (Q35=c) | Jij ziek/weekend = klant kan niet inloggen | Magic-link is primair — reset is edge-case |
| Geen SLA (Q34=c) | Professional/Enterprise kunnen contract eisen | Bij Enterprise: SLA toevoegen tegen meerprijs |
| Solo afgeschaft | Verlies kleine eenmanszaken | Bewust — premium-positie |
| Hele bedrijfsdata in handen van 1 persoon | Bij ziekte Johnny: continuïteit? | Bij klant #5: ZZP-back-up regelen |

---

## 5. NotebookLM-prompt voor demo-podcast

```
Maak een 5-minuten podcast tussen 2 hosts die SpeeQ bespreken,
de nieuwe Wkb-borgingstool van Spee Solutions.

Bronnen: SpeeQ-1pager.pdf + algemene-voorwaarden.pdf

Toon: rustig, no-nonsense, Nederlands. Geen hype-woorden zoals
"revolutionair" of "game-changer".

Structuur:
1. (0:00) Wat is Wkb en waarom is dit belangrijk voor aannemers?
2. (1:00) Wat doen STA/Vastlegg/BKapp en wat is het verschil?
3. (2:30) SpeeQ's USP: eigen Supabase-database in Frankfurt — wat
   betekent dat in de praktijk?
4. (3:30) Voor wie is dit: middelgroot tot premium aannemersbedrijf
   met 5–50 medewerkers.
5. (4:30) Hoe begin je: founder-deal, 30 dagen trial, kickoff-call
   met Johnny Spee persoonlijk.

Eindig met: "Meer info op speesolutions.com/speeq."

Geen muziek-suggesties, geen overdreven enthousiasme. Twee Nederlandse
hosts die elkaar serieus de vraag stellen.
```

---

## 6. Eerstvolgende acties (deze week)

| # | Wat | Wanneer | Door |
|---|---|---|---|
| 1 | Marketing-materialen verbouwen (domein + prijs) | Vandaag-morgen | Claude |
| 2 | Concept-mail Abdel aanpassen, verzenden | Vandaag 16:00 | Johnny |
| 3 | Concept-mail Marcel personaliseren | Vrijdag 09:00 | Johnny |
| 4 | Concept-mail Comcivo personaliseren | Maandag 09:00 | Johnny |
| 5 | Provisioning-script bouwen | Volgende week | Claude |
| 6 | Landingpage `/speeq` ontwerpen | Volgende week | Claude + Johnny |
| 7 | Demo-video opnemen (QuickTime) | Week 21 | Johnny |

---

*Versie 1.0 · 2026-05-14 · Spee Solutions*
*Volgende update: na klant #1 — wat werkte, wat moet veranderen*
