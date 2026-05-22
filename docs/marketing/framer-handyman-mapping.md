# Framer Handyman-template → SpeeQ mapping

> **Wat dit is:** complete vertaaltabel om de Handyman-template in jouw Framer-project ("Handyman-copy") om te bouwen tot de SpeeQ-landing — content + kleuren + fonts.
> **Werkwijze:** open Framer, klik in een tekst-element, vervang met de SpeeQ-versie hieronder. Werk sectie voor sectie van boven naar beneden.
> **Versie:** 1.0 · 2026-05-21

---

## 1. Eerst — Color Styles aanpassen (1x, dan klaar voor de hele site)

In Framer: linker panel → **Assets** → **Color Styles**. Vervang elke kleur die de Handyman-template gebruikt door deze tokens:

| Wat Handyman heeft | Vervang door (Warm Minimal) | Hex |
|---|---|---|
| Wit (`#FFFFFF`) achtergrond | Crème | `#FBF6EE` |
| Lichtgrijs alternatief | Oatmeal | `#F3EDE2` |
| Beige/zand secties | Surface | `#EADBC7` |
| Donkergrijs/zwart tekst | Text Primary | `#2B2B2B` |
| Donkergroen accent | Forest (status success) | `#1F4D3A` |
| Oranje/rood accent (Handyman's call-CTA) | Terracotta | `#F88363` |
| Grijze borders/dividers | Border Warm | `#C9B099` |

**Belangrijk:** geen puur wit, geen puur zwart in heel het ontwerp.

## 2. Fonts vervangen (Type Styles)

In Framer: **Assets** → **Type Styles**. Handyman gebruikt **Manrope** voor alles. Voor SpeeQ consistency met de tool:

| Element | Font | Gewicht | Style |
|---|---|---|---|
| H1 (hero) | **Playfair Display** | 700 | **Italic** |
| H2 (sectie-titel) | **Playfair Display** | 700 | **Italic** |
| H3 (subkop) | **Inter** | 600 | Regular |
| Body / paragraaf | **Inter** | 400 | Regular |
| Eyebrow / label / caption | **Inter** | 500 (uppercase + letter-spacing 2px) | Regular |
| Button | **Inter** | 600 | Regular |

Beide fonts zijn gratis op Google Fonts en al ingelezen in jouw project.

Alternatief: hou Manrope als je dat liever vindt. Werkt ook prima, maar dan wijkt de landing af van de tool zelf.

---

## 3. Content per sectie — kopieer-plak

### Sectie 1 — Nav (header)

| Handyman heeft | Vervang door |
|---|---|
| Logo "Handyman" | **SpeeQ** (in Playfair Italic 700) |
| `Home` | Verwijder of laat staan |
| `About` | **Wie maakt het** |
| `Blog` | **Inzichten** (of verwijder) |
| `Services` | **Hoe werkt het** |
| `Contact` | **Contact** |
| `Get template` button (rechtsboven) | **Plan demo** button |

Voeg toe naast "Plan demo": kleine subtle link **"Ik ben al klant →"** (link naar `/`).

---

### Sectie 2 — Hero ("Your go-to partner for home repairs")

| Handyman heeft | Vervang door |
|---|---|
| H1: "Your go-to partner for home repairs" | **Wkb-bewijslast in drie tikken.** |
| Sub-tekst onder H1 | *Foto, GPS en weer worden automatisch vastgelegd op de bouwplaats. De werkvoorbereider beoordeelt op kantoor. Eén klik aan einde project: PDF voor de Wkb-borger.* |
| "Request Your Free Call" form-header | **Plan een demo van 20 minuten** |
| Form name placeholder | **Uw naam** |
| Form phone placeholder | **Telefoonnummer** |
| Form submit-button "Request Call" | **Plan demo** |
| Klein label onder form ("We'll call back...") | *Johnny belt u persoonlijk binnen één werkdag* |

**Hero achtergrondfoto vervangen:**
Zoek in Framer een **Nederlandse bouwplaats-foto** (vakman met helm, fundering, plattegrond). Suggesties via Unsplash binnen Framer:
- Zoekterm: "construction site netherlands" of "dutch builder helmet"
- Vermijd: glazen kantoortorens, handenschuddende mannen in pakken

---

### Sectie 3 — Trust / "Top-rated service provider"

| Handyman heeft | Vervang door |
|---|---|
| H3: "Our company is a top-rated service provider" | **Wkb-software, persoonlijk gebouwd voor mkb-aannemers** |
| Logo-strip (Google, Trustpilot etc.) | *Optioneel: 3-5 logo's van klanten zodra je die hebt. Tot dan: verwijder de strip of vervang door drie zwarte tekst-bullets:* |
| Bullet 1 | **100% Nederlandse software** |
| Bullet 2 | **Eigen database in Frankfurt** |
| Bullet 3 | **Directe lijn naar de oprichter** |

---

### Sectie 4 — "Get professional handyman services" (intro met stats)

| Handyman heeft | Vervang door |
|---|---|
| H2 hoofdtitel | **Wkb-bewijslast maakt zichzelf** |
| Tekst eronder | *Sinds januari 2024 verplicht — tussen tachtig en tweehonderdvijftig vastleggingen per project. SpeeQ vangt dat op de bouwplaats op en levert aan einde project één compleet PDF-dossier.* |
| Stat 1: "24/7" + label | **3 tikken** + *Op de telefoon — foto, GPS, weer in één keer vastgelegd* |
| Stat 2: "5 hours" + label | **24 uur** + *Workspace klaar in Frankfurt na akkoord* |

---

### Sectie 5 — "How does it work?" (3 stappen)

| Handyman heeft | Vervang door |
|---|---|
| H2: "How does it work?" | **Zo werkt het** |
| Stap 1 H3 | **1. Vakman** |
| Stap 1 tekst | *Opent SpeeQ-app, maakt foto van het controlemoment. App voegt GPS, KNMI-weer en tijdstempel automatisch toe.* |
| Stap 2 H3 | **2. Werkvoorbereider** |
| Stap 2 tekst | *Beoordeelt foto's op desktop-dashboard. AI-precheck filtert: groen door, oranje controleren, rood afkeuren.* |
| Stap 3 H3 | **3. Einde project** |
| Stap 3 tekst | *Eén klik genereert het complete borgingsdossier als PDF, met uw bedrijfslogo. Klaar voor de Wkb-borger.* |

---

### Sectie 6 — "We offer a wide range of services" (categorieën)

Handyman heeft 4 service-categorieën (Exterior / Interior / Carpentry / Plumbing). Voor SpeeQ vervang door **4 functies**:

| Handyman categorie | SpeeQ functie | Beschrijving |
|---|---|---|
| Exterior works | **Bouwplaats-vastlegging** | *Foto + GPS + weer in drie tikken op de telefoon* |
| Interior works | **Werkvoorbereider-dashboard** | *Beoordeel alle bewijslast op één scherm, AI-precheck filtert ruis* |
| Carpentry | **PDF-borgingsdossier** | *Eén klik aan einde project — compleet dossier met uw logo* |
| Plumbing | **KiK-koppeling** | *Optionele sync naar het externe Wkb-borgersplatform* |

H2 sectie-titel: **Voor elke fase van het project**

---

### Sectie 7 — Stats blok ("25 / 30k")

Voorzichtig — als je geen echte cijfers hebt, vervang door deze veiliger statements:

| Handyman heeft | Vervang door |
|---|---|
| "25 years" | **100%** + *Eigen database per klant* |
| "30k projects" | **0** + *Gedeelde tabellen met concurrenten* |
| Alternatief stat 3 | **24u** + *Onboarding na akkoord* |

Of, als je dapper bent en eerste klant binnen hebt: **1ste** + *Klant in Q2 2026*.

---

### Sectie 8 — "We are your trusted partners" (about-blok)

| Handyman heeft | Vervang door |
|---|---|
| H2 | **Eén persoon, één telefoonnummer** |
| Body | *Mijn naam is Johnny Spee. Ik bouw SpeeQ zelf — vanuit mijn eenmanszaak Spee Solutions in Den Haag. Geen team van veertig, geen Amerikaanse investeerders, geen vertaalde Engelse software.* |
| Body vervolg | *Klanten krijgen de eerste zes maanden mijn directe lijn voor support. Geen ticket-systeem, geen call-center. Als u me belt, neem ik op of bel ik binnen een uur terug.* |
| Knop "Discover our story" | **Plan een 20-min kennismaking** (link naar `mailto:johnny@speesolutions.com`) |
| Foto van handyman in werkkleding | **Foto van Johnny** (kabel-trui of casual overhemd, in mkb-kantoor of café in Den Haag, daglicht) |

---

### Sectie 9 — "Our work process" (onboarding)

| Handyman heeft | Vervang door |
|---|---|
| H2 | **Hoe begin je** |
| Stap 1 H3 | **Plan een demo** |
| Stap 1 tekst | *Twintig minuten via videocall. Geen verkooppraat, gewoon een rustig gesprek over uw projecten.* |
| Stap 2 H3 | **Workspace binnen 24 uur** |
| Stap 2 tekst | *Bij akkoord staat uw eigen Supabase-database in Frankfurt klaar. Inclusief uw branding, gebruikers en eerste project.* |
| Stap 3 H3 | **Kickoff-call van 30 min** |
| Stap 3 tekst | *In de eerste week zetten we samen het eerste project op. Daarna gaat uw team zelfstandig verder.* |
| Stap 4 H3 | **Eerste 6 maanden** |
| Stap 4 tekst | *Directe lijn naar Johnny voor support. Geen ticket-systeem.* |

---

### Sectie 10 — "We remain available 24/7 by phone"

| Handyman heeft | Vervang door |
|---|---|
| H3 | **Directe lijn de eerste 6 maanden** |
| Telefoonnummer | **+31 6 81908480** |
| Button "Call now" | **Bel direct** |

---

### Sectie 11 — Testimonials ("What clients say")

Als je nog geen klanten hebt: **verberg deze sectie** (Framer → klik sectie → Visibility off). Toon hem pas op zodra je 3 testimonials kunt vragen.

Tussentijds alternatief — vervang testimonials door 3 founder-claims:

| Testimonial-slot | SpeeQ founder-claim |
|---|---|
| Quote 1 | *"Eigen database per klant. Dat regelt zich niet vanzelf — wij bouwen het bewust in."* |
| Auteur 1 | *Johnny Spee · Oprichter* |
| Quote 2 | *"Geen ticket-systeem. Klanten bellen me, ik neem op of bel binnen een uur terug."* |
| Auteur 2 | *Johnny Spee · Oprichter* |
| Quote 3 | *"Nederlands gemaakt, in Frankfurt gehost, AVG-conform. Geen Schrems-II-risico."* |
| Auteur 3 | *Johnny Spee · Oprichter* |

(Eerlijker: één founder-quote en de rest *"Komt zodra eerste klanten zijn opgeleverd"*. Niet doen alsof er al testimonials zijn.)

---

### Sectie 12 — Blog teaser ("Explore insights")

Verberg ook deze sectie als je nog geen blog-posts hebt. Of vul met 3 placeholders die naar bestaande docs verwijzen (eventueel later live):

| Blog-titel | Linkt naar |
|---|---|
| **Hoe Wkb in Excel je donderdagavond opslokt** | Future blog (placeholder) |
| **Eigen database vs gedeelde tabellen: wat maakt het uit?** | Future blog |
| **Wkb-checklist voor de eerste week** | Future blog |

Of: gewoon de sectie verbergen tot je echte content hebt.

---

### Sectie 13 — Footer

| Handyman heeft | Vervang door |
|---|---|
| Logo | **SpeeQ** |
| Tagline | *Wkb-software voor mkb-aannemers* |
| Adres | *Spee Solutions · Den Haag · Nederland* |
| Email | **johnny@speesolutions.com** |
| Phone | **+31 6 81908480** |
| KvK / BTW (apart blok onderin) | *KvK 80098876 · BTW NL003329419B19* |
| Social icons | Behoud alleen LinkedIn, verwijder Facebook/Instagram/TikTok |
| Copyright | © 2026 Spee Solutions · Alle rechten voorbehouden |

---

## 4. Verberg & verwijder

Volledig verwijderen uit jouw clone (klik sectie → Delete):
- ❌ "Get template" promo-banner (Handyman is een template, SpeeQ niet)
- ❌ "More from Designbuds" footer-link
- ❌ "Related Templates" sectie
- ❌ "Become a Framer Creator today" CTA
- ❌ Eventuele "Powered by Framer" badge in footer (kan via betaald-plan uit, of laat hem tijdelijk staan)

---

## 5. Publish-checklist voor jij op "Publish" klikt

- [ ] Custom domain ingesteld op **speesolutions.com/speeq** (Framer → Settings → Domain) — of tijdelijk de `*.framer.website` URL
- [ ] Favicon vervangen door SpeeQ Q-logo (`/frontend/src/assets/speeq-q-logo.png` in repo)
- [ ] Meta-description: *"Wkb-bewijslast in drie tikken. Eigen database in Frankfurt voor mkb-aannemers — door Spee Solutions."*
- [ ] Open Graph image: een crème screenshot van de SpeeQ-app
- [ ] Cookie-banner aan (Framer heeft ingebouwde optie) — kies AVG-modus
- [ ] Lighthouse mobile-score ≥ 90 testen na publish

---

## 6. Wat verandert ten opzichte van mijn HTML-versie

Mijn `/landing` HTML blijft live als **fallback**. Zodra jouw Framer-versie op `speesolutions.com/speeq` staat:
- Pomelli ads → wijzen naar de Framer-versie (mooier)
- `/landing` HTML → optioneel weghalen of als A/B-test laten staan
- Geen functioneel verschil voor klanten

---

*Versie 1.0 · 2026-05-21 · Spee Solutions*
*Werk sectie voor sectie van boven naar beneden. Niet alles in één keer proberen — kost 2-3 uur als je het rustig doet.*
