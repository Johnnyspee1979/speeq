# SpeeQ — Brand DNA voor Pomelli (Google Labs)

> **Doel:** complete brand-briefing om te plakken in Pomelli (Google Labs' AI-tool voor ad-campagnes). Bevat wie/wat/waar/hoe/wanneer + voice + visuele identiteit + claims.
> **Versie:** 1.0 · 2026-05-20

---

## 1. Wie

**Bedrijf**: Spee Solutions — eenmanszaak, opgericht door Johnny Spee, Den Haag (Nederland).
**Product**: SpeeQ, een Wkb-borgingstool voor de Nederlandse bouwsector.
**Eigenaar/founder**: Johnny Spee, IT-consultant met 15+ jaar achtergrond in bedrijfssoftware voor het MKB. SpeeQ is zijn eigen product — geen team van 40, geen VC, geen Engelse marketing-laag.
**Bereikbaar**: johnny@speesolutions.com, +31 6 81908480, speesolutions.com/speeq.

## 2. Wat

Een Nederlandse SaaS-applicatie waarmee aannemers de wettelijke Wkb-bewijslast (Wet Kwaliteitsborging voor het Bouwen) per project digitaal vastleggen, borgen en exporteren als juridisch geldig PDF-dossier.

Werkt zowel op de bouwplaats (telefoon: foto's met automatische GPS + weergegevens) als op kantoor (laptop: dashboard, beoordeling, exports).

## 3. Waar

**Markt**: Nederland, uitsluitend. Geen export-ambitie, geen meertalig product.
**Geografisch**: SaaS — alle Nederlandse provincies. Klant-data fysiek in Frankfurt, AVG-conform (EU-grondgebied, geen Schrems-II-risico).
**Verkoopkanaal**: Direct via speesolutions.com/speeq + persoonlijke demo. Geen reseller-net, geen marketplace.

## 4. Voor wie (doelgroep)

Eén concrete persona: **Jan, 52, directeur-eigenaar van een aannemersbedrijf met 18 vakmensen in Brabant.**

- Bedrijven met **5 tot 50 medewerkers** (mkb)
- Eigenaren/directeuren tussen 35-60 jaar
- Vooral specialisten in woningbouw, kleinschalige utiliteit, verbouw
- Hebben sinds 2024 te maken met verplichte Wkb-administratie
- Werken nu met Excel, WhatsApp-foto's, gedeelde Dropbox — of een gedeelde tool zoals STA Software, Vastlegg of BKapp
- Bereid premium te betalen voor iets dat **gewoon werkt** en waar ze een vaste persoon kunnen bellen
- Hebben geen behoefte aan "platforms" of "ecosystemen" — willen 1 tool die de Wkb-pijn wegneemt

## 5. Waarom (probleem dat we oplossen)

Sinds 1 januari 2024 is de Wkb verplicht voor alle bouwprojecten in Gevolgklasse 1 (woningen, kleine utiliteit). De aannemer moet kunnen bewijzen dat hij volgens de regels heeft gebouwd — per project tussen de 80 en 250 vastleggingen: foto's, GPS-coördinaten, weersomstandigheden, akkoord van de werkvoorbereider, soms digitale handtekening van de klant.

Zonder tool: handmatig in Excel + Dropbox + WhatsApp. Foutgevoelig, uren werk per week van de werkvoorbereider, dossiers niet doorzoekbaar, geen audit-trail.

## 6. Hoe — wat is er ánders aan SpeeQ

**Kernboodschap (één zin)**: *"Bij SpeeQ krijg je een eigen database in Frankfurt — jouw data zit niet in dezelfde tabel als die van je concurrenten."*

Concurrenten (STA, Vastlegg, BKapp) bouwen op gedeelde Postgres-databases met Row-Level Security per klant. Werkt prima zolang het werkt, maar één configuratie-fout en data kan lekken. Voor bouw — waar projecten, marges en klantadressen concurrentiegevoelig zijn — een afweging om bewust te maken.

SpeeQ levert elke klant een **eigen Supabase-instance in Frankfurt**. Fysiek gescheiden. Inbegrepen in de abonnementsprijs, geen enterprise-meerkosten. Voor 80% van de aannemers maakt het geen zichtbaar verschil; voor de 20% waar wél eens een uitvraag komt van een opdrachtgever of verzekeraar — die vraag is dan in drie minuten beantwoord.

**Bank-analogie**: dit is jouw eigen kluis bij ABN, niet een vakje in een gedeelde safe-deposit.

## 7. Wanneer — context & timing

- **Wkb verplicht sinds 1 jan 2024** — markt is volwassen genoeg om SaaS te accepteren
- **Boetes lopen op**: vanaf 2025 gaan inspecties strenger controleren
- Pomelli-campagne nu = juiste timing, de wet zit "in de heupen" van aannemers
- Demo's mogen ingaan op de **boetes-vermijding** als praktisch argument

## 8. Met wat — de werkstroom

| Wie | Wat | Resultaat |
|---|---|---|
| Vakman op bouwplaats | Opent SpeeQ-app, maakt foto van controlemoment | Auto-toegevoegd: GPS, KNMI-weer, datum, tijd, gebruiker |
| AI-precheck | Bepaalt: groen (akkoord), oranje (twijfel), rood (niet akkoord) | Werkvoorbereider krijgt alleen oranje/rood, geen ruis |
| Werkvoorbereider | Beoordeelt via desktop-dashboard, keurt af/goed | Audit-trail vastgelegd |
| Klant/opdrachtgever | Tekent wijzigingen via publieke link | Juridische verklaring opgeslagen |
| Eind project | Genereert PDF-borgingsdossier met klant-logo | Klaar voor Wkb-borger |

## 9. Door wie — beslisser & influencer

- **Beslisser**: directeur-eigenaar (Jan, persona hierboven)
- **Influencer**: werkvoorbereider (degene die nu met Excel worstelt — díe is de interne kampioen)
- **Eindgebruiker**: vakman op bouwplaats (3 tikken op telefoon, daarna klaar)

## 10. Prijs & aanbod

| Pakket | Prijs/maand | Gebruikers |
|---|---|---|
| Team | €149 | tot 5 |
| Pro | €299 | tot 15 + eigen branding op PDF + vaste supportlijn |
| Enterprise | vanaf €899 | onbeperkt + SLA + custom |

**Founder-deal**: eerste 3 klanten 12 maanden Pro voor Team-prijs (€149 ipv €299).
**Gratis trial**: 30 dagen Pro-toegang, geen creditcard vereist.
**Persoonlijk**: Johnny belt je zelf, geen call-center.

## 11. Bewijspunten / proof

- Eigen Supabase-database per klant in Frankfurt — concurrent doet dit niet
- AVG-conform: EU-grondgebied, geen Schrems-II-risico
- Workspace klaar binnen 24 uur na akkoord
- Eerste 6 maanden: directe lijn naar de oprichter
- Nederlandstalig product (UI, documentatie, support) — geen vertaalde Engelse software

## 12. Voice & tone (essentieel voor Pomelli's ad copy)

**Toon**: rustig, no-nonsense, Hollands nuchter. Liever stil overtuigend dan luid.

**Aanspreekvorm**: "u" (formeel, zakelijk). Bij sociale ads kan "je" — maar nooit jolig.

**Wel gebruiken**: betrouwbaar, veilig, duidelijk, Nederlands gemaakt, persoonlijk, "uw eigen", afgescheiden, premium, transparant, nuchter, voor u gebouwd.

**Nooit gebruiken**: revolutionair, game-changer, next-generation, disruptive, innovatief (cliché), naadloos, krachtig, modern (cliché), oplossing (vaag), ecosysteem, empower, enable, unlock, scale, growth-hack.

**Geen uitroeptekens** in voice-over of headlines.

## 13. Visuele identiteit

| | |
|---|---|
| Primary | Navy `#0B2545` |
| Background | Cream `#FAF7F2` of `#FBF6EE` |
| Accent | Goud `#C9A961` |
| Geen | Puur wit `#FFFFFF`, puur zwart `#000000`, techno-blauw |
| Headlines | Playfair Display, Bold + Italic |
| Body | Inter, regular |

**Beeld**: schermopnames van de app, Nederlandse bouwplaats-context (helmen, schaft, plattegronden, fundering), mkb-kantoor in een rijtjespand.

**Geen**: stockfoto's van handenschuddende mannen in pakken, figuurtjes met laptops in glazen tower, sliders, swooshes, neon-accenten.

## 14. Concurrentie — hoe te benoemen

- STA Software, Vastlegg, BKapp = collega-leveranciers, geen vijanden
- **Geen logo's** van concurrenten in onze ads
- **Geen** vergelijkingstabellen waarin SpeeQ "wint"
- **Wel**: feitelijke verschillen ("eigen database vs gedeelde database") zonder oordeel
- Boodschap: "wij hebben anders gekozen — sommige klanten waarderen dat verschil"

## 15. Call-to-action

**Voorkeur**: "Plan een 20-min demo" — Johnny belt persoonlijk binnen 1 werkdag.
**Tweede**: "Bekijk hoe het werkt" — link naar 5-minuten productvideo.
**Niet**: "Start nu gratis trial" — voelt te SaaS-amerikaans.

**URL**: speesolutions.com/speeq

## 16. Wat Pomelli mag aannemen

- Doelgroep is **B2B mkb**, geen consumenten
- Markt is **rijp**: aannemers wéten dat Wkb verplicht is, hoeven we niet uit te leggen
- Campagne-doel: **leads naar 20-min demo**, niet directe conversies
- Budget per lead: tot **€80** acceptabel (klantwaarde > €5.000/jaar)
- Kanalen: LinkedIn (zakelijk), vakbladen-display (Cobouw, BouwTotaal), Google Search op Wkb-termen

---

*Versie 1.0 · 2026-05-20 · Pomelli-briefing voor SpeeQ ad-campagne*
