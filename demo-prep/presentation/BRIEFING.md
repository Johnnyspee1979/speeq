# Briefing voor de Combivo-meeting · 29 mei 2026

> Lees dit op de auto/in de wachtkamer. Onder 5 minuten leesbaar.

---

## Met wie zit je aan tafel?

**Aldert Ensing** — DGA + algemeen directeur Combivo Vastgoedonderhoud BV (Rotterdam, KvK 68110480).
Oprichter sinds **17 februari 2017**. ±20 mensen op de loonlijst, 8 op LinkedIn (rest = ZZP/Meestersgilde-flexpool).
Specialisme: **houtrotherstel, gevelrenovatie, MJOP-onderhoud, RGS-projecten**.
Klanten: corporaties, onderwijs (VCL-school Den Haag), beleggers.
Gecertificeerd: VCA, FSC, Repair Care.

**Toon van Aldert:** zakelijk, ambachtelijk, geen hype, oog voor detail.
Past goed bij jouw rustige stijl. Geen pitchen — gewoon zakelijk gesprek.

---

## Wat is hier echt aan de hand?

SpeeQ staat al sinds 19 mei klaar voor Combivo — eigen tenant, eigen logo, eigen kleur.
**Maar:** er zit slechts 1 actieve gebruiker. De Supabase-note zegt het zelf: *"Demo-tenant voor investeerderspresentatie 19-05-2026"*.

→ SpeeQ is voor Combivo nu een **etalagepop**, geen werkende tool.

Dit gesprek gaat dus niet over de tool. Het gaat over **commitment maken**.

**Jouw doel:** vandaag een ja krijgen op een afgebakende pilot (30 dagen, 3 projecten, 8 gebruikers).
**Aldert's twijfel:** "Werkt het echt op mijn bouw, met mijn flexpool?"

---

## Het script (10 slides)

| # | Slide | Wat je zegt |
|---|---|---|
| 1 | Cover — *Van showcase naar productie* | "Dank dat we hier zitten. Vandaag wil ik concrete afspraken maken — geen demo meer." |
| 2 | De tool werkt — 252 foto's, 3 dossiers | "Dit zijn echte cijfers van vandaag uit Supabase. Geen prototype-praat." |
| 3 | Combivo's reis tot nu — showcase | "Sinds 19 mei staat het klaar. Eén gebruiker. Tijd om door te zetten." |
| 4 | De vraag — etalage of werkvloer? | "Drie blokkades vandaag wegnemen: wie / welke projecten / hoe met flexpool." |
| 5 | Voorstel — 30 dagen pilot | "Drie projecten die jij kiest. Acht mensen. Eind juni meten we." |
| 6 | SpeeQ vs concurrenten | "Vastlegg en Ed Controls registreren. SpeeQ valideert met AI." |
| 7 | Drie modules voor Combivo | "MJOP-cyclus, Meestersgilde-rol, corporatie-portaal. In maand 2 live." |
| 8 | Investering — €1.450 pilot · €385/mnd uitrol | "Geen jaarcontract. Opzegbaar per maand. Eerlijk geprijsd." |
| 9 | Roadmap — week 1, dag 30, maand 2, maand 3 | "Geen beloftes. Datums. Maandag start." |
| 10 | Volgende stap — *vandaag handtekening* | "Wat moet ik wegnemen om vandaag ja te horen?" |

**Tijd:** ±20 min inclusief vragen. Niet langer.

---

## Drie openers (alleen één gebruiken)

1. *"Even dit voor we starten — KvK staat in Rotterdam, jullie footer zei Den Haag. Heb ik gisteren even rechtgezet in jullie tenant. Klein detail, jij merkt het waarschijnlijk."*

2. *"De investeerderspresentatie van 19 mei — wat was hun eerste vraag? Daar wil ik mijn pitch op aansluiten."*

3. *"Jullie houtrot-werk bij de VCL-school in Den Haag — gemengd Wkb-project, toch? Precies waar dossiervorming nu lastig wordt."*

---

## Antwoorden op de top-7 vragen die hij gaat stellen

### "Wat als jullie failliet gaan?"
**Antwoord:** *"Eerlijk: dat risico is reëel voor elke eenmanszaak. Daarom zit je data in **jouw** Supabase-tenant. Bij stop krijg je de hele dump in standaard PostgreSQL-export, plus alle foto's als zip. Geen vendor lock-in op database-niveau. Dat staat in onze samenwerkingsovereenkomst."*

### "Wie ziet mijn data?"
**Antwoord:** *"Per tenant scheiding op database-niveau (Supabase Row Level Security). Combivo's data is niet zichtbaar voor andere bouwers. Toegangscode is alleen voor jullie. Supabase-servers staan in Frankfurt — AVG-compliant."*

### "Wat kost het bij 30 gebruikers in plaats van 8?"
**Antwoord:** *"€385 basis (tot 8 users) + €35 per extra user. 30 users wordt €1.155/mnd. Vergelijk: 30 × Ed Controls = €1.770/mnd. Wij goedkoper, en met AI-validatie."*

### "DSO/DigiKoppeling — werkt dat al echt?"
**Antwoord:** *"Configuratie staat. Voor productie-DSO doen we in maand 2 een echte bouwmelding op een echt project. Tot die tijd: je dossier is klaar voor DSO, alleen de submit-knop wachtniet."* (Eerlijk: dit is nog niet live-gevalideerd.)

### "AVG / verwerkersovereenkomst?"
**Antwoord:** *"Standaard SCC + DPA als bijlage bij het contract. Bouwfoto's = bedrijfsdata, geen persoonsgegevens, tenzij toevallig iemand in beeld staat. Vakman krijgt instructie."*

### "Wat als de AI een foto fout goedkeurt?"
**Antwoord:** *"Goede vraag. De AI is een filter, geen rechter. Bij 65-85% confidence komt-ie altijd bij de projectleider. Alleen >90% gaat door zonder mens. En de KB heeft altijd het laatste woord. Wij houden alle versies, dus terugdraaien kan."*

### "Hoe gaat het met Meestersgilde-mensen?"
**Antwoord:** *"In de pilot kunnen externe vakmannen tijdelijk inloggen op project-niveau. In maand 2 bouwen we de echte flexpool-rol: één klik en een vakman heeft toegang tot één project, automatisch revoked bij afronding."*

---

## Wat te DOEN voor je vertrekt

- [ ] Telefoon vol opgeladen, 4G aan
- [ ] Demo-account ingelogd in Safari op telefoon (vakman-rol)
- [ ] Demo-account ingelogd in Chrome op laptop (projectleider-rol)
- [ ] Deze presentatie open op `file:///` of via lokale server (`cd presentation && python3 -m http.server 8000`)
- [ ] **Briefing 2× lezen onderweg.**
- [ ] Een echte foto die ochtend maken van een willekeurig "inspectiepunt" → laat in demo zien als "vers van vandaag"
- [ ] Railway-credit nog steeds bijgeladen? (`speedy check`)

---

## Wat je NIET doet

- ❌ Niet over admin/maker-paneel beginnen (extra crash-vector)
- ❌ Niet over DSO-live-demo (niet bewezen)
- ❌ Niet meer dan 3 features tegelijk noemen
- ❌ Niet over toekomst-roadmap voorbij maand 3 (te speculatief)
- ❌ Niet zelf de prijs aftellen ("eigenlijk zou het meer mogen kosten") — je prijs is je prijs
- ❌ Niet "we kunnen ook X aanpassen" — je hebt een prijslijst, hou je eraan

---

## Als hij JA zegt

Pak agenda → boek maandag 12:00 een 15-min telefoon-call in om kickoff-details af te kaarten.
Stuur direct na de meeting de samenwerkingsovereenkomst per mail.
Hou de 30-dagen-klok bij vanaf de dag van de eerste vakman-login, niet vanaf de mail.

## Als hij NEE zegt

Vraag: *"Wat is het belangrijkste blok? Te duur, te risicovol, te vroeg, of iets anders?"*
Spreek een gespreks-vervolg af binnen 2 weken. Geen aandringen.
Dan: schrijf binnen 24u een korte mail met de specifieke pain die hij noemde, en hoe SpeeQ daar in maand X klaar voor is.

---

*Veel succes morgen. Je hebt 252 echte foto's aan je kant.*
