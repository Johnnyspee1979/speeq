# Pomelli — Merkverhaal SpeeQ (paste-klaar)

> **Wat dit is:** plain-prose tekst om te plakken in het "Over uw merk"-veld van Pomelli (Google Labs).
> **Lengte:** 7.142 tekens.
> **Versie:** 1.0 · 2026-05-20

---

SpeeQ is een Nederlandse Wkb-borgingstool, gemaakt door Spee Solutions in Den Haag. Spee Solutions is de eenmanszaak van Johnny Spee, IT-consultant met meer dan vijftien jaar ervaring in bedrijfssoftware voor het Nederlandse mkb. SpeeQ is zijn eigen product. Geen team van veertig mensen, geen Amerikaanse investeerders, geen vertaalde Engelse software. Wie SpeeQ koopt, koopt Johnny's professionele oordeel verpakt in een werkende applicatie.

SpeeQ helpt aannemers met vijf tot vijftig medewerkers om te voldoen aan de Wet Kwaliteitsborging voor het Bouwen (Wkb). Sinds januari 2024 is deze wet verplicht voor alle bouwprojecten in Gevolgklasse 1 — vooral woningen en kleinschalige utiliteit. De aannemer moet kunnen bewijzen dat hij volgens de regels heeft gebouwd. Dat heet het borgingsdossier en bevat per project tussen de tachtig en tweehonderdvijftig vastleggingen: foto's van controlemomenten, GPS-coördinaten, weersomstandigheden, akkoord van de werkvoorbereider en soms een digitale handtekening van de klant.

Zonder een tool als SpeeQ wordt dit handmatig bijgehouden in Excel, Dropbox en WhatsApp-groepen. Werkvoorbereiders zijn er uren per week aan kwijt. Foto's raken zoek. Eén uitvraag van een verzekeraar of opdrachtgever, en het dossier blijkt onvolledig.

SpeeQ lost dit op in drie tikken. De vakman opent de app, maakt foto's van het controlemoment, en de app voegt automatisch GPS-locatie, KNMI-weergegevens, datum, tijd en gebruiker toe. Een AI-controle kijkt mee en bepaalt of het materiaal akkoord is, controle nodig heeft, of duidelijk niet akkoord is. De werkvoorbereider beoordeelt op kantoor via een desktopdashboard. Aan het einde van het project genereert SpeeQ automatisch het complete borgingsdossier als PDF, met het logo van het bedrijf erop. Klaar voor de Wkb-borger.

Het kerndifferentiator van SpeeQ tegenover de bestaande concurrenten — STA Software, Vastlegg en BKapp — is een architectonisch detail dat zelden ter sprake komt. Bij die concurrenten staat de data van iedere klant in dezelfde Postgres-database. De scheiding tussen klanten wordt afgedwongen via Row-Level Security, een filter dat per query draait. Werkt prima zolang het werkt. Eén configuratiefout en data lekt. Voor de bouwsector — waar projecten, marges en klantadressen concurrentiegevoelig zijn — een afweging om bewust te maken.

Bij SpeeQ krijgt elke klant een eigen Supabase-database in Frankfurt. Fysiek apart. Geen gedeelde tabellen. De aannemer is niet de twintigste klant in een gedeelde tabel, hij is klant nummer een in zijn eigen database. De analogie: dit is uw eigen kluis in een bankgebouw, niet een vakje in een gedeelde safe-deposit. Iedereen zit in hetzelfde gebouw, maar in zijn eigen ruimte. Voor tachtig procent van de aannemers maakt dit geen zichtbaar verschil in het dagelijkse werk. Voor de twintig procent waar wél eens een uitvraag komt van een opdrachtgever, een verzekeraar of een advocaat — die vraag is dan in drie minuten beantwoord.

Daarbovenop: Frankfurt valt onder EU-grondgebied, AVG-conform, geen Schrems-II-risico zoals bij Amerikaans-gehoste SaaS. Geen verborgen meerkosten — wat bij andere leveranciers een dure enterprise-meerkost is, is bij SpeeQ inbegrepen in de standaard abonnementsprijs.

SpeeQ kent drie pakketten. Team kost honderdnegenenveertig euro per maand voor maximaal vijf gebruikers. Pro kost tweehonderdnegenennegentig euro per maand voor maximaal vijftien gebruikers, met eigen branding op de PDF's en een vaste supportlijn. Enterprise begint vanaf achthonderdnegenennegentig euro per maand met onbeperkt aantal gebruikers, SLA en custom-integraties. De eerste drie klanten krijgen een founder-deal: twaalf maanden Pro voor Team-prijs. Een proefperiode van dertig dagen met volledige Pro-toegang vraagt geen creditcard vooraf.

De typische SpeeQ-klant is een aannemer met vijf tot vijftig medewerkers, eigenaar tussen de vijfendertig en zestig jaar, vooral actief in woningbouw, kleinschalige utiliteit of verbouw. Niet de allergrootste bouwbedrijven met eigen IT-afdelingen, maar ook niet de zzp'er met één busje. De doelgroep is bereid premium te betalen voor iets dat gewoon werkt, en waar ze een vaste contactpersoon kunnen bellen. De beslisser is meestal de directeur-eigenaar. De interne kampioen — degene die de tool intern aanbeveelt — is de werkvoorbereider die nu donderdagavond met Excel worstelt.

De toon van SpeeQ is rustig, no-nonsense en Hollands nuchter. Liever stil overtuigend dan luid. Geen Amerikaans verkooppraat, geen Engelstalige termen waar Nederlands volstaat, geen overdreven enthousiasme. De aanspreekvorm is u in formele communicatie, je in product-UI waar een vakman op de bouwplaats zich anders niet thuis voelt. Geen uitroeptekens in voice-over of headlines. Korte zinnen. Daarna een langere. Dan weer kort.

Toegestane woorden: betrouwbaar, veilig, duidelijk, Nederlands gemaakt, persoonlijk, uw eigen, afgescheiden, premium, transparant, nuchter, voor u gebouwd. Verboden woorden: revolutionair, game-changer, next-generation, disruptive, innovatief, naadloos, krachtig, modern, oplossing, ecosysteem, empower, enable, unlock, scale, growth-hack. Concurrenten worden niet met naam aangevallen — STA, Vastlegg en BKapp zijn collega-leveranciers met een andere architectonische keuze. De boodschap is nooit dat zij slecht zijn, maar dat SpeeQ anders is gebouwd en welke afweging dat impliceert.

De visuele identiteit volgt het Warm Minimal-systeem. Crèmekleurige achtergronden in plaats van puur wit, antraciet voor hoofdtekst in plaats van puur zwart, gedempt bosgroen voor goedgekeurd, terracotta voor actie vereist, warm beige voor borders. Geen techno-blauw, geen neon-accenten, geen donkere dark modes. Headlines in Playfair Display Bold + Italic, body en data in Inter. Beeldmateriaal toont schermopnames van de app, Nederlandse bouwplaats-context met helmen en plattegronden, mkb-kantoor in een rijtjespand. Geen stockfoto's van handenschuddende mannen in pakken, geen figuurtjes met laptops in glazen tower.

De primaire call-to-action is altijd: plan een demo van twintig minuten. Johnny belt vervolgens persoonlijk binnen één werkdag. Geen call-center, geen sales-development-rep, geen scripted intake. Bij akkoord staat de workspace binnen vierentwintig uur klaar in Frankfurt. De eerste week volgt een kickoff-call van dertig minuten om samen het eerste project op te zetten. De eerste zes maanden krijgt de klant een directe lijn naar Johnny voor support — geen ticket-systeem.

De primaire URL is speesolutions.com/speeq. Johnny is bereikbaar op johnny@speesolutions.com en op +31 6 81908480. SpeeQ wordt uitsluitend in Nederland verkocht, in het Nederlands, via directe sales. Geen reseller-net, geen marketplace, geen white-label-deals waarbij de naam verdwijnt.

---

*Versie 1.0 · 2026-05-20 · Pomelli merkverhaal voor SpeeQ*
