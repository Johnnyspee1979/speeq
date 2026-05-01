# Wkb Snap & Sync — Elevator Pitch

## 🏗️ Het concept
De Wkb Snap & Sync app is een offline‑first oplossing voor Gevolgklasse 1 bouwprojecten. De app is ontworpen voor de bouwvakker op de steiger: grote knoppen, minimale frictie, en 100% betrouwbaar zonder bereik. Bewijslast wordt juridisch houdbaar vastgelegd met GPS, EXIF‑data en tijdstempels, zodat de aannemer aantoonbaar kan voldoen aan de omgekeerde bewijslast (art. 7:758 BW).

## ⚙️ De 5 architectonische pijlers

1. **Veld‑camera (onweerlegbaar bewijs)**
   Elke foto wordt vastgelegd met GPS‑coördinaten en een onveranderlijke tijdstempel (EXIF). Dit borgt juridische houdbaarheid.

2. **Offline‑first kluis (SQLite)**
   Bewijs wordt direct lokaal opgeslagen. De app blijft werken in een betonnen kelder zonder 4G.

3. **Asynchrone sync‑engine (Supabase)**
   Zodra er verbinding is, wordt alles geruisloos gesynchroniseerd naar de cloud.

4. **AI‑poortwachter (computer vision)**
   De backend valideert foto’s en stuurt direct feedback terug naar de app (bijv. “wapening correct gedetecteerd”).

5. **PDF‑dossier generator (druk‑op‑de‑knop)**
   Bij oplevering genereert de backend automatisch:
   - Het **Dossier Bevoegd Gezag** (gemeente)
   - Het **Consumentendossier** (koper, art. 7:757a BW)

## ✅ Status
Het offline camera‑deel, lokale database en cloud‑sync zijn gerealiseerd. De PDF‑export en live AI‑feedback zijn geïntegreerd in de workflow.
