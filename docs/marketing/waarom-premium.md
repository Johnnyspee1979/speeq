# Waarom SpeeQ premium is — en dat ook hoort te zijn

> **Doel:** één pagina die uitlegt waarom SpeeQ duurder is dan Vastlegg en goedkoper dan Ed Controls — én waarom dat klopt
> **Voor:** jezelf (zekerheid bij salesgesprek), klant (na de demo), website-pricing-pagina
> **Datum:** 14 mei 2026

> **Besluit juli 2026:** prijsmodel herzien. Actueel aanbod: 30 dagen gratis proefproject (geen creditcard), **Basis €299/mnd** of €2.990/jr (tot 10 app-gebruikers, 5 actieve projecten), **Professional €599/mnd** of €5.990/jr (tot 25 actieve projecten + integraties zodra live), **Enterprise op maat** via contact. De eerdere Solo (€49)- en Team (€149)-tarieven zijn vervallen; deze pagina is daarop bijgewerkt.

---

## In één zin

> Je betaalt niet voor een Wkb-tool. Je betaalt voor je **eigen kluis in Frankfurt**, voor een **vaste lijn naar de bouwer** en voor **transparantie die de markt niet biedt**.

---

## De prijs naast de markt

| Tool | Wat je krijgt | Eigen DB | Persoonlijk contact | Prijs voor 5 users |
|---|---|---|---|---|
| Vastlegg | ZZP-tool, gedeelde DB | ❌ | ❌ ticket | €29,95 × 5 = **€150** |
| BKapp | MKB-tool, gedeelde DB | ❌ | ❌ ticket | op aanvraag |
| STA Software | MKB-tool, gedeelde DB | ❌ | ❌ ticket | op aanvraag, ~€300+ |
| Ed Controls | Per user, gedeelde DB | ❌ | ❌ helpdesk | €59-82 × 5 = **€295-410** |
| **SpeeQ Team** | **Eigen Supabase + alles inbegrepen** | ✅ | ✅ Johnny | **€149** |

**Conclusie voor de klant:** voor de helft van wat Ed Controls vraagt krijg je méér.

---

## De vijf redenen dat €149 voor Team de juiste prijs is

### 1. Je krijgt een eigen Supabase-database — die kost mij €23/mnd per klant

Geen marketing-trucje. Letterlijk: bij elke nieuwe klant maak ik een aparte Supabase-instance in Frankfurt aan. Eigen Postgres-cluster, eigen storage-bucket, eigen RLS-policies. Dat staat in m'n maandelijkse Supabase-rekening, niet in een ander pakje.

**Wat Vastlegg/STA/BKapp doen:** één gedeelde Postgres-database met een `klant_id` kolom. Goedkoper voor hun, en sneller op te zetten. Maar als hun database wordt ingebroken, lekt alles van alle klanten tegelijk.

**Wat dit voor jou betekent:** als jouw concurrent ook SpeeQ-klant wordt, zit z'n data fysiek op een andere server. Geen `WHERE klant_id =` waar één foutje genoeg is.

### 2. Frankfurt = AVG-veilig, niet Amerika

Je opdrachtgevers (gemeentes, woningcorporaties, projectontwikkelaars met EU-budget) gaan vragen: *"Waar staat onze data?"* — bij SpeeQ kun je een schermafdruk laten zien: Supabase Frankfurt, EU-grond. Geen Schrems-II, geen US Cloud Act, geen "we doen ons best".

### 3. Eén lijn naar de bouwer — geen support-loterij

De eerste 6 maanden heb je mijn 06-nummer. Je belt mij, niet een formulier. Bij Vastlegg/STA bel je een nummer waar iemand zit die nooit code heeft geschreven aan het product. Dat verschil voelt klein, totdat je woensdagavond 19:00 een bug hebt vóór een gemeente-presentatie donderdagochtend.

### 4. Geen "neem contact op voor pricing"

STA en BKapp publiceren geen prijzen. Dat is een manier om hoger te kunnen vragen aan grotere klanten. Bij SpeeQ staat alles publiek op de site. Je weet wat je betaalt vanaf dag 1.

### 5. Het kost mij geld om dit goed te doen

Eerlijk:
- Supabase Pro per klant: €23/mnd
- Mollie (3% transactiekosten): €5-30/mnd
- Mijn tijd voor onboarding (eerste maand): 4-6 uur
- Vaste lijn-support (eerste 6 maanden): 2-3 uur/maand

Bij €99/mnd Team verdien ik €60-70 marge per klant. Bij €149/mnd zit ik op €123. Het verschil zit niet in winst-maximalisatie — het zit in: **kan ik bij klant #15 nog steeds de telefoon opnemen?** Op €99 niet. Op €149 wel.

---

## Wat je niet betaalt

- ❌ Beurs-deelnames waar STA Software op staat (€20-40k/jaar marketing)
- ❌ Sales-team dat op commissie werkt
- ❌ Generic helpdesk in Polen of Bulgarije
- ❌ Verborgen feature-paywall — "branding upgrade", "extra users", "API-toegang"

---

## Aan de klant uit te leggen — pitchformule

> *"Vastlegg kost een tientje. Ed Controls €82 per user. STA en BKapp zeggen het niet. Wij staan ergens daartussen omdat we iets bouwen dat niemand anders bouwt: voor elke klant een eigen database in Frankfurt. Dat kost ons €23 per klant per maand alleen al aan hosting. Daar zit onze prijs op. Geen marketing-marge — gewoon: dit is wat het kost om het zo te doen."*

---

## Bij weerstand op de prijs

**Klant:** "Vastlegg vraagt €30."
**Jij:** "Vastlegg is gemaakt voor de ZZP'er met 1-2 projecten. Jullie hebben straks een opdrachtgever die om jullie verwerkersovereenkomst vraagt — die heeft Vastlegg niet eens publiek staan. Onze hangt als PDF op speesolutions.com/speeq/legal."

**Klant:** "STA is goedkoper denk ik."
**Jij:** "STA's standaardprijs zit rond €300 voor 5 users — vergelijkbaar. Maar bij STA staan jullie foto's in dezelfde database als die van Heijmans of BAM. Bij ons in Frankfurt, jullie eigen kluis."

**Klant:** "Wat als ik over 2 jaar wil overstappen?"
**Jij:** "Dan exporteer je alles als ZIP — borgingsdossiers, foto's, audit-trail. Maandelijks opzegbaar bij Team en Pro. Bij Enterprise jaarcontract maar ook ZIP-export gegarandeerd. We bouwen geen kooi."

---

*Versie 1.0 · 2026-05-14 · Spee Solutions*
