# SpeeQ SaaS & Structura Wkb - Architecture Design

## 1. Naamgeving & Branding
- **De App (Mobiele Frontend):** `Structura Wkb` (Powered by SpeeQ). Dit is de professionele app voor bouwers en kwaliteitsborgers.
- **Het SaaS Beheer & Master Dashboard:** `SpeeQ`. Dit is het overkoepelende merk van SpeeSolutions waarmee de licenties worden verkocht.
- **Sales (Front Page):** Er komt een commerciële landingspagina voor SpeeQ om het product als veilige B2B SaaS in de markt te zetten.

## 2. Architectuur (Multi-Instance / Single-Tenant)
We hanteren een architectuur die 100% data-privacy voor de klant garandeert en tegelijkertijd centraal beheer voor SpeeSolutions mogelijk maakt.

- **Databases:** Elk bedrijf (tenant) krijgt zijn eigen, fysiek gescheiden Supabase project. SpeeSolutions heeft geen toegang tot de ruwe data (foto's, dossiers) in deze projecten.
- **Master Database:** SpeeSolutions heeft één "Master" Supabase/Database waar uitsluitend licentiegegevens in staan: `Bedrijfs-ID`, `Naam`, `Supabase_URL`, en `Supabase_Key`.
- **Backend API:** Één centrale Node.js backend op Railway voor routering en zware processen, die dynamisch de verbinding opzet afhankelijk van welke klant er verzoeken stuurt.
- **Frontend App:** Één master Expo/React Native applicatie. De app is "dom" totdat de gebruiker inlogt met een `Bedrijfs-ID`.

## 3. Data Flow (De Inlog Flow)
1. Klant opent `Structura Wkb`.
2. Klant vult zijn `Bedrijfs-ID` en `Wachtwoord` in.
3. De app stuurt een verzoek naar de SpeeQ Master Backend.
4. De Master Backend valideert de inlog en retourneert de specifieke `Supabase URL` en `Supabase Anon Key` van dat bedrijf.
5. De app instantiëert de Supabase/WatermelonDB client dynamisch met deze gegevens (`createClient(url, key)`).
6. Vanaf dit moment praat de app uitsluitend en rechtstreeks met de privé database van het bedrijf.

## 4. Master Dashboard (SpeeQ Cockpit)
SpeeSolutions krijgt een overkoepelend web-dashboard met de volgende functionaliteit:
- Aanmaken van nieuwe klanten (tenants) en genereren van hun connectiegegevens.
- Activeren, schorsen of verwijderen van licenties (Bedrijfs-ID's).
- Beheer van binnenkomende klachten/support-tickets van klanten.
- Geen inzage in de Wkb dossiers (Privacy By Design).

## 5. Updates Pushen
Wijzigingen aan de App worden gedaan in de Master Codebase.
Via **Expo Updates (OTA)** wordt een nieuwe JS bundel gepusht. Zodra gebruikers de app herstarten, draaien ze de nieuwste code. De app haalt vervolgens weer netjes zijn specifieke database connecties op. Omdat databases identiek gestructureerd zijn (alleen fysiek gescheiden), werken de updates vlekkeloos over alle klanten heen.
