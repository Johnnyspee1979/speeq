# Project Initiation & Architectuur Rapport: Offline-First Wkb Snap & Sync App

_Een strategische blauwdruk voor onweerlegbare bewijslast in de MKB-bouwsector_

## 1. Executive Summary
De inwerkingtreding van de Wet kwaliteitsborging voor het bouwen (Wkb) op 1 januari 2024 heeft een fundamentele verschuiving teweeggebracht in de Nederlandse bouwsector. De cruciale verandering is het verdwijnen van de preventieve technische toetsing door de gemeente voor projecten in Gevolgklasse 1. Dit heeft een gevaarlijk marktgat gecreëerd: de aannemer staat nu “naakt” zonder het publiekrechtelijke schild van de gemeentelijke goedkeuring, terwijl de bewijslast volledig naar de private sector is verschoven.

Terwijl grote bouwconcerns deze druk opvangen met logge, dure ERP‑systemen (zoals AFAS of 4PS), is er een acute behoefte aan een light‑weight oplossing voor MKB‑aannemers en ZZP’ers. Onze “Snap & Sync” applicatie is niet simpelweg de zoveelste projectmanagementtool, maar een onweerlegbare bewijslast‑generator. De strategische waarde ligt in het feit dat hoogwaardige, digitale verslaglegging fungeert als een onderhandelingstool: door de kwaliteitsborger (een commerciële partij met hoge uurtarieven) te voorzien van perfecte data, worden externe inspectiekosten drastisch verlaagd en juridische risico’s afgeboekt.

## 2. De Business Case & Juridische Noodzaak
Digitale verslaglegging is onder de Wkb geen optionale luxe meer, maar een harde voorwaarde voor de bedrijfsvoering. De juridische kern van dit project rust op de ingrijpende wijziging van het Burgerlijk Wetboek.

### Juridische Verschuiving: Artikel 7:758 BW
De omgekeerde bewijslast betekent dat de aannemer aansprakelijk is voor álle gebreken die bij oplevering niet zijn ontdekt, tenzij hij onweerlegbaar kan aantonen dat het gebrek hem niet kan worden toegerekend.

| Aspect | Vóór Wkb (vóór 1 jan 2024) | Na Wkb (vanaf 1 jan 2024) |
| --- | --- | --- |
| Toezichthouder | Gemeente (Bouw‑ en Woningtoezicht) | Private Kwaliteitsborger (Commercieel) |
| Aansprakelijkheid | Ontslagen voor zichtbare gebreken bij oplevering | Aansprakelijk voor álle niet‑ontdekte gebreken |
| Bewijslast | Lag primair bij de opdrachtgever/koper | De facto bij de aannemer (omgekeerde bewijslast) |
| Ingebruikname | Na gereedmelding gemeente | Verboden zonder dossier en borger‑verklaring |

Zonder onweerlegbaar bewijs fungeert de aannemer als zijn eigen verzekeraar voor elk verborgen gebrek. Onze app fungeert als een juridische verzekeringspolis die niet alleen foto’s opslaat, maar ook kritieke documenten zoals betonbonnen (leveringsbonnen) en keuringsrapporten beheert conform het Besluit bouwwerken leefomgeving (Bbl).

## 3. Productvisie & Gebruikerservaring (UX)
De effectiviteit van de software valt of staat bij de acceptatie op de bouwplaats. Onze ontwerpfilosofie gaat uit van de weerbarstige praktijk: tijdsdruk, werkhandschoenen en wisselende weersomstandigheden.

- **Dikke Vingers‑Interface:** Geen complexe dropdown‑menu’s of tekstvelden. Grote, contrastrijke knoppen en een workflow met minimale handelingen.
- **Prescriptieve begeleiding:** Het systeem dwingt de vakman op specifieke momenten (bijv. vóór het storten van beton) om exacte bewijsstukken vast te leggen.
- **Spraak‑naar‑tekst & contextuele fotografie:** Notities worden gedicteerd; foto’s worden automatisch gekoppeld aan het relevante controlepunt in het borgingsplan.

Deze UX‑keuzes verhogen de datakwaliteit bij de bron en reduceren faalkosten direct tijdens uitvoering.

## 4. Technische Architectuur & Datamodel
De app moet functioneren in omgevingen zonder stabiele connectiviteit. Daarom kiezen we voor een offline‑first architectuur in React Native.

### Offline‑First & Sync‑Queue
- **Lokale caching‑laag:** SQLite/WatermelonDB.
- **Sync‑Queue:** Elke opname wordt lokaal opgeslagen als JSON‑object inclusief ruwe media.
- **Background Worker:** monitort netwerkstatus en synchroniseert automatisch naar PostgreSQL/Supabase zodra er verbinding is, waarna lokale opslag wordt geschoond.

### Onweerlegbare Bewijslast: Image Hashing
EXIF: true met GPS‑georeferencing en onveranderbare timestamps. Toevoeging van een **Image Hash (SHA‑256)** garandeert dat de foto na het maken niet is gemanipuleerd.

#### Voorbeeld JSON‑structuur
```
{
  "inspection_id": "WKB-GK1-2024-08",
  "timestamp": "2024-05-15T10:30:05Z",
  "gps_coordinates": {
    "lat": 52.370216,
    "long": 4.895168
  },
  "category": "funderings-wapening",
  "evidence_type": "photo",
  "exif_verified": true,
  "image_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "metadata": {
    "betonbon_ref": "B-2024-9912",
    "contractor_id": "AAN-MKB-01"
  }
}
```

## 5. Integratie & Ecosysteem (API‑First Strategy)
De app fungeert als een doorgangsluik door integratie met drie kritieke koppelvlakken:

- **KiK‑tool API:** Bewijslast direct naar het systeem van de kwaliteitsborger.
- **DSO‑LV API:** Bouwmelding via PKIoverheid‑certificaten; bewaakt 4‑weken termijn.
- **BIM/IFC (BCF‑formaat):** Inspectiepunten gekoppeld aan 3D‑objecten in de Digital Twin.

## 6. Innovatie via AI & Computer Vision
AI valideert visuele data real‑time op de bouwplaats, met focus op verborgen gebreken:

- **Objectherkenning & defectdetectie:** isolatiedikte, wapening, betonmortel.
- **Real‑time validatie:** waarschuwing bij wazige of onbruikbare foto’s voordat de constructie sluit.

## 7. Deliverables: De Geautomatiseerde Dossiers
De backend fungeert als aggregatie‑engine die data vertaalt naar de twee wettelijke einddossiers:

- **Dossier Bevoegd Gezag (publiekrechtelijk):** verklaring kwaliteitsborger, revisietekeningen, BENG‑berekeningen en brandveiligheidsbewijslast.
- **Consumentendossier (privaatrechtelijk):** conform art. 7:757a BW, inclusief onderhoudsvoorschriften, garantiebewijzen en as‑built documentatie.

## 8. Strategische Roadmap (Waarschuwing van de Architect)
- **MVP Focus:** uitsluitend nieuwbouw Gevolgklasse 1.
- **Fase 2 (post‑2028):** uitbreiding naar verbouw en hogere gevolgklassen zodra wetgeving verschuift.
- **Schaalbaarheid:** open standaarden (API‑first en IFC) als basis voor toekomstige normering.

**Slotconclusie:** We bouwen geen administratieve tool; we bouwen een strategisch wapen waarmee de MKB‑aannemer aansprakelijkheid beheerst, faalkosten minimaliseert en zijn positie in de keten versterkt.
