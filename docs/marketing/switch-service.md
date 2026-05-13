# SpeeQ Switch Service

> Hoe een klant van een andere Wkb-tool naar SpeeQ overstapt zonder data of slaap te verliezen.
> Versie 1.0 · 2026-05-13

## Waarom dit document bestaat

Klanten blijven bij hun oude Wkb-tool door **drie dingen** — niet door tevredenheid:
1. **Schrik** voor dataverlies
2. **Onduidelijkheid** over hoeveel werk migratie is
3. **Geen tijd** om het uit te zoeken

Wie deze drie wegneemt **wint** de switch. Dit document is dat antwoord.

## Het 5-fasen proces

### Fase 1 — Discovery (30 min, gratis)

**Wie:** Johnny + klant via videocall.

**Wat we vragen:**
- Welke tool gebruik je nu? (STA / Vastlegg / BKapp / Esites / Excel / anders)
- Hoeveel actieve projecten heb je daarin?
- Schatting aantal foto's totaal? (5 / 50 / 500 / 5.000)
- Lopende dossiers: hoeveel zijn er mid-project, hoeveel zijn al afgerond?
- Gewenste live-datum op SpeeQ?
- Aantal gebruikers die mee over gaan?

**Wat klant krijgt:**
- Schatting van migratie-tijd
- Bevestiging welke data wel/niet meegenomen kan worden
- Volgende stap-mail met alle benodigde acties

### Fase 2 — Data-export bij oude leverancier (5–15 werkdagen)

**Wie doet wat:**
- Klant: stuurt AVG-mail naar oude leverancier (template hieronder)
- Johnny: standby voor support als leverancier dwarsligt

**Wat klant terugkrijgt van oude leverancier:**
- ZIP met foto's (.jpg of .png met EXIF-data voor datum/locatie)
- Excel/CSV met projectlijst en meta-data
- Lopende dossiers als PDF
- Gebruikerslijst

**Termijn:** 30 dagen wettelijk (AVG art. 20). In praktijk levert STA / Vastlegg / BKapp meestal binnen 5–10 werkdagen.

### Fase 3 — Migratie-setup (1–4 uur Johnny-werk per klant)

**Achter de schermen, klant merkt hier niks van:**
1. Nieuwe Supabase-omgeving aanmaken via seed-script
2. Project-structuur 1-op-1 overnemen uit Excel
3. Foto's bulk-uploaden naar Supabase Storage
4. Meta-data koppelen (datum, locatie, project)
5. Lopende PDF-dossiers toevoegen als "archief" per project
6. Tenant-config registreren in master-Supabase
7. Klant-slug aanmaken (bv. `?t=jansen`)
8. Logo + branding instellen

### Fase 4 — Paralleldraaien (1–2 weken)

**Beide tools tegelijk gebruiken:**
- Nieuwe foto's vanaf go-live direct in SpeeQ
- Lopende projecten mogen óók in oude tool blijven
- Klant heeft 14 dagen zekerheid: kan altijd terug

**Wat Johnny levert:**
- 1 uur training-sessie (Zoom of on-site bij Enterprise)
- E-mail support op werkdagen
- Acceptatietest met klant na week 1

### Fase 5 — Definitief overstappen

**Wat klant doet:**
- Oude tool opzeggen (per maandeinde of einde contractperiode)
- AVG-vernietigingsverzoek sturen naar oude leverancier (template hieronder)

**Wat Johnny doet:**
- 30 dagen extra support na go-live
- Garantie: alle data check op compleetheid
- "Welkom-pakket" e-mail met handleiding

---

## Template-mail 1 — Dataportabiliteit aanvragen

> Klant kopieert dit, vult [PLAATSHOUDERS] in, stuurt naar privacy@oude-leverancier.nl.

```
Onderwerp: Verzoek tot dataportabiliteit ex art. 20 AVG

Geachte heer/mevrouw,

Hierbij doe ik namens [BEDRIJF_KLANT] een verzoek tot uitoefening van mijn
recht op dataportabiliteit op grond van artikel 20 van de Algemene
Verordening Gegevensbescherming (AVG).

Het verzoek betreft alle persoonsgegevens, projectgegevens en aan onze
account gekoppelde foto's en dossiers binnen [NAAM OUDE TOOL], voor het
account met klantnummer [KLANTNUMMER] / e-mail [E-MAIL].

Concreet ontvang ik graag:
- Alle foto's in oorspronkelijk formaat (.jpg/.png) inclusief EXIF-data
- Projectlijst met meta-data in machineleesbaar formaat (CSV/Excel/JSON)
- Lopende en afgeronde Wkb-dossiers in PDF-formaat
- Lijst van geregistreerde gebruikers en hun rollen

Conform art. 12 lid 3 AVG verzoek ik u dit binnen 30 dagen na ontvangst
te leveren via een beveiligde downloadlink of versleutelde ZIP.

Indien u meer tijd nodig heeft, verzoek ik u dat schriftelijk te
motiveren conform art. 12 lid 3.

Met vriendelijke groet,

[NAAM]
[FUNCTIE]
[BEDRIJF_KLANT]
[CONTACT]
```

## Template-mail 2 — Vernietiging na overstap

> Klant stuurt dit ná succesvolle migratie naar oude leverancier.

```
Onderwerp: Verzoek tot vernietiging ex art. 17 AVG

Geachte heer/mevrouw,

Onze samenwerking met [NAAM OUDE TOOL] is beëindigd per [DATUM].

Op grond van artikel 17 AVG ("recht op vergetelheid") verzoek ik u alle
persoonsgegevens, projectgegevens, foto's en dossiers gekoppeld aan ons
account permanent te vernietigen, inclusief back-ups.

Ik verzoek u een schriftelijke vernietigingsverklaring te leveren binnen
14 dagen na uitvoering, met vermelding van:
- Datum van vernietiging
- Welke systemen en back-ups zijn opgeschoond
- Eventuele wettelijke bewaartermijnen die u nog verplichten gegevens te
  bewaren (en welke termijn dit betreft)

Met vriendelijke groet,

[NAAM]
[BEDRIJF_KLANT]
```

---

## Prijsstructuur

| Pakket | Migratie-prijs | Inhoud |
|---|---|---|
| **Solo** | Self-service (gratis guide) | Stap-voor-stap handleiding + e-mail support bij vragen |
| **Team** | **€295 eenmalig** | Volledige Switch Service door Johnny |
| **Pro** | **Gratis** | Volledige Switch Service + 1u training + branding setup |
| **Enterprise** | **Gratis** | Switch Service + on-site training + dedicated migratie-contact |

**Strategisch effect:** Switch Service als upsell-trigger van Team naar Pro. €50/maand verschil betaalt zichzelf terug in 6 maanden door bespaarde €295 eenmalige migratie-fee.

## Wat we NU nog niet kunnen (eerlijk)

Op 2026-05-13 hebben we **geen bulk-import tool**. Klant #1 doet Johnny handmatig:
- Inschatting: 4–8 uur werk voor 50 projecten + 1.000 foto's

**Roadmap:**
- Klant #1: handmatig — leren van de werkelijke data-vorm
- Tussen #1 en #2: bouw eenvoudig import-script (4–8 uur werk)
- Klant #2 en verder: 30 min werk per migratie

Vertel klant #1 dit eerlijk: *"Jij bent onze eerste migratie-klant. We doen extra ons best, en als beloning krijg je 50% korting op je eerste 6 maanden Pro."*

## Wat we NIET beloven

- ❌ **100% data-overname** — sommige propietaire velden (bv. STA's interne checklist-formaten) zijn niet over te zetten. We zetten dan een PDF in het archief.
- ❌ **Levering binnen 24u na export** — afhankelijk van oude leverancier
- ❌ **Behoud van alle gebruikersaccounts** — wachtwoorden moeten opnieuw door gebruikers worden ingesteld (security best practice)
- ❌ **Realtime sync tussen oude en nieuwe tool** — paralleldraaien is dubbele invoer

## Hoe je dit verkoopt

In je founder-mail of demo:

> *"De grootste vraag bij overstappen is: 'wat gebeurt er met mijn data?'.
> Wij hebben daarvoor de SpeeQ Switch Service: jij stuurt één AVG-mail naar je huidige leverancier (template krijg je van mij), die levert binnen 30 dagen je data, en wij regelen de rest. Bij Pro doen we dit voor je gratis. Je hebt op 1 september €0 betaald aan migratie en draait voor 100% op SpeeQ."*

Of korter (1-liner voor LinkedIn):

> *"Switchen naar SpeeQ kost jou één mail. De rest doen wij."*

---

## Operationele checklist voor Johnny

**Bij elke nieuwe Switch Service-klant:**

- [ ] Discovery-call gepland (30 min)
- [ ] AVG-mail-template doorgestuurd aan klant
- [ ] Wachtdatum genoteerd (30 dagen vanaf verstuurmoment)
- [ ] Supabase-seed klaargezet voor de klant-slug
- [ ] Branding-elementen ontvangen (logo, footer-tekst)
- [ ] Data van oude leverancier binnen → controleer of compleet
- [ ] Migratie uitgevoerd → klant gemaild met testlink
- [ ] Training-sessie ingepland
- [ ] 14-dagen paralleldraaien gestart
- [ ] Go-live gepland
- [ ] Klant herinnerd aan vernietigingsverzoek bij oude leverancier
- [ ] 30 dagen na go-live: tevredenheids-check + vraag testimonial

---

**Vorige:** [concurrentie-munitie](concurrentie-munitie.md) · **Terug naar:** [handboek README](../handboek/README.md)
