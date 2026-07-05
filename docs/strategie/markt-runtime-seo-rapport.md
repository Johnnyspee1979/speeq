# Markt, Runtime & SEO Rapport — SpeeQ

> **Status:** v1.0 — strategische beoordeling vóór klant #1
> **Datum:** 14 mei 2026
> **Voor:** Johnny Spee, Spee Solutions

> **⚠️ Historisch prijsdeel (besluit juli 2026).** De prijs- en marge-tabellen in dit rapport (€149 Team / €299 Pro / €899 Enterprise) horen bij de mei-analyse. Het geldende model: 30 dagen gratis proefproject → **Basis €299/mnd of €2.990/jr** → **Professional €599/mnd of €5.990/jr** → **Enterprise op maat via contact**; Solo/Team en €899 zijn vervallen. Zie `docs/VERKOOP-ANALYSE.md` §4. De cijfers hieronder blijven als beslissingshistorie staan.

---

## 1. Korte beoordeling — waar staan we nu

| Onderdeel | Status | Oordeel |
|---|---|---|
| Brand-systeem | ✅ Klaar (logo, kleuren, fonts, voice) | Solide, premium-uitstraling |
| Juridisch pack (4 PDFs) | ✅ Branded, klaar voor klant | Professioneel |
| Marketing-1-pager | ✅ HTML bijgewerkt (€149/€299/€899) | PDF moet hergerenderd worden |
| LinkedIn-templates (6×) | ✅ HTML bijgewerkt naar speesolutions.com/speeq | PNG's moeten hergerenderd worden |
| App-architectuur (multi-tenant) | ✅ Gebouwd: eigen Supabase per klant | USP is technisch klaar |
| Sprint 1 plan (annotatie + i18n) | ✅ Stappenplan klaar, niet uitgevoerd | Volgende sprint |
| Onboarding-plan (50 beslissingen) | ✅ Vastgelegd | Klaar als blauwdruk |
| NotebookLM-videoprompt | ✅ Klaar voor gebruik | Wachten op render |
| Landingpage `speesolutions.com/speeq` | ❌ Niet gebouwd | **Hoogste prioriteit** |
| Live web-app `app.speesolutions.com` | ❌ Niet gedeployed | **Hoogste prioriteit** |
| Provisioning-script | ❌ Niet geschreven | Bij klant #1 |
| TloKB-erkenning | ❌ Niet besloten | **Strategische bottleneck** |
| Eerste betalende klant | ❌ 0 — concept-mails klaar (Abdel/Marcel/Comcivo) | Deze week starten |

**Eindoordeel:** je hebt een sterke fundering (technisch + brand + plan) maar **0 zichtbare aanwezigheid online** en **0 omzet**. De volgende 2 weken bepalen alles.

---

## 2. Markt — Wkb in Nederland 2026

### Marktomvang

| Indicator | Cijfer |
|---|---|
| Wkb verplicht sinds | 1 januari 2024 (Gevolgklasse 1, nieuwbouw) |
| Wkb voor verbouw | Uitgesteld, politiek besluit pending |
| Bouwmeldingen GK1 in 2025 | ~5.126 |
| Bouwbedrijven NL totaal | 126.000 – 275.000 (afhankelijk van bron) |
| Bedrijven 5-50 medewerkers (doelgroep) | 15.000 – 20.000 |
| Geografische top-3 | Z-Holland 27%, N-Holland 18%, N-Brabant 15% |
| **Adresseerbare markt SpeeQ** | **2.000 – 4.000 MKB-aannemers met GK1-projecten** |

### Strategische conclusie

- Markt is **niet groot** in volume (5k meldingen/jaar) maar wel **geconcentreerd** in Zuid-Holland
- Wkb-verbouw is groei-trigger — als die doorzet, 3-5× markt
- Den Haag = epicentrum van doelgroep, **jouw geografisch voordeel**

---

## 3. Concurrentie — wie doet wat

| Tool | Prijs/mnd | Doelgroep | Sterk in | Zwak in |
|---|---|---|---|---|
| **Vastlegg.nl** | €29,95 instap | ZZP / klein | All-in-one (uren, factuur, Wkb) | Geen TloKB-instrument, ZZP-focus |
| **Ed Controls** | €59-82/user of €127-286/project | MKB tot groot | GPS, 130+ checklists, 30-dgn proef | Per-user prijs schaalt slecht, gedeelde DB |
| **BKapp.nl** | Op aanvraag | Aannemer + kwaliteitsborger | TloKB-gekoppeld, "60% tijdsbesparing" | Prijs verborgen, B2B-zwaar |
| **STA Software** | Op aanvraag | Middelgroot+ B&U | 35 jaar bouw-ervaring, modulair | Geen publieke prijs, enterprise-uitstraling |
| **4PS / Admicom** | ERP-bundel | ERP-georiënteerd | Volledig geïntegreerd | Te zwaar voor 5-50 medewerkers |

### Waar SpeeQ écht uniek is

| Feature | SpeeQ | STA | Vastlegg | BKapp | Ed Controls |
|---|---|---|---|---|---|
| **Eigen Supabase per klant** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI-statuscheck op foto** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Weerdata bij elke foto (KNMI)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Geo-tag + radius-check** | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| **Tekening-annotatie (Sprint 1)** | 🟡 | ✅ | ❌ | ⚠️ | ✅ |
| **TloKB-erkend instrument** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Heldere prijspagina** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Per-klant eigen branding** | ✅ | ❌ | ❌ | ❌ | ⚠️ |

⚠️ = beperkt / niet primair · 🟡 = in planning

### Belangrijkste insight (van marktonderzoek)

> **TloKB-erkenning is de échte bottleneck.** Slechts 7 instrumenten erkend in NL (mrt 2025). Zonder erkenning is SpeeQ technisch een **hulp-tool** die naast een erkend instrument wordt gebruikt — geen vervanger. BKapp + Vastlegg hebben dit voordeel.

**Strategische keuze (kritiek):**
- **A.** Partner-met-erkenning: gebruik BKapp-instrument onder de motorkap, SpeeQ als premium UI/UX-laag
- **B.** Eigen TloKB-aanvraag: ~€5k-€15k + 12-18 maanden traject
- **C.** Negeren: SpeeQ als hulp-tool, klant koppelt zelf aan erkend instrument

→ **Mijn advies: A nu (snel live), B starten op de achtergrond voor onafhankelijkheid in 2027.**

---

## 4. Pricing-realiteitscheck

| Tier | Marktprijs | SpeeQ | Verdict |
|---|---|---|---|
| ZZP/instap | €30 (Vastlegg) | — | Niet jouw markt |
| MKB-mid | €59-82/user (Ed Controls) | €149 Team (5 users = €30/user effectief) | **64% goedkoper dan Ed Controls 5-user (€410)** ✅ |
| MKB-pro | €127-286/project (Ed Controls) | €299 Pro | **Onder Ed Controls Power-tier, mét eigen DB** ✅ |
| Enterprise | €250+ (Ed Controls add-ons) | €899+ | Premium — eigen DB + dedicated support rechtvaardigen dit |

**Verdict:** prijzen kloppen — wij bieden méér voor minder (Team €149 met eigen DB vs Ed Controls €410 zonder eigen DB). €899 Enterprise rechtvaardigt zich door dedicated support + TloKB-pad in voorbereiding.

---

## 5. Maandelijkse runtime-kosten

### A. Vaste kosten Spee Solutions (alle klanten samen)

| Item | €/maand | Verplicht |
|---|---|---|
| Vercel Pro (web hosting) | 18 | ✅ |
| Resend (transactionele mail, 10k stuks) | 15 | ✅ |
| Domain speesolutions.com (€12/jr) | 1 | ✅ |
| Google Workspace johnny@speesolutions.com | 6 | ✅ |
| UptimeRobot (status-monitoring) | 0 | Gratis tier |
| Calendly (demo-bookings) | 0 | Gratis tier |
| GitHub (private repos) | 0 | Gratis tier |
| NotebookLM (video/audio) | 0 | Gratis |
| Adobe Creative Cloud Pro (al actief) | 60 | Bestaand |
| **Subtotaal verplicht** | **100** | |
| Adobe (al lopende kosten) | 60 | |
| **Totaal Spee Solutions vast** | **~€160/maand** | |

### B. Variabele kosten per klant

| Item | €/maand per klant | Detail |
|---|---|---|
| Supabase Pro (eigen project) | 23 | $25/maand, Frankfurt |
| Mollie incasso (3% van abonnement) | 3-21 | Afhankelijk van pakket |
| **Totaal per klant** | **€26 (Team) tot €44 (Enterprise)** | |

### C. Marge per klant

| Pakket | Prijs | Kosten | Marge/maand |
|---|---|---|---|
| Team | €149 | €26 | **€123** |
| Pro | €299 | €32 | **€267** |
| Enterprise | €899 | €50 | **€849** |

### D. Break-even & schaal-scenario's

| Scenario | Klanten | Maand-omzet | Maand-marge | Resultaat na vaste kosten |
|---|---|---|---|---|
| Start | 3× founder (Pro voor Team-prijs = €149) | €447 | €369 | **€209/mnd winst vanaf dag 1** |
| Conservatief | 5× Team | €745 | €615 | **€455/mnd winst** |
| Realistisch (6 mnd) | 10 gemixt (5T/4P/1E) | €2.844 | €2.464 | **€2.304/mnd winst** |
| Ambitieus (12 mnd) | 25 gemixt (10T/12P/3E) | €7.757 | €6.731 | **€6.571/mnd winst** |

### E. Eénmalige kosten (komende 6 maanden)

| Item | € éénmalig |
|---|---|
| Apple Developer Account (jaar) | 92 |
| Google Play Console | 23 |
| TloKB-aanvraag (optie B) | 5.000 - 15.000 |
| Eventuele juridische check AV door advocaat | 500 - 1.500 |
| **Totaal minimaal** | **~115** |
| **Totaal inclusief TloKB** | **5.000 - 16.500** |

---

## 6. SEO-strategie voor `speesolutions.com/speeq`

### Doelwoorden (geprioriteerd)

| # | Woord | Volume/mnd (NL) | Moeilijkheid | Strategie |
|---|---|---|---|---|
| 1 | wkb software | hoog | hoog | hoofdpagina-focus |
| 2 | wkb tool | hoog | middel | landingpage |
| 3 | borgingstool aannemer | laag | laag | **quick win — onbenut** |
| 4 | wkb-dossier automatisch | laag | laag | **quick win** |
| 5 | wkb tool zuid-holland | laag | laag | **regio-pagina — niemand claimt** |
| 6 | ai kwaliteitsborging | laag | laag | **niche unique** |
| 7 | wkb voor aannemer mkb | middel | laag | long-tail |
| 8 | eigen database wkb | laag | laag | **USP-pagina** |
| 9 | weer-data bouwcontrole | laag | laag | **uniek concept** |
| 10 | wkb checklist | hoog | middel | blog-content |

### Site-structuur

```
speesolutions.com/
├── /speeq                       — hoofdpagina (USP + demo + pricing + CTA)
├── /speeq/wkb-uitleg           — wat is Wkb? (educatief, top-of-funnel)
├── /speeq/zuid-holland         — regio-pagina (lokaal SEO)
├── /speeq/vergelijken          — SpeeQ vs STA/Vastlegg/BKapp (eerlijk)
├── /speeq/eigen-database       — diepe USP-uitleg
├── /speeq/pricing              — Basis €299 / Professional €599 / Enterprise op maat
├── /speeq/help                 — FAQ + onboarding
└── /blog                       — 1× per week 800-1500 woorden
```

### Content-kalender — eerste 12 weken

| Week | Blog-titel | Doelwoord |
|---|---|---|
| 1 | "Wkb-borgingsdossier in 10 minuten klaar — zo doe je dat" | wkb-dossier automatisch |
| 2 | "Waarom je eigen database belangrijk is voor je bouwbedrijf" | eigen database wkb |
| 3 | "AI in de bouw: hype of hulp? Een eerlijke kijk" | ai kwaliteitsborging |
| 4 | "Verbouw onder Wkb — wat staat eraan te komen in 2026?" | wkb verbouw |
| 5 | "Wkb-checklist 2026: 12 controlemomenten op de bouwplaats" | wkb checklist |
| 6 | "STA, Vastlegg, BKapp of SpeeQ? Eerlijk vergelijk" | wkb software vergelijken |
| 7 | "Weerdata bij elke foto: waarom dat juridisch belangrijk is" | weer-data bouwcontrole |
| 8 | "Wkb-tool voor de eenmanszaak — past het bij jou?" | wkb tool eenmanszaak |
| 9 | "Zuid-Holland en de Wkb: lokaal werken, slim documenteren" | wkb zuid-holland |
| 10 | "5 vragen die je elke aannemer moet stellen vóór een Wkb-tool kiezen" | wkb tool kiezen |
| 11 | "Wat doet een kwaliteitsborger eigenlijk?" | kwaliteitsborger uitleg |
| 12 | "Case study: een verbouwing in Wassenaar met SpeeQ" | case study wkb |

### Technische SEO-vereisten

- ✅ Open Graph + Twitter Cards op elke pagina
- ✅ Structured data (`SoftwareApplication` + `Organization`)
- ✅ Sitemap.xml automatisch via Next.js
- ✅ Robots.txt met Google + Bing toegestaan
- ✅ HTTPS (al via Vercel)
- ✅ PageSpeed 90+ (Vercel/Next.js standaard)
- ✅ Hreflang `nl-NL` (later `en-NL` als i18n live is)
- ✅ Schema voor pricing (`Offer` markup)

### Linkbuilding-acties (maand 1-3)

| Actie | Doel | Geschatte kosten |
|---|---|---|
| Aanmelden bij Bouwend Nederland tool-vergelijking | Backlink + zichtbaarheid | €0 |
| Partner-artikel bij Aannemervak.nl | DA70+ backlink | €500-€1.500 |
| Persbericht aan Cobouw.nl over AI+weer-USP | Bouwnieuws-coverage | €0 (organisch) |
| Opinie-stuk bij KOMO/Bouwregelgeving | Thought leadership | €0 |
| Gastblog op Vastgoed BS | Bouw-vakpubliek | €0 |
| LinkedIn-content (2× per week) | Persoonlijk netwerk + DA | €0 |

### SEO-tooling kosten

| Tool | €/mnd | Verplicht? |
|---|---|---|
| Google Search Console | 0 | ✅ |
| Google Analytics 4 | 0 | ✅ |
| Bing Webmaster Tools | 0 | aanrader |
| Ahrefs / SEMrush | 99-199 | optioneel, vanaf maand 3 |
| Surfer SEO (content optimalisatie) | 89 | optioneel |

**Aanrader v1:** alleen Search Console + Analytics. Pas vanaf maand 3 een Ahrefs-abonnement als je écht zichtbaar wil schalen.

---

## 7. Mogelijkheden — wat kan de markt bieden

| Kans | Hoe groot | Wanneer |
|---|---|---|
| **Wkb-verbouw treedt in werking** | 3-5× marktgroei | Politiek besluit 2026/2027 |
| **TloKB-erkenning binnenhalen** | Premium-positie verstevigen | 12-18 maanden traject |
| **DSO-integratie** (Digitaal Stelsel Omgevingswet) | Wettelijke koppeling met gemeenten | Reeds onderzocht (zie `DSO-Integratie.md`) |
| **Internationaliseren (DE)** | Duitse Bauleitplanung — vergelijkbaar | 2027+, na NL-succes |
| **Partnership met bouwbond / VvE-vereniging** | Bulk-deals via brancheorganisatie | 6-12 maanden |
| **White-label voor kwaliteitsborgers** | Borger biedt SpeeQ aan aan zijn klanten | Pro+ tier doel |

---

## 8. Risico-flags (samengevat)

| Risico | Impact | Mitigatie |
|---|---|---|
| **TloKB-erkenning ontbreekt** | Hoog — beperkt USP-claim | Partner-route NU, eigen aanvraag op achtergrond |
| **Wkb-verbouw blijft uitgesteld** | Middel — marktgroei stagneert | Plan B: focus op nieuwbouw + verbouw-vroeg-aanmelden |
| **Vastlegg duwt onderkant naar €30** | Middel — prijsdruk | Premium-positie vasthouden, niet zakken |
| **ERP-vendors bundelen gratis** | Laag — andere doelgroep | Focus op niet-ERP-aannemers |
| **Solo founder (jij) — single point of failure** | Hoog | Bij klant #5: ZZP-back-up regelen |
| **0 klanten nu — geen revenue** | Hoog | Abdel-mail vandaag, Marcel vrijdag, Comcivo maandag |

---

## 9. De 3 belangrijkste acties — deze maand

### 1. Live krijgen (komende 2 weken)

- ✅ Marketing-materialen verbouwd (speeq.nl → speesolutions.com/speeq, prijzen €149/€299/€899)
- `speesolutions.com/speeq` landingpage live op Vercel
- `app.speesolutions.com` MVP live (login + workspace)
- 3 founder-mails verzenden (Abdel vandaag → Marcel vr → Comcivo ma)

### 2. TloKB-strategie kiezen (deze week)

- Bel iemand bij TloKB voor procedure-kosten/tijdlijn
- Mail BKapp/erkend instrument voor partner-gesprek
- Maak beslissing: partner (A) of eigen aanvraag (B) of negeren (C)

### 3. SEO-fundering (komende 2 weken)

- 3 eerste blog-posts schrijven (week 1-3 uit kalender)
- Search Console + Analytics aanzetten
- Aanmelden bij Bouwend Nederland tool-vergelijking
- LinkedIn-posts inplannen (di + do 09:00)

---

## 10. Verdict in één regel

> **Je hebt alle voorbereidingen op orde. Wat ontbreekt is: live aanwezigheid + eerste klant + TloKB-beslissing. Doe deze 3 dingen binnen 2 weken, dan ben je echt een speler in de markt.**

---

## Bronnen marktonderzoek

- Rijksoverheid Wkb
- TloKB-register
- STA Software prijzen
- BKapp tarieven
- Vastlegg.nl features
- Ed Controls prijzen
- CBS MKB-cijfers 2024
- Bouwend Nederland Wkb-softwarevergelijking
- CompanyData bouwsector

---

*Versie 1.0 · 2026-05-14 · Spee Solutions*
*Volgende update: na 2 weken — wat is gelukt, wat moet anders*
