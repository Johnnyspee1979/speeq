# Project Initiation & Architecture Report: Offline-First Wkb Snap & Sync App

## 1. Executive Summary: Het Marktgat en de Strategische Oplossing
De inwerkingtreding van de Wet kwaliteitsborging voor het bouwen (Wkb) op 1 januari 2024 markeert de meest ingrijpende institutionele stelselwijziging in de Nederlandse bouwsector sinds 1901. Centraal in deze transitie staat de verschuiving van preventief gemeentelijk toezicht naar private kwaliteitsborging voor Gevolgklasse 1. Deze klasse omvat een breed marktsegment: van grondgebonden woningen en woonboten tot vakantiewoningen en eenvoudige bedrijfspanden van maximaal twee bouwlagen.

Deze stelselwijziging heeft een acuut gat in de markt geslagen. MKB-aannemers en ZZP’ers worden geconfronteerd met een explosieve stijging van de bewijslast. Waar voorheen een vergunning vooraf voldoende was, moet nu tijdens de uitvoering onweerlegbaar worden aangetoond dat het bouwwerk voldoet aan het Besluit bouwwerken leefomgeving (Bbl). Generieke applicaties zoals WhatsApp, Trello of standaard cloud-apps falen hier op twee cruciale punten: zij missen de juridische onweerlegbaarheid (gebrek aan geformatteerde metadata) en bieden geen betrouwbaarheid in de kelders of nieuwbouwwijken waar connectiviteit ontbreekt.

De Offline-First Wkb Snap & Sync App is het strategische antwoord op deze uitdaging. De app transformeert de administratieve last van een moétje naar een digitale verzekeringspolis, waarmee de aannemer zijn vakmanschap juridisch verankert en financiële risico's elimineert.

## 2. De Business Case & Juridische Noodzaak: Van Inspanning naar Bewijslast
De strategische noodzaak voor deze oplossing rust op de ingrijpende wijziging van het privaatrecht, specifiek de aanpassing van artikel 7:758 BW.

### De Omgekeerde Bewijslast en Onweerlegbaar Bewijs
Onder de Wkb is de aannemer voortaan aansprakelijk voor álle gebreken die bij de oplevering niet zijn ontdekt, tenzij hij kan bewijzen dat het gebrek hem niet toe te rekenen is. De bewijslast is hiermee volledig gekanteld. Zonder sluitend digitaal dossier van kritieke onderdelen — zoals de juiste diameter van de funderingswapening of de correcte installatie van isolatie — stelt een aannemer zich bloot aan onbeheersbare financiële claims, zelfs jaren na de feitelijke oplevering.

### De Digitale Verzekeringspolis
In deze context is een digitaal dossier geen nice-to-have meer, maar een dwingende voorwaarde voor de continuïteit van de bedrijfsvoering. De software fungeert als een digitale verzekeringspolis die onweerlegbaar bewijs levert. Dit is essentieel omdat de kwaliteitsborger fysiek slechts bij 10% van de kritieke momenten aanwezig is; de overige 90% moet de aannemer zelf aantoonbaar maken.

## 3. Productvisie & Gebruikerservaring (UX): Ontworpen voor de Modder
Digitale adoptie op de bouwplaats faalt wanneer software is ontworpen vanuit een kantoorperspectief. Onze visie is bouwplaats-centrisch, waarbij de interface is afgestemd op de rauwe realiteit van de uitvoering.

- **De Dikke Vingers Metafoor:** De UX is geoptimaliseerd voor bediening met koude handen, handschoenen of onder vuile omstandigheden. Grote interactiegebieden en een lineaire workflow minimaliseren de cognitieve belasting.
- **Offline-First als Overlevingsstrategie:** In kelders of op afgelegen bouwlocaties is er vaak geen bereik. Terwijl generieke apps dan data verliezen of vastlopen, blijft onze app volledig functioneel. Alle data, inclusief zware foto-bestanden, worden lokaal opgeslagen en gesynchroniseerd via een robuust achtergrondproces zodra verbinding wordt gedetecteerd.
- **Stemgestuurde Rapportage:** Dankzij spraak-naar-tekst functionaliteit kunnen uitvoerders direct bevindingen loggen zonder hun handschoenen uit te trekken, wat de frictie tussen uitvoering en administratie wegneemt.

Als de vakman de app als een last ervaart, blijft het juridische dossier leeg. Daarom is superieure UX direct verbonden met het beperken van juridische aansprakelijkheid.

## 4. Technische Architectuur & Datamodel: De Digitale Ruggegraat
Om juridisch houdbare data te genereren, is de architectuur gebaseerd op een Trust Framework dat de integriteit van elk bewijsstuk waarborgt.

### Architecturale Componenten
- **Juridische Stempels:** Elke opname wordt automatisch verrijkt met onwijzigbare EXIF-metadata, GPS-coördinaten (Georeferencing) en timestamps.
- **Datastructuur (JSON):** Bewijslast wordt opgeslagen in een gestructureerd JSON-formaat dat direct mapt op de risicoanalyse uit het Borgingsplan.
- **Integriteit door Structuur:** Data is machine-leesbaar en gekoppeld aan specifieke inspectiepunten, waardoor de kwaliteitsborger op afstand kan valideren.

Voorbeeld datamodel:
```
{
  "evidenceId": "uuid-1234",
  "projectId": "project-001",
  "inspectionPointId": "kik-wapening-002",
  "media": {
     "uri": "local/path/to/photo.jpg",
     "timestamp": "2026-03-12T10:30:00Z",
     "gps": {
        "lat": 52.3702,
        "lng": 4.8951,
        "accuracy": 3.5
     },
     "exifHash": "sha256-hash-voor-data-integriteit"
  },
  "syncStatus": "PENDING"
}
```

## 5. Integratie & Ecosysteem (API-First): Voorkomen van Silovorming
Interoperabiliteit is cruciaal om vendor lock-in te voorkomen en de efficiëntie voor de aannemer te maximaliseren. Onze API-first strategie zorgt ervoor dat de bewijslast naadloos vloeit tussen aannemer, kwaliteitsborger en overheidsinstanties.

| Koppelvlak | Protocol | Strategisch Doel |
| --- | --- | --- |
| KiK-tool / WKI API | REST / JSON | Directe synchronisatie met de instrumenten van de kwaliteitsborger; voorkomt dubbele invoer. |
| ERP (AFAS, Exact, 4PS) | Webhooks / OData | Automatische koppeling van projectdata, personeel en inkoop (o.a. betonbonnen) aan het Wkb-dossier. |
| DSO-LV | REST / PKIoverheid | Faciliteren van de verplichte meldingen aan de landelijke voorziening van de overheid. |
| BIM/IFC | BCF Integratie | Koppeling van inspectieresultaten en foto's aan specifieke 3D-objecten in het bouwmodel. |

## 6. Innovatie via AI & Computer Vision: Preventieve Kwaliteitsborging
- **Visuele Validatie op Locatie:** AI controleert o.a. wapening- en isolatiespecificaties.
- **Preventieve Waarschuwingen:** Directe feedback bij onscherpe of onvoldoende foto’s.
- **Reductie Faalkosten:** Minder herstelwerkzaamheden door realtime kwaliteitsborging.

## 7. Deliverables: De Geautomatiseerde Dossiers
- **Dossier Bevoegd Gezag (Publiekrechtelijk):** Bewijslast voor de gemeente, inclusief verklaring van de kwaliteitsborger.
- **Consumentendossier (Privaatrechtelijk):** Dossier over feitelijke staat van het bouwwerk conform artikel 7:757a BW.

## 8. Strategische Roadmap: MVP en Toekomstige Schaalbaarheid
- **Fase 1 (MVP):** Nieuwbouw Gevolgklasse 1.
- **Fase 2:** Verbouw & transformatie.
- **Fase 3:** Gevolgklasse 2 & 3 vanaf ~2028.

Een robuuste start in Gevolgklasse 1 legt de basis voor sectorbrede dominantie. Door nu te investeren in data-integriteit en een superieure offline-first ervaring, wordt deze software de nieuwe standaard voor professioneel vakmanschap in de Nederlandse bouw.
