# Landing-page spec — speesolutions.com/speeq

> **Wat dit is:** complete paste-klare specificatie voor de SpeeQ-landing in Framer (of Webflow). Sectie voor sectie: copy, kleuren, fonts, afmetingen, beeld-prompts.
> **Versie:** 1.0 · 2026-05-20
> **Bouwtijd:** geschat 4-6 uur in Framer als alle assets klaarliggen.

---

## Globaal — instellingen voor de hele pagina

### Kleuren (Framer color-styles aanmaken)

| Naam in Framer | Hex | Gebruik |
|---|---|---|
| `bg/cream` | `#FBF6EE` | Hele pagina-achtergrond |
| `bg/oatmeal` | `#F3EDE2` | Alternerende secties (om-en-om) |
| `surface/beige` | `#EADBC7` | Cards, callouts |
| `surface/warmgrey` | `#D8D1C7` | Footer, subtiele blokken |
| `text/primary` | `#2B2B2B` | Hoofdtekst |
| `text/secondary` | `#2F2A25` | Subtitels |
| `text/muted` | `#575B5F` | Captions, kleine labels |
| `accent/forest` | `#1F4D3A` | "Gegarandeerd"-marker, succes-badges |
| `accent/terracotta` | `#F88363` | Founder-deal badge, één primaire CTA-kleur |
| `border/warm` | `#C9B099` | Alle borders en dividers |

### Fonts (in Framer toevoegen via Google Fonts)

| Style | Font | Gewicht | Italic? |
|---|---|---|---|
| Hero headline (72px) | Playfair Display | 700 | ja |
| Section titel (48px) | Playfair Display | 700 | ja |
| Subsection (24px) | Inter | 600 | nee |
| Body (18px) | Inter | 400 | nee |
| Caption (14px) | Inter | 500 | nee |
| Button label (16px) | Inter | 600 | nee |

### Layout-regels

- Max content-breedte: **1140px** centred
- Mobile breakpoint: 768px
- Sectie verticale padding: **96px desktop, 64px mobiel**
- Tussen tekst-blokken: **24px**
- Tussen H + body: **16px**

---

## Sectie 1 — Navigation (sticky, transparant op scroll)

| Onderdeel | Tekst | Style |
|---|---|---|
| Logo links | SpeeQ-Q-logo (40px hoog) | Antraciet op crème |
| Menu midden | "Hoe werkt het" · "Voor wie" · "Prijzen" · "Veelgestelde vragen" | Inter 16, text/primary |
| Rechts subtiel | "Ik ben al klant →" | Inter 14, text/muted, hover text/primary |
| Rechts primair | **"Plan demo"** | Knop, antraciet bg, crème text, 12px radius, 14px/24px padding |

Bij scrollen na 100px: voeg lichte border-bottom `border/warm` toe + 4px blur-shadow.

---

## Sectie 2 — Hero (eerste viewport)

**Achtergrond:** `bg/cream`
**Hoogte:** 90vh desktop / 80vh mobiel
**Layout:** twee-koloms desktop, gestapeld mobiel. Links 60% tekst, rechts 40% beeld.

### Links — copy

**Eyebrow (caption, 14px, text/muted, letter-spacing 2px, uppercase):**
```
SINDS 1 JANUARI 2024 VERPLICHT
```

**Hoofdtitel (Playfair Italic 700, 72px desktop / 48px mobiel, text/primary):**
```
Wkb-bewijslast
in drie tikken.
```

(Twee regels — line-break belangrijk voor ritme)

**Sub (Inter 400, 20px, text/secondary, line-height 1.5, max-width 480px):**
```
Foto, GPS en weer worden automatisch vastgelegd op de bouwplaats.
De werkvoorbereider beoordeelt op kantoor. Aan einde project:
één klik, PDF voor de Wkb-borger.
```

**Twee CTA's onder elkaar (mobiel) of naast elkaar (desktop):**

| | Tekst | Style |
|---|---|---|
| Primair | **"Plan een demo van 20 minuten"** | Antraciet bg, crème text, 14/28 padding, 12 radius |
| Secundair | "Bekijk hoe het werkt (5 min)" | Transparant, `border/warm` border, text/primary, 14/28 padding |

**Trust-strip (klein, 16px boven CTA, text/muted, 13px Inter):**
```
Eerste 6 maanden directe lijn naar Johnny · Workspace binnen 24 uur · 30 dagen proef
```

### Rechts — beeld

Eén beeld of een korte loop (5 sec, geen audio):

**Beeld-prompt (voor Midjourney/Nano Banana/fotograaf):**
```
Een Nederlandse vakman op een bouwplaats, 40 jaar, met helm, jas met
oranje strepen. Houdt een smartphone vast en kijkt naar het scherm.
Op de achtergrond: net gestorte fundering, plattegrond op een tafel.
Daglicht, bewolkt, geen direct zonlicht. Documentaire stijl, geen
glamour. Lichtcorrectie naar warme aardetinten. 4:5 verhouding.
Géén stockfoto-handenschuddende-mannen, géén glasarchitectuur.
```

**Of (alternatief):** een 5-sec screencapture-loop van de app: vakman opent SpeeQ, tikt 3x op telefoon, status wordt groen. Webm-formaat. Poster-image is frame 0.

---

## Sectie 3 — Het probleem

**Achtergrond:** `bg/oatmeal`
**Padding:** 96px verticaal

### Layout: gecentreerde tekst, max-breedte 720px

**Eyebrow:**
```
HET PROBLEEM
```

**Section titel (Playfair Italic, 48px, text/primary):**
```
Excel, WhatsApp, donderdagavond.
```

**Body (Inter 18px, text/secondary, line-height 1.7):**
```
Sinds januari 2024 moet u Wkb-bewijslast aanleveren bij elk
bouwproject in Gevolgklasse 1. Tussen tachtig en tweehonderdvijftig
vastleggingen per project: foto's, GPS, weer, akkoord, vaak een
handtekening van de klant.

Zonder tool wordt dat handmatig bijgehouden in Excel, Dropbox en
WhatsApp-groepen. Werkvoorbereiders zijn er uren per week aan kwijt.
Foto's raken zoek. Eén uitvraag van een verzekeraar — en het
dossier blijkt onvolledig.
```

Geen knop in deze sectie. Pure context-bouwer.

---

## Sectie 4 — Hoe werkt het — 3 stappen

**Achtergrond:** `bg/cream`
**Layout:** drie kolommen desktop (gelijk), gestapeld mobiel

### Header gecentreerd boven de kolommen

**Eyebrow:**
```
ZO WERKT HET
```

**Section titel (Playfair Italic, 48px):**
```
Drie tikken op de bouwplaats.
```

### Drie kolommen — elk:

| Kolom | Number-badge (forest bg, crème text, rond, 48px) | Titel (Inter 600, 24px) | Body (Inter 400, 16px, text/secondary) |
|---|---|---|---|
| 1 | "1" | Vakman | Opent SpeeQ-app, maakt foto van het controlemoment. App voegt GPS, KNMI-weer en tijdstempel automatisch toe. |
| 2 | "2" | Werkvoorbereider | Beoordeelt foto's op desktop-dashboard. AI-precheck filtert: groen door, oranje controleren, rood afkeuren. |
| 3 | "3" | Einde project | Eén klik genereert het complete borgingsdossier als PDF, met uw bedrijfslogo. Klaar voor de Wkb-borger. |

Boven elke kolom een klein 1:1 beeld (160x160px):
- Kolom 1: vakman met telefoon, close-up handen op scherm
- Kolom 2: laptop-scherm met SpeeQ-dashboard
- Kolom 3: gerenderde PDF (zwevend, lichte schaduw)

---

## Sectie 5 — Wat is anders aan SpeeQ

**Achtergrond:** `bg/oatmeal`
**Layout:** twee koloms desktop (50/50), gestapeld mobiel

### Links — copy

**Eyebrow:**
```
HET VERSCHIL
```

**Section titel (Playfair Italic, 48px, text/primary):**
```
Uw eigen database.
Niet bij uw concurrenten.
```

**Body:**
```
De meeste Wkb-tools bouwen op gedeelde Postgres-databases. Uw data
zit in dezelfde tabel als die van uw concurrenten — gescheiden door
filterregels. Werkt prima zolang het werkt.

SpeeQ levert elke klant een eigen Supabase-database in Frankfurt.
Fysiek apart. Geen gedeelde tabellen. Inbegrepen in de standaardprijs.

Voor de meeste aannemers maakt dat in het dagelijkse werk geen
verschil. Voor de keer dat een verzekeraar of opdrachtgever erom
vraagt — dan is die vraag in drie minuten beantwoord.
```

**Subtle quote-vlak (italic, text/secondary, accent/forest border-left 3px):**
```
Het verschil is een bankvak versus een eigen kluis.
Iedereen zit in hetzelfde gebouw, maar in zijn eigen ruimte.
```

### Rechts — illustratie

**Twee bankkluis-illustraties naast elkaar:**

| Concurrent | SpeeQ |
|---|---|
| Eén grote kluisdeur, achter de deur veel laden met logo's | Reeks individuele kluisdeurtjes, ieder met eigen logo |
| Label: "Gedeelde database" | Label: "Eigen database per klant" |

Eenvoudige lijn-illustratie in `text/primary` op `bg/oatmeal`. Geen kleurvulling. Stijl: alsof een architect het tekent.

---

## Sectie 6 — Voor wie

**Achtergrond:** `bg/cream`

### Header gecentreerd

**Eyebrow:**
```
VOOR WIE
```

**Section titel:**
```
Voor de aannemer die premium kiest.
```

**Sub (Inter 400, 20px, text/secondary, gecentreerd, max-w 720):**
```
Bouwbedrijven met vijf tot vijftig medewerkers, die niet de
goedkoopste hoeven te zijn — en wel een vaste contactpersoon
willen kunnen bellen.
```

### Drie pakket-kaarten (twee koloms desktop met de Pro-card +25% breder als visual emphasis)

Card-styling:
- `surface/beige` achtergrond
- `border/warm` 1px border
- 24px radius
- 32px padding

**Card 1 — Team**
| | |
|---|---|
| Label boven | TEAM |
| Prijs | €149 |
| /maand label | per maand |
| Bullets (8 stuks max, ✓ in forest) | tot 5 gebruikers · onbeperkt aantal projecten · standaard branding · e-mail support · 30 dagen proef |
| CTA | "Plan demo" (secondary button) |

**Card 2 — Pro** (geaccentueerd: kleine "Aanbevolen" badge in `accent/terracotta` rechtsbovenin)
| | |
|---|---|
| Label | PRO |
| Prijs | €299 |
| Bullets | tot 15 gebruikers · eigen branding op PDF's · vaste support-lijn · WhatsApp-integratie · KiK-koppeling |
| CTA | "Plan demo" (primary button) |

**Card 3 — Enterprise**
| | |
|---|---|
| Label | ENTERPRISE |
| Prijs | vanaf €899 |
| Bullets | onbeperkt aantal gebruikers · SLA · custom-integraties · prioriteit-support · jaarlijkse review |
| CTA | "Vraag aan" (secondary button) |

### Onder de cards — founder-strip

Subtiele banner over volle breedte:
- `surface/warmgrey` bg
- `border/warm` 1px
- 16px radius
- 24px padding

```
FOUNDER-DEAL — eerste 3 klanten krijgen 12 maanden Pro voor Team-prijs.
2 plekken nog vrij in mei.
```

Klein klok-icoon links van tekst. `accent/terracotta` voor het cijfer "2".

---

## Sectie 7 — Wie maakt dit

**Achtergrond:** `bg/oatmeal`
**Layout:** twee koloms desktop (40% portret / 60% tekst)

### Links — portret van Johnny

Vierkant 480x480 foto. Documentaire stijl, geen pak, geen geforceerde lach. Daglicht, kantoor of buiten in Den Haag. Lichte filmkorrel mag.

**Beeld-prompt voor fotograaf:**
```
Johnny Spee, 45, in een kabel-trui of casual overhemd, zittend in
een mkb-kantoor of café in Den Haag. Daglicht via raam links.
Neutrale blik in de camera, kleine glimlach. Geen pak. Geen prop.
Documentaire stijl, 4:5 verhouding, warm gecorrigeerd.
```

### Rechts — copy

**Section titel:**
```
Eén persoon, één telefoonnummer.
```

**Body:**
```
Mijn naam is Johnny Spee. Ik bouw SpeeQ zelf — vanuit mijn eenmanszaak
Spee Solutions in Den Haag. Geen team van veertig, geen Amerikaanse
investeerders, geen vertaalde Engelse software.

Klanten krijgen de eerste zes maanden mijn directe lijn voor support.
Geen ticket-systeem, geen call-center. Als u me belt, neem ik op of
bel ik binnen een uur terug.

Dat zal voorlopig zo blijven.
```

**Handtekening (Inter Italic 18px, text/secondary):**
```
— Johnny Spee, Spee Solutions
```

**Twee subtiele links:**
- LinkedIn-profiel
- E-mailadres `johnny@speesolutions.com` (klikbaar)

---

## Sectie 8 — Veelgestelde vragen

**Achtergrond:** `bg/cream`
**Layout:** gecentreerd, max-width 720px, accordion-stijl (klik om uit te klappen)

### Header

**Eyebrow:**
```
VEELGESTELDE VRAGEN
```

**Section titel:**
```
Wat u zich nu afvraagt.
```

### 6 vragen — accordion items

Elke item: 24px Inter SemiBold titel + `border/warm` border-bottom.
Antwoord: 16px Inter Regular, text/secondary.

**1. Is mijn data echt veilig?**
> *Ja. Elke klant krijgt een eigen Supabase-database in Frankfurt, fysiek gescheiden. Geen gedeelde tabellen. AVG-conform omdat EU-grondgebied. Wij hebben geen "admin-toegang" tot uw data.*

**2. Wat als ik wil overstappen vanaf STA / Vastlegg / BKapp?**
> *Wij helpen met data-overdracht. Foto's en metadata kunnen we importeren als u een export bestand heeft. Lukt het niet automatisch, dan doe ik het handmatig — kosteloos in de eerste 6 maanden.*

**3. Werkt het offline op de bouwplaats?**
> *Ja. De app slaat foto's lokaal op en synct zodra er weer netwerk is. GPS en tijdstempel worden lokaal vastgelegd. Pas bij upload checken we duplicaten.*

**4. Wat kost het écht — geen verborgen kosten?**
> *De prijs is wat u ziet. Geen setup-fee, geen support-pakket dat u apart moet kopen, geen "enterprise"-meerkost voor de eigen database. Alleen extra opslag boven de 100GB is bijbetaling, en daar zit u niet snel aan.*

**5. Hoe lang duurt de onboarding?**
> *Workspace staat binnen 24 uur na akkoord klaar. Eerste week: een kickoff-call van 30 minuten waarin we samen uw eerste project opzetten. Vanaf dag drie kan uw team er volledig mee werken.*

**6. Wat als ik wil weg?**
> *U kunt op elk moment opzeggen, geen lange contracten. Bij vertrek krijgt u een export van al uw data — foto's, metadata, PDF-dossiers. U bent eigenaar van uw data, wij bewaren een laatste backup van 30 dagen voor uw zekerheid, daarna wordt alles verwijderd.*

---

## Sectie 9 — Final CTA

**Achtergrond:** `accent/forest` (gedempt bosgroen)
**Tekst:** crème `bg/cream`
**Padding:** 96px verticaal

### Layout: gecentreerde tekst, max-width 720px

**Section titel (Playfair Italic, 56px, crème):**
```
Twintig minuten,
en u weet of het past.
```

**Body (Inter 18px, crème met 90% opacity):**
```
Ik bel persoonlijk. Geen sales-script, geen overtuigingsverhaal —
gewoon een rustig gesprek over uw projecten en of SpeeQ ze beter
maakt. Doet het dat niet, dan zeg ik dat ook.
```

**Eén grote knop:**
- Tekst: **"Plan een demo van 20 minuten"**
- Style: crème bg, antraciet text, 16/40 padding, 12 radius

**Klein onder de knop:**
```
of bel direct: +31 6 81908480
```

---

## Sectie 10 — Footer

**Achtergrond:** `surface/warmgrey`
**Padding:** 64px verticaal

### 4 kolommen desktop, gestapeld mobiel

**Kolom 1 — SpeeQ**
```
SpeeQ
Wkb-software voor mkb-aannemers
Spee Solutions · Den Haag
KvK 80098876 · BTW NL003329419B19
```

**Kolom 2 — Product**
- Hoe werkt het (#section 4)
- Voor wie (#section 6)
- Prijzen (#section 6)
- Veelgestelde vragen (#section 8)
- Demo plannen (#section 9)

**Kolom 3 — Juridisch**
- Algemene voorwaarden (link naar bestaande PDF)
- Privacyverklaring (link)
- Verwerkersovereenkomst (link)
- Cookie-instellingen

**Kolom 4 — Contact**
```
johnny@speesolutions.com
+31 6 81908480
LinkedIn: linkedin.com/in/johnnyspee
```

### Footer-bottom

```
© 2026 Spee Solutions · Alle rechten voorbehouden
```

`text/muted`, 12px, gecentreerd.

---

## Mobiele aanpassingen (768px en kleiner)

- Alle font-sizes naar 60% van desktop (72px → 48px, 48px → 32px, 24px → 20px)
- Twee-koloms layouts → gestapeld
- Hero: tekst boven, beeld onder
- Sticky nav: hamburger-icoon ipv volledig menu
- Bullets-cards: één onder de andere, geen aanbevolen-emphasis
- Sticky "Plan demo"-knop rechtsonder? Liever niet — duim-zone niet blokkeren

---

## Cookie-redirect logica (later toevoegen)

Op `speesolutions.com/speeq`, in `<head>`:

```html
<script>
  (function() {
    if (document.cookie.includes('wkb_returning=1')) {
      window.location.replace('https://speeq-wkb-tool.vercel.app/');
    }
  })();
</script>
```

In de SpeeQ-app, bij succesvolle eerste login:

```javascript
document.cookie =
  'wkb_returning=1; domain=.speesolutions.com; max-age=31536000; path=/; samesite=lax';
```

Effect: na eerste login slaat de cookie zich op. Volgende ad-klik gaat direct door naar de app — gebruiker ziet de marketing nooit meer.

---

## Performance-eisen

- Lighthouse Mobile score: **≥ 90** voor Performance, Best Practices, SEO
- Time to Interactive: **≤ 2.0 sec** op 3G simulatie
- Total page weight: **≤ 800 KB** initial paint
- Lazy-load alle beelden onder de fold
- Beelden in webp + jpg fallback
- Geen tracking-scripts boven de fold

---

## Wat eerst, wat later

| Prioriteit | Sectie | Reden |
|---|---|---|
| **MOET af voor launch** | 1, 2, 4, 6, 9 | Conversion-flow compleet |
| Mag in week 2 | 3, 5, 8 | Vertrouwen + objection-handling |
| Mag in week 3 | 7, footer-detail | Polish |

**Eerste deploy-target:** secties 1+2+9 op een Vercel-subpath (`speesolutions.com/speeq-preview`). Geeft Pomelli een werkende URL terwijl jij in Framer de volledige versie afbouwt.

---

*Versie 1.0 · 2026-05-20 · Spee Solutions*
