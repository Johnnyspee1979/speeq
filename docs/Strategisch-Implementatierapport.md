# Strategisch Implementatierapport: De Offline-First Wkb Snap & Sync App

## 1. Executive Summary: De Digitale Antithese voor Administratieve Last
De inwerkingtreding van de Wet kwaliteitsborging voor het bouwen (Wkb) per 1 januari 2024 heeft een asymmetrisch risicoprofiel gecreëerd in de Nederlandse bouwsector. Terwijl grote bouwreuzen hun toevlucht zoeken in logge, kostbare ERP-systemen, loopt de MKB-aannemer in een juridische valstrik. De verschuiving van preventief publiek toezicht naar private kwaliteitsborging legt de volledige operationele druk en de bewijslast bij de aannemer. Zonder onweerlegbare as-built documentatie is de aannemer vogelvrij.

Dit rapport presenteert de Offline-First Wkb Snap & Sync App als de strategische weg naar juridische en financiële ontlasting. In een markt waar faalkostenreductie en ketenintegratie bepalend zijn voor overleven, fungeert onze app als een lichtgewicht compliance-engine. Het dicht het gat tussen de fysieke handeling op de steiger en de administratieve eisen in de directiekamer. Door bewijsvoering te automatiseren, transformeren we een bureaucratische last naar een strategisch voordeel: onweerlegbare data als verzekeringspolis tegen de verruimde aansprakelijkheid.

## 2. De Business Case & Juridische Noodzaak: Van Vertrouwen naar Onweerlegbaar Bewijs
De kern van de Wkb is de transitie van een inspanningsverplichting naar een resultaatverplichting die gedocumenteerd moet zijn. De meest kritieke wijziging bevindt zich in artikel 7:758 BW. Waar de aannemer voorheen na oplevering grotendeels ontslagen was van aansprakelijkheid voor zichtbare gebreken, is hij nu aansprakelijk voor alle gebreken die bij oplevering niet zijn ontdekt, tenzij hij kan bewijzen dat het gebrek hem niet toe te rekenen is.

Artikel 7:757a BW (Consumentendossier) is hierbij essentieel. Dit dossier is niet langer een gunst, maar een wettelijk schild. Het dient om aan te tonen dat het werk voldoet aan de overeenkomst en de Bbl-eisen. Bovendien is de 5%-regeling (opschortingsrecht van de koper) in de praktijk steeds vaker gekoppeld aan de volledigheid van dit dossier. Wie zijn dossier niet op orde heeft, krijgt simpelweg niet volledig betaald.

### Vergelijking Aansprakelijkheid en Bewijslast

| Aspect | Vóór 1 januari 2024 | Onder de Wkb (Huidig) |
| --- | --- | --- |
| Primaire Toezichthouder | Gemeente (Bouwtoezicht) | Private Kwaliteitsborger |
| Aansprakelijkheid na Oplevering | Ontslagen voor ontdekbare gebreken | Aansprakelijk voor álle gebreken (tenzij bewijs van niet-toerekenbaarheid) |
| Bewijslast | Lag bij de opdrachtgever | Ligt bij de aannemer (omgekeerde bewijslast) |
| Dossiervorming | Vrijblijvend / beperkt | Wettelijk verplicht: Consumentendossier & Bevoegd Gezag |
| Financieel Risico | Beperkt tot verborgen gebreken | Volledig: inclusief 5%-stop op betaling bij incompleet dossier |

De juridische definitie van onweerlegbaarheid dicteert de software-eisen: data moet onveranderbaar, tijdgestempeld en contextueel rijk zijn om stand te houden in een rechtszaal.

## 3. Productvisie & Gebruikerservaring (UX): Ontwikkeld voor de Realiteit van de Bouwplaats
Traditionele systemen falen omdat ze ontworpen zijn vanuit een kantoorperspectief. Onze bouwplaats-first benadering erkent dat de vakman op de steiger geen data-entry medewerker is. De focus ligt op het minimaliseren van de administratieve frictie om de adoptiegraad te maximaliseren en faalgaten te dichten.

De drie pijlers van onze UX-strategie:

- **Eenvoud (Dikke Vinger-Interface):** Geen complexe menu's, maar grote, tactiele knoppen die bedienbaar zijn onder alle weersomstandigheden. De interface leidt de gebruiker stapsgewijs door het borgingsplan: de app vertelt de vakman exact welke foto hij op welk moment moet maken.
- **Snelheid (Spraak-naar-Tekst & Bonnetje-Scan):** Notities via spraak, plus een specifieke workflow voor leveringsbonnen (betonkwaliteit, certificaten). Het bonnetje verdwijnt niet meer; het wordt direct onderdeel van het bewijs-as-a-service.
- **Context (Geleide Inspectie & Instant Feedback):** Data is direct gekoppeld aan een controlepunt. AI geeft direct feedback en voorkomt terugkeer naar reeds dichtgebouwde locaties.

## 4. Technische Architectuur & Datamodel: De Garantie op Data-Integriteit
Data-integriteit is in een juridische context binair: aanwezig of waardeloos. Onze architectuur is daarom gebaseerd op een robuust offline-first model met WatermelonDB/SQLite.

### Synchronisatie-Logica
Zodra een foto of document wordt vastgelegd, wordt dit lokaal versleuteld opgeslagen met EXIF-metadata en onveranderbare tijdstempels. Een background worker monitort actief de netwerkstatus. Pas bij een stabiele verbinding wordt de queue via REST API's gepusht naar de cloud, waarna de lokale opslag wordt geschoond.

### Datarijkdom van de Bewijslast (Illustratief Asset Model)

- ID: WKB-2024-TR-001
- Project: 2024-ALFA-MKB
- Timestamp_Fixed: 2024-05-15T10:30:00Z (Verified)
- Geolocation: 52.3676, 4.9041 (Accuracy: 1.2m)
- Category: Constructieve Veiligheid / Wapening Fundering
- Material_Proof: Leveringsbon_Beton_C20-25_Scan_098.pdf
- Metadata: Device_ID: Rugged_X8; OS_Ver: 14.2; EXIF_Integrity: Valid
- Observation: "Wapening gecontroleerd conform tekening v2.1. Afstandhouders geplaatst."

## 5. Integratie & Ecosysteem (API-First): Het Doorbreken van Data-Silo's
Onze strategie is gericht op het voorkomen van vendor lock-in. De app is een centrale spil in een open ecosysteem, wat leidt tot directe kostenbesparingen doordat de kwaliteitsborger minder uren hoeft te besteden aan handmatige controle.

| Koppelvlak (API) | Technologie | Strategisch Doel |
| --- | --- | --- |
| KiK-tool / WKI | REST / JSON | Directe push naar borgingsplan; bespaart uren van de kwaliteitsborger. |
| DSO-LV | PKIoverheid | Garanderen van de 4-weken meldingstermijn en automatische gereedmelding. |
| BIM / IFC | BCF-formaat | Koppelen van veldbewijs aan digitale objecten voor een volledige digital twin. |
| ERP (AFAS/4PS) | Webhooks / OData | Synchronisatie van project- en personeelsgegevens zonder dubbele invoer. |

## 6. Innovatie via AI & Computer Vision: Preventieve Kwaliteitsbewaking
- **Wapening & Dekking Check:** Computer vision analyseert real-time of de wapeningsnetten conform specificaties liggen en of de afstandhouders correct zijn geplaatst.
- **Isolatiedikte & Continuïteit:** AI detecteert kieren in de isolatieschil of onvoldoende dikte, cruciaal voor de BENG-eisen in het Dossier Bevoegd Gezag.
- **Instant Photo-Audit:** De AI-pipeline weigert direct onscherpe of overbelichte foto's met directe feedback aan de vakman.

## 7. Deliverables: Het Dossier Bevoegd Gezag & Consumentendossier
De app is een aggregatie-engine die gedurende de gehele bouw de twee wettelijk vereiste eindproducten voorbereidt.

- **Dossier Bevoegd Gezag (Publiekrechtelijk):** Bewijslast voor de gemeente met verklaring van de kwaliteitsborger, revisietekeningen, BENG-berekeningen en bewijs voor brandveiligheid.
- **Consumentendossier (Privaatrechtelijk):** Conform artikel 7:757a BW. Bevat garantiebewijzen, handleidingen, bonnetjes en onderhoudsvoorschriften en borgt de laatste 5% betaling.

## 8. Strategische Roadmap: Focus op Gevolgklasse 1 en Schaalbaarheid
- **Fase 1:** MVP Gevolgklasse 1 — volledige automatisering van de Wkb-workflow voor grondgebonden nieuwbouw.
- **Fase 2:** AI-optimalisatie — computer vision voor wapenings- en isolatiecontrole.
- **Fase 3:** Schaalvergroting post-2028 — uitbreiding naar Gevolgklasse 2 en 3.

Conclusie: De Offline-First Wkb Snap & Sync App is geen optionele tool, maar een bedrijfskritische noodzaak. Het is een geautomatiseerde, onweerlegbare bewijslast-generator die de aannemer beschermt, de kwaliteitsborger efficiënt maakt en de juridische houdbaarheid van elk bouwproject garandeert.
