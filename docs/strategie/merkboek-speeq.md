# SpeeQ Merkboek

> **Wat dit is:** het complete merkboek van SpeeQ. Voor designers, copywriters, ad-platforms, fotografen, video-makers en iedereen die voor SpeeQ werkt. Lees het door — daarna hoef je niets meer te vragen.
>
> **Versie 1.0 — 2026-05-20**

---

## Inhoud

1. [Het merk in één pagina](#1-het-merk-in-één-pagina)
2. [De maker](#2-de-maker)
3. [Voor wie is SpeeQ](#3-voor-wie-is-speeq)
4. [Het probleem dat SpeeQ oplost](#4-het-probleem-dat-speeq-oplost)
5. [Wat is er ánders aan SpeeQ](#5-wat-is-er-ánders-aan-speeq)
6. [Onze waarden](#6-onze-waarden)
7. [Voice & tone](#7-voice--tone)
8. [Verbal identity — wel/niet zeggen](#8-verbal-identity--welniet-zeggen)
9. [Visuele identiteit](#9-visuele-identiteit)
10. [Beeldtaal](#10-beeldtaal)
11. [Product-vocabulaire](#11-product-vocabulaire)
12. [Voorbeelden in praktijk](#12-voorbeelden-in-praktijk)
13. [Wat NIET](#13-wat-niet)
14. [Contact](#14-contact)

---

## 1. Het merk in één pagina

| | |
|---|---|
| **Naam** | SpeeQ |
| **Eigenaar** | Spee Solutions — eenmanszaak van Johnny Spee |
| **Categorie** | Nederlandse Wkb-borgingssoftware (B2B SaaS) |
| **Markt** | Nederland, mkb-aannemers (5-50 medewerkers) |
| **Sinds** | 2026 (officieel gelanceerd na Wkb-invoering 1 jan 2024) |
| **Domein** | speesolutions.com/speeq |
| **Tagline** | *Uw eigen Wkb-database, in Frankfurt, voor u alleen.* |

**Kernzin (één regel):** *Bij SpeeQ krijg je een eigen database in Frankfurt — jouw data zit niet in dezelfde tabel als die van je concurrenten.*

---

## 2. De maker

**Johnny Spee** — eigenaar van Spee Solutions, IT-consultant met 15+ jaar ervaring in bedrijfssoftware voor het mkb. Den Haag.

- SpeeQ is zijn eigen product. Geen team van 40. Geen VC-investeerders. Geen Engelse marketinglaag.
- Hij belt klanten zelf bij intake. De eerste 6 maanden krijgen klanten een directe lijn naar hem voor support.
- Bedrijfsnummer: KvK 80098876 (zie juridische documenten voor volledige gegevens).
- Bereikbaar: johnny@speesolutions.com · +31 6 81908480

**Waarom dit relevant is voor het merk:**
SpeeQ is niet anoniem. Klanten kopen niet een platform — ze kopen Johnny Spee's professionele oordeel verpakt in software.

---

## 3. Voor wie is SpeeQ

### Persona: Jan

**Jan, 52, directeur-eigenaar.** Aannemersbedrijf met 18 vakmensen, gevestigd in Brabant. Begonnen als timmerman, draait al 25 jaar bedrijf. Bouwt 35-40 woningen per jaar plus wat kleinschalige utiliteit.

Sinds het Wkb-gedoe is zijn werkvoorbereider iedere donderdagavond uren aan het bijwerken in Excel. Foto's van de bouwplaats zitten in WhatsApp-groepen. GPS-data wordt handmatig overgetypt. Jan wil geen "platform". Hij wil dat het gewoon werkt en dat zijn boekhouder en de Wkb-borger tevreden zijn.

Jan is bereid premium te betalen als hij vertrouwt op wie levert.

### Doelgroep-segmenten

| Segment | Beschrijving | Hoe te benaderen |
|---|---|---|
| **Primair** | Mkb-aannemer 5-50 medewerkers, eigenaar 35-60 jaar | Persoonlijke demo, direct via Johnny |
| **Influencer** | Werkvoorbereider — degene die nu met Excel worstelt | Vakbladen, LinkedIn |
| **Eindgebruiker** | Vakman op bouwplaats | Niet direct gericht — komt mee via werkgever |
| **Beslisser-extern** | Wkb-borger, opdrachtgever, verzekeraar | Indirect: zien SpeeQ-PDF, vraagt vaak weer aan welk merk |

### Geen doelgroep

- Bedrijven kleiner dan 5 medewerkers — te klein voor onze prijs
- Bedrijven groter dan 100 medewerkers — andere behoefte, andere stack
- Buitenlandse bouw — alleen Nederlandse Wkb-context
- Doe-het-zelf-aannemers (zzp zonder team) — Excel volstaat voor hen

---

## 4. Het probleem dat SpeeQ oplost

Sinds 1 januari 2024 is de Wet Kwaliteitsborging voor het Bouwen (Wkb) verplicht voor alle bouwprojecten in Gevolgklasse 1 — woningen, kleinschalige utiliteit.

De aannemer moet kunnen bewijzen dat hij volgens de regels heeft gebouwd. Dit heet het **borgingsdossier**. Per project nodig:

- Foto's per controlemoment (fundering, wapening, isolatie, etc.)
- GPS-coördinaten
- Weersomstandigheden
- Akkoord van werkvoorbereider
- Soms: digitale handtekening van klant
- Soms: koppeling met de Wkb-borger via KiK

Voor een gemiddeld project: tussen 80 en 250 vastleggingen.

**Zonder tool**: Excel + Dropbox + WhatsApp. Foutgevoelig. Uren werk per week. Niet doorzoekbaar. Geen audit-trail.

**De pijn van Jan, in zijn eigen woorden**: *"Mijn werkvoorbereider is donderdagavond drie uur bezig met foto's sorteren. Eén keer was er een uitvraag van de verzekeraar en hadden we het dossier niet compleet. Toen werd het pijnlijk duidelijk."*

---

## 5. Wat is er ánders aan SpeeQ

### Het kerndifferentiator-verhaal

De concurrenten van SpeeQ (STA Software, Vastlegg, BKapp) zijn prima tools. Functioneel werken ze allemaal. Maar architectonisch hebben ze één eigenschap die zelden ter sprake komt: **uw bedrijfsdata staat in dezelfde Postgres-database als die van uw concurrenten**.

De scheiding tussen klanten wordt afgedwongen via Row-Level Security — een filter dat per query draait. Werkt prima zolang het werkt. Eén configuratie-fout, en data lekt.

Bij SpeeQ niet. Elke klant krijgt bij aanvang **een eigen Supabase-database in Frankfurt**. Fysiek apart. Geen gedeelde tabellen.

### De analogie

Bij andere Wkb-tools deelt u een bankvakkluis met andere aannemers — uw spullen liggen in hetzelfde safe-deposit, alleen het slot bepaalt wie waar bij kan. Bij SpeeQ heeft u uw eigen kluis in het bankgebouw. Iedereen zit in hetzelfde gebouw, maar in zijn eigen ruimte.

### Waarom dit ertoe doet

Voor 80% van de aannemers maakt dit geen zichtbaar verschil in het dagelijkse werk. Voor de 20% waar wél eens een uitvraag komt — van een opdrachtgever, een verzekeraar, een advocaat — is die vraag dan in drie minuten beantwoord.

### Inbegrepen in de prijs

Bij andere SaaS-leveranciers is "eigen database" een dure enterprise-meerkost. Bij SpeeQ is het standaard, inclusief.

### AVG-context

Frankfurt valt onder EU-grondgebied. Geen Schrems-II-risico zoals bij Amerikaans-gehoste SaaS. Dit is een ándere zorg dan de database-isolatie, maar wel een die we noemen als de klant ernaar vraagt.

---

## 6. Onze waarden

| Waarde | Wat het betekent in praktijk |
|---|---|
| **Nuchter** | We overdrijven niet. Als iets werkt, zeggen we dat. Als iets niet kan, zeggen we dat ook. |
| **Persoonlijk** | Johnny pakt zelf de telefoon. Geen call-center, geen tickets. |
| **Premium** | We zijn niet de goedkoopste. We zijn niet kapotgemaakt. |
| **Nederlands** | UI, documentatie, support — alles in het Nederlands. Geen vertaalde Engelse software. |
| **Eerlijk** | We bashen concurrenten niet. We benoemen feitelijke verschillen en laten de klant kiezen. |
| **Rustig** | Geen pop-ups. Geen tellers. Geen "Pas op! Beperkte plekken!" |

---

## 7. Voice & tone

### Toon — drie woorden

**Rustig. No-nonsense. Hollands nuchter.**

Liever stil overtuigend dan luid. We hoeven niet te schreeuwen — de klant zoekt actief naar een Wkb-oplossing, hij is al overtuigd dat hij iets nodig heeft. Wij hoeven alleen vertrouwen op te bouwen.

### Aanspreekvorm

- **B2B-communicatie (mailings, website, ads, sales)**: u-vorm
- **Social media (LinkedIn)**: u-vorm, maar minder formeel — zinnen mogen korter
- **Vakgebruikers in de app (UI-teksten)**: je-vorm (vakman op bouwplaats voelt zich niet "u")
- **Johnny zelf in 1-op-1-gesprek**: je-vorm zodra de klant je-vorm gebruikt

### Lengte

- Headlines: max 8 woorden, geen uitroeptekens
- Eerste alinea: 1 zin
- Email-body: max 4 alinea's, alinea's max 3 zinnen
- Whitepaper: zinnen onder 20 woorden waar mogelijk

### Ritme

Korte zin gevolgd door langere. Dan weer kort.
Voorbeeld: *"De wet is duidelijk. Bewijs aanleveren bij elk Wkb-project in Gevolgklasse 1, vanaf 1 januari 2024. SpeeQ regelt dat."*

---

## 8. Verbal identity — wel/niet zeggen

### Wel gebruiken

| Woord | Waarom |
|---|---|
| betrouwbaar | We doen wat we beloven |
| veilig | Past bij ons isolatie-verhaal |
| duidelijk | Nuchterheid |
| Nederlands gemaakt | USP |
| persoonlijk | USP |
| uw eigen | Past bij isolatie-claim |
| afgescheiden | Technisch correct, niet vaag |
| premium | Bewuste prijspositionering |
| transparant | Open over architectuur, prijs, beperkingen |
| nuchter | Onze toon |
| voor u gebouwd | Past bij MKB-focus |

### NIET gebruiken

| Verboden woord | Waarom |
|---|---|
| revolutionair | Cliché |
| game-changer | Cliché |
| next-generation | Cliché |
| disruptive | Engels + cliché |
| innovatief | Overgebruikt, betekent niets |
| naadloos | Marketing-vulling |
| krachtig | Marketing-vulling |
| modern | Cliché |
| oplossing | Te vaag — wij zijn een tool |
| ecosysteem | Corporate-jargon |
| empower / enable / unlock | Engelstalig corporate-jargon |
| scale / growth | Tech-startup-jargon |
| naadloze ervaring | Idem |
| best-in-class | Idem |
| state-of-the-art | Idem |

### Uitroeptekens

In voice-over en headlines: geen.
In productknoppen (UI): mag soms ("Sla op!"), maar liever niet.
In e-mails van Johnny: nooit.

---

## 9. Visuele identiteit

### Kleuren

| Token | Hex | Gebruik |
|---|---|---|
| Background | `#FBF6EE` | Achtergrond (crème, voorkomt verblinding) |
| Background-alt | `#F3EDE2` | Alternatief warm beige ("Oatmeal") |
| Surface | `#EADBC7` | Cards, modals (zacht beige) |
| Surface-alt | `#D8D1C7` | Tabs, filter-rijen (warm grijs) |
| Text-primary | `#2B2B2B` | Hoofdtekst (diep antraciet) |
| Text-secondary | `#2F2A25` | Secundaire tekst (espresso) |
| Text-muted | `#575B5F` | Timestamps, kleine labels |
| Status-success | `#1F4D3A` | Goedgekeurd (gedempt bosgroen) |
| Status-warning | `#F88363` | Actie vereist (terracotta) |
| Border-warm | `#C9B099` | Subtiele warme randen |

### Verboden kleuren

- **Puur wit** (`#FFFFFF`) — verblindend
- **Puur zwart** (`#000000`) — te hard contrast
- **Techno-blauw** (alle `#0078D4`/`#2563eb`-achtigen) — voelt als generieke SaaS
- **Neon-groen/-rood** — botst met onze rust

### Typografie

| Niveau | Font | Gewicht | Voorbeeld |
|---|---|---|---|
| Headline | Playfair Display | Bold + Italic | *"Team"* |
| Section title | Inter | SemiBold | "Bewijs & dossier" |
| Body / data | Inter | Regular | gewone tekst, tabellen |
| Caption / label | Inter | Medium | TIMESTAMPS, KLEINE LABELS |

**Two-Font System.** Serif voor identiteit, sans-serif voor functie. Nooit alle headlines in Inter, nooit body in Playfair.

### Logo

- **SpeeQ Q-logo**: ronde Q-vorm, antraciet op crème
- Op donkere achtergrond: crème op antraciet (omgekeerd)
- Minimum 40px hoog op web, 32px op mobiel
- Veiligheidszone: minstens halve Q-breedte rondom

### Iconen

Stijl: lineair, 2px stroke, niet ingekleurd. Niet emoji-stijl. Niet meerkleurig.

### Witruimte

Default groot. Padding/margins per token gedefinieerd: `s1=4px` t/m `s8=32px`. Liever te ruim dan te krap.

---

## 10. Beeldtaal

### Wel

- Schermopnames van de SpeeQ-app
- Nederlandse bouwplaats-context: helmen, schaft, plattegronden, fundering
- Mkb-kantoor in een rijtjespand
- Vakman met telefoon op bouwplaats — niet gestileerd
- Foto's met natuurlijk daglicht
- Plattegronden en bouwtekeningen als textuur of accent

### Niet

- Stockfoto's van handenschuddende mannen in pakken
- Figuurtjes met laptops in glazen tower
- "Diverse team huddled around screen"-shots
- Glanzende productrenders met neon-licht
- Datacenter-foto's met blauwe blinkjes
- Robotachtige AI-illustraties

### Fotostijl

Documentair. Lichte filmkorrel mag. Geen Instagram-filters. Kleurcorrectie naar warme aardetinten als nadruk gewenst is — niet verzadigd. Geen HDR.

---

## 11. Product-vocabulaire

Termen die in product, documentatie en marketing consistent moeten zijn:

| Term | Wat het betekent |
|---|---|
| **Borgingsdossier** | Het PDF-dossier dat per project wordt opgeleverd aan de Wkb-borger |
| **Bewijslast** | De foto's, GPS-data en akkoorden binnen één project |
| **Controlemoment** | Eén te documenteren bouwfase (bv. "betonstort fundering") |
| **Wkb-borger** | Externe partij die het dossier beoordeelt — onze klant levert aan, niet wij |
| **Tenant** | Eén SpeeQ-klant (= één bouwbedrijf met eigen database) |
| **Keyuser** | Klant-administrator binnen één tenant |
| **Maker** | Johnny zelf, eigenaar van het master-account |
| **AI-precheck** | Onze automatische foto-validatie (groen/oranje/rood) |
| **KiK-koppeling** | Externe sync naar het KiK-platform van Wkb-borgers |

### Niet gebruiken

- "Account" → zeg "**workspace**" of "**tenant**"
- "User" → zeg "**gebruiker**" of "**teamlid**"
- "Project manager" → zeg "**werkvoorbereider**" of "**projectleider**"
- "Dashboard" voor de hoofdpagina → zeg "**werkruimte**" of "**overzicht**"

---

## 12. Voorbeelden in praktijk

### Email-onderwerp — wel/niet

| ❌ NIET | ✅ WEL |
|---|---|
| 🚀 Tijd om uw Wkb-proces te revolutioneren! | Wkb-bewijslast — 20 min demo? |
| Innovatieve SaaS voor moderne aannemers | SpeeQ — uw eigen database in Frankfurt |
| LIMITED OFFER: Save 50% on Wkb! | Founder-deal: 12 mnd Pro voor Team-prijs |

### LinkedIn-post — voorbeeld

> Vakman maakt foto van fundering. SpeeQ voegt automatisch toe: GPS-locatie, KNMI-weergegevens, datum, gebruiker. Werkvoorbereider beoordeelt op kantoor. Aan einde project: PDF-dossier klaar voor de Wkb-borger.
>
> Geen Excel meer. Geen WhatsApp-foto's. Geen donderdagavond bijwerken.
>
> Plan een demo van 20 minuten — speesolutions.com/speeq

Geen emojis behalve waar functioneel. Geen "in this post we will explore...". Korte zinnen. Witregels tussen blokken.

### Headline-formules

- **Probleem + oplossing**: "Wkb in Excel? Drie tikken op de telefoon, klaar."
- **Differentiator**: "Uw eigen Wkb-database. In Frankfurt. Voor u alleen."
- **Resultaat**: "PDF-borgingsdossier in één klik."
- **Tijd**: "Wkb-administratie van 3 uur naar 3 minuten."

### Headline-anti-patronen

- "Boost your Wkb workflow today!" — Engels + uitroepteken
- "Discover the future of compliance" — vaag
- "Revolutionizing construction documentation" — verboden woord
- "The #1 Wkb tool in NL" — onbewijsbaar

### Standaardzinnen voor ad copy

Korte zinnen die Pomelli, of een copywriter, kan gebruiken als bouwstenen:

- *"Sinds januari 2024 moet u Wkb-bewijslast aanleveren bij elk project in Gevolgklasse 1."*
- *"Bij andere tools deelt u één database met uw concurrenten. Bij SpeeQ niet."*
- *"Drie tikken op de telefoon, en het controlemoment is vastgelegd."*
- *"Aan het einde van het project: één klik, complete PDF."*
- *"U bent niet de twintigste klant in een tabel. U bent klant nummer een in uw eigen database."*
- *"Johnny belt u zelf. Geen call-center, geen sales-development-rep."*

---

## 13. Wat NIET

### Verboden communicatie

- **Concurrent-bashing.** STA, Vastlegg en BKapp noemen we met respect of niet. Geen "wij zijn beter dan X".
- **Kunstmatige urgentie.** Geen "alleen vandaag", "beperkte plekken", aflopende kortingen.
- **Spam-CTAs.** Geen pop-ups, geen exit-intent modals, geen newsletter-overlays.
- **Garanties die we niet kunnen waarmaken.** Geen "100% uptime", geen "geen downtime ooit".
- **Geheimhouden van architectuur.** Onze isolatie-claim is publiek — we leggen 'm uit als de klant vraagt.

### Wat we afslaan

- Buitenlandse demo-aanvragen — wij focussen op Nederland
- Reseller-partnerships waar onze naam onder die van een partner verdwijnt
- Affiliate-deals — past niet bij persoonlijke verkoop
- White-label-verkoop waarbij SpeeQ als ander merk wordt aangeboden

### Conflict-vermijding

Als een klant ontevreden is en publiek klaagt: Johnny belt persoonlijk. Géén publieke discussie op LinkedIn/Twitter. Geen juridische dreigementen.

---

## 14. Contact

| | |
|---|---|
| **Naam** | Johnny Spee |
| **Bedrijf** | Spee Solutions |
| **Telefoon** | +31 6 81908480 |
| **E-mail** | johnny@speesolutions.com |
| **Website** | speesolutions.com/speeq |
| **Adres** | Den Haag, Nederland |
| **Repository** | github.com/Johnnyspee1979/speeq (privé) |

### Voor wie wat

- **Sales-vragen, demo's, partnerships** → johnny@speesolutions.com
- **Pers, content-aanvragen, podcasts** → johnny@speesolutions.com
- **Bug-reports, support, accounts** → johnny@speesolutions.com
- **Juridische zaken** → johnny@speesolutions.com (per juni 2026 wellicht een aparte mailbox)

Eén mailbox, één persoon, voorlopig. Dat is bewuste keuze, geen tekort.

---

## Bijlages (los te raadplegen)

- [Pomelli brand brief](../marketing/pomelli-brand-brief.md) — tactische ad-campagne-input
- [Pomelli keywords](../marketing/pomelli-keywords.md) — trefwoordenlijst
- [Concurrentie-munitie](../marketing/concurrentie-munitie.md) — feitelijke verschillen met STA/Vastlegg/BKapp
- [Founder-mail-template](../marketing/founder-mail.md) — outreach naar mogelijke 1e klanten
- [Waarom premium](../marketing/waarom-premium.md) — onderbouwing prijspositionering
- [Switch-service](../marketing/switch-service.md) — hoe overstappen vanaf een concurrent
- [Staat van zaken](staat-van-zaken.md) — productie-status van het platform
- [System prompt voor NotebookLM](system-prompt-notebooklm.md) — instructie-mandaat voor Claude Code via NotebookLM

---

*Versie 1.0 · 2026-05-20 · Spee Solutions*
*Volgende update: na eerste 3 betalende klanten — dan testimonials, case studies en concrete cijfers toevoegen.*
