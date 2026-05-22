# NotebookLM Video-prompt — SpeeQ Demo

> **Doel:** Video Overview genereren in NotebookLM voor SpeeQ-demo (5-7 min)
> **Gebruik:** Op landingpage `speesolutions.com/speeq`, in welkomstmail, in LinkedIn-posts
> **Datum:** 14 mei 2026

---

## Stap 1 — Upload deze bronnen in NotebookLM

Voeg eerst toe als **sources** in je NotebookLM-notebook:

| Bron | Pad |
|---|---|
| SpeeQ 1-pager | `docs/marketing/pdf/SpeeQ-1pager.pdf` |
| Algemene voorwaarden | `docs/juridisch/pdf/SpeeQ-Algemene-Voorwaarden.pdf` |
| Privacyverklaring | `docs/juridisch/pdf/SpeeQ-Privacyverklaring.pdf` |
| Verwerkersovereenkomst | `docs/juridisch/pdf/SpeeQ-Verwerkersovereenkomst.pdf` |
| Klant-onboarding-plan | `docs/strategie/klant-onboarding-plan.md` |
| Concurrentie-analyse | `docs/DKA-Leveranciers-Vergelijking.md` |
| Wkb-pitch | `docs/Elevator-Pitch-Wkb.md` |

---

## Stap 2 — Klik op "Video Overview" → "Customize"

Plak deze volledige tekst in het customisation-veld:

```
================================================================
PROMPT VOOR NOTEBOOKLM VIDEO OVERVIEW — SPEEQ
Versie 2.0 · Bijgewerkt 2026-05-20
================================================================

DOEL VAN DEZE VIDEO

Een MKB-aannemer in Nederland heeft 5 minuten over en wil weten
of SpeeQ iets voor hem is. Aan het eind van de video moet hij
één ding onthouden: "SpeeQ is een Wkb-tool waar mijn data niet
in dezelfde database staat als die van mijn concurrenten."
Lukt dat, dan is de video geslaagd. Niet meer, niet minder.

ROL EN TOON

Je maakt een rustige, professionele uitleg-video over SpeeQ —
een Nederlandse Wkb-borgingstool van Spee Solutions, eenmanszaak
van Johnny Spee in Den Haag. De video is bedoeld voor middel-
grote aannemers (5 tot 50 medewerkers) die per 1 januari 2024
verplicht moeten voldoen aan de Wet Kwaliteitsborging voor het
Bouwen (Wkb) — en daar nog steeds met Excel, WhatsApp-foto's
of een gedeelde tool als STA, Vastlegg of BKapp doorheen worstelen.

Spreek de kijker aan met "u" — formele zakelijke vorm. Nooit "je".
Toon: helder, no-nonsense, Hollands nuchter. Geen amerikaans
verkoperspraat, geen Engelstalige termen waar Nederlands volstaat,
geen overdreven enthousiasme. Liever stil overtuigend dan luid.

VERBODEN WOORDEN

Gebruik onder geen voorwaarde:
- "Revolutionair", "game-changer", "next-generation", "disruptive"
- "Innovatief", "naadloos", "krachtig", "modern" (allen cliché)
- "Oplossing" (vaag), "ecosysteem" (corporate)
- "Empower", "enable", "unlock", "scale", "growth-hack"
- Uitroeptekens in voice-over

TOEGESTANE WOORDEN

Vrij in te zetten: "betrouwbaar", "veilig", "duidelijk", "Nederlands
gemaakt", "persoonlijk", "uw eigen", "afgescheiden", "premium",
"transparant", "rustig", "nuchter", "voor u gebouwd".

DOELGROEP

Stel u één persoon voor: Jan, 52 jaar, directeur-eigenaar van een
aannemersbedrijf met 18 vakmensen in Brabant. Hij is van oudsher
timmerman, draait al 25 jaar bedrijf. Sinds Wkb gedoe loopt zijn
werkvoorbereider iedere donderdagavond uren bij te werken in Excel.
Foto's van de bouwplaats zitten in WhatsApp-groepen, GPS-data wordt
handmatig overgetikt. Jan wil geen "platform", hij wil dat het
gewoon werkt en dat zijn boekhouder en de Wkb-borger tevreden zijn.
Hij is bereid premium te betalen als hij vertrouwt op wie levert.

KERNBOODSCHAP — DE ÉÉN-ZIN-AMBITIE

Als de kijker na 5 minuten alleen dít onthoudt, is het goed:
"Bij SpeeQ krijg ik een eigen database in Frankfurt — mijn data
zit niet in dezelfde tabel als die van mijn concurrenten."

LENGTE EN STRUCTUUR

Totaal 5 tot 6 minuten. Verdeel strikt in zes hoofdstukken.
Elk hoofdstuk begint met de hoofdstuktitel onderaan beeld.

HOOFDSTUK 1 — Het Wkb-probleem (45 sec)
- Sinds 1 januari 2024 verplicht voor alle bouwprojecten in
  Gevolgklasse 1 (woningen, kleinschalige utiliteit)
- Aannemer moet kunnen bewijzen dat hij volgens de regels heeft
  gebouwd: dat heet het borgingsdossier
- Per project nodig: foto's per controlemoment, GPS-coördinaten,
  weersomstandigheden, akkoord van de werkvoorbereider, soms
  digitale handtekening
- Voor een gemiddeld project tussen de 80 en 250 vastleggingen
- Zonder tool: handmatig in Excel + Dropbox + WhatsApp. Foutgevoelig.

HOOFDSTUK 2 — Wat doen andere tools (45 sec)
- Er zijn drie bekende spelers in Nederland: STA Software (markt-
  leider, ~450 klanten), Vastlegg (gebruiksvriendelijk) en BKapp
  (prijsvriendelijk).
- Alle drie functioneel prima. Maar één architectonisch detail
  dat zelden ter sprake komt: bij alle drie staat uw bedrijfs-
  data in dezelfde Postgres-database als die van uw concurrenten.
- De scheiding tussen klanten wordt afgedwongen via Row-Level
  Security — een filter dat per query draait. Werkt prima zolang
  het werkt. Eén configuratie-fout en data lekt.
- Geen verwijt aan die leveranciers — dit is hoe SaaS standaard
  gebouwd wordt. Goedkoper, schaalbaarder. Voor de meeste
  branches prima. Voor bouw — waar uw projecten, marges en
  klantadressen concurrentiegevoelig zijn — een afweging om
  bewust te maken.

HOOFDSTUK 3 — Wat is anders aan SpeeQ (90 sec)
DIT IS DE KERN VAN DE VIDEO — BENADRUK HET:
- Elke SpeeQ-klant krijgt bij aanvang een eigen Supabase-database
  in Frankfurt. Fysiek apart. Geen gedeelde tabellen.
- Alleen ú heeft toegang. Geen andere klant, geen "platform-admin"
  van Spee Solutions die door uw data bladert.
- Inbegrepen in de abonnementsprijs — geen verborgen "enterprise"-
  meerkosten zoals bij andere leveranciers.
- AVG-conform: Frankfurt valt onder EU-grondgebied, geen Schrems-II-
  risico zoals bij US-hosted SaaS.
- De juiste analogie: dit is uw eigen kluis in een bankgebouw,
  niet een vakje in een gedeelde safe-deposit. Iedereen zit in
  hetzelfde gebouw, maar in zijn eigen ruimte.
- Voor 80% van de aannemers maakt dit geen zichtbaar verschil in
  het dagelijkse werk. Voor de 20% waar wél eens een uitvraag komt
  van een opdrachtgever, een verzekeraar of een advocaat — die
  vraag is dan in drie minuten beantwoord.

HOOFDSTUK 4 — Hoe werkt het in de praktijk (90 sec)
Scenario: een vakman staat op de bouwplaats, fundering wordt
gestort. Wat doet hij:
- Pakt zijn telefoon, opent de SpeeQ-app
- Maakt drie foto's van het controlemoment
- De app voegt automatisch toe: GPS-locatie, weersgegevens van
  het KNMI-station 4 km verderop, datum, tijd, gebruiker
- Een AI-controle kijkt mee en bepaalt: groen (akkoord en
  archiveren), oranje (twijfel, werkvoorbereider beoordeelt)
  of rood (duidelijk niet akkoord, direct melding)
- Bij oranje of rood krijgt de werkvoorbereider op kantoor
  binnen 30 seconden een push-melding
- Aan het einde van het project genereert SpeeQ automatisch het
  complete borgingsdossier — PDF met uw bedrijfslogo, klaar voor
  de Wkb-borger
- Voor de vakman op de bouwplaats: drie tikken, klaar
- Voor de werkvoorbereider: één dashboard, alle projecten
- Voor de directeur: zekerheid dat het Wkb-deel geregeld is

HOOFDSTUK 5 — Voor wie, wat kost het (45 sec)
- SpeeQ is voor aannemers die premium kiezen boven goedkoop —
  bewust kiezen voor een Nederlandse leverancier met een vaste
  contactpersoon
- Drie pakketten, vanaf €149 per maand:
  - Team: €149/mnd, tot 5 gebruikers, één project tegelijk
  - Pro: €299/mnd, tot 15 gebruikers, eigen branding op PDF's,
    vaste supportlijn
  - Enterprise: €899/mnd en hoger, onbeperkt aantal gebruikers,
    SLA, custom-integraties
- Founder-deal voor de eerste 3 klanten: 12 maanden Pro tegen
  Team-prijs (u betaalt €149 in plaats van €299)
- 30 dagen gratis proef met volledige Pro-toegang. Geen credit-
  card vooraf, geen opzegtermijn-trucs.

HOOFDSTUK 6 — Hoe begint u (30 sec)
- Ga naar speesolutions.com/speeq
- Klik op "Plan een 20-minuten demo"
- Johnny Spee belt u persoonlijk — geen call-center, geen sales-
  development-rep, geen scripted intake
- Bij akkoord: uw eigen workspace staat binnen 24 uur in Frankfurt
- In de eerste week: een kickoff-call van 30 minuten, samen het
  eerste project opzetten
- Daarna: directe lijn naar Johnny voor de eerste 6 maanden,
  geen ticket-systeem

OUTRO (15 sec) — TEKSTEN IN BEELD

Drie kaartjes, één na de ander, allemaal op crème achtergrond:
1. "SpeeQ — uw eigen Wkb-database, in Frankfurt, voor u alleen."
2. "speesolutions.com/speeq"
3. "Johnny Spee · johnny@speesolutions.com · +31 6 81908480"

VOORBEELDZINNEN VOOR DE VOICE-OVER

Gebruik gerust dit type formuleringen — rustig tempo, dalende
intonatie aan einde zin:
- "Sinds januari 2024 moet u Wkb-bewijslast aanleveren bij elk
   project in Gevolgklasse 1."
- "Bij andere tools deelt u één database met uw concurrenten.
   Bij SpeeQ niet."
- "Drie tikken op de telefoon, en het controlemoment is vastgelegd."
- "Aan het einde van het project: één klik, complete PDF."
- "U bent niet de twintigste klant in een tabel. U bent klant
   nummer een in uw eigen database."

VISUELE STIJL

- Kleurpalet: navy (#0B2545), cream (#FAF7F2), goud-accent (#C9A961).
  Géén puur wit, géén puur zwart.
- Beeld: schermopnames van de SpeeQ-app, Nederlandse bouwplaats-
  context (helmen, schaft, plattegronden, fundering), MKB-kantoor
  in een rijtjespand
- Géén stockfoto's van handenschuddende mannen in pakken
- Géén figuurtjes met laptops in een glazen tower
- Typografie: serif voor citaten en tussentitels, sans-serif voor
  labels en data
- Overgangen: rustige fades, geen swoosh, geen flitsen
- Muziek: instrumentaal, rustig, lage BPM — geen corporate piano

WAT NIET TONEN, NIET ZEGGEN

- Geen logo's van STA Software, Vastlegg of BKapp in beeld
- Geen prijsvergelijking in tabelvorm met concurrent
- Nooit zeggen dat SpeeQ "beter" is — wel dat het "anders
  is gebouwd" en welke afweging dat impliceert
- Geen kunstmatige urgentie ("alleen nu", "beperkt aantal plekken")
- Geen disclaimer-blokken in kleine letters

NUANCE — HOE OVER CONCURRENTIE TE SPREKEN

STA, Vastlegg en BKapp zijn geen vijanden, het zijn collega-
leveranciers met een ander architectonisch uitgangspunt. Spreek
over hen met respect. De boodschap is niet "die zijn slecht",
maar "wij hebben anders gekozen, en dat heeft consequenties die
voor sommige klanten relevant zijn." Wie zelf prima zit bij STA,
hoeft niet weg.

CALL-TO-ACTION

Onderaan elke slide, in dezelfde subtiele typografie:
"speesolutions.com/speeq"

EINDE PROMPT
================================================================
```

---

## Stap 3 — Na generatie

NotebookLM levert een MP4 op. Wat ermee doen:

| Locatie | Hoe gebruiken |
|---|---|
| `speesolutions.com/speeq` landingpage | Achter "Bekijk hoe het werkt"-knop |
| Welkomstmail nieuwe klant | Direct-embed of YouTube-link |
| LinkedIn-post (lang formaat) | Upload als native video |
| Demo-call opener | Vóór de live-demo afspelen |

## Backup-prompt — als Video Overview niet kan

Als NotebookLM geen Video Overview ondersteunt voor jouw account,
gebruik dan **Audio Overview** met dezelfde prompt — bovenaan eerste
regel toevoegen:

```
GENEREER EEN AUDIO-PODCAST tussen twee Nederlandse hosts
(één mannelijk, één vrouwelijk), beide professioneel maar
toegankelijk. Geen Engelstalige uitspraken.
```

De rest van de prompt blijft identiek.

---

*Versie 1.0 · 2026-05-14 · Spee Solutions*
