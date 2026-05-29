# Backup-screenshots — gebruik als live demo crasht

> **Status update 28 mei 06:10:**
> - ✅ `00-app-entry-video.png` — automatisch gemaakt
> - ✅ `01-landing.png` — automatisch gemaakt (marketing-page)
> - ✅ `01b-landing-full.png` — automatisch gemaakt
> - ✅ `02-codegate.png` — automatisch gemaakt
> - ⏳ **3 t/m 10:** jij moet zelf maken (met je demo-account ingelogd)

> Tip: `cmd + shift + 4` op je Mac → sleep een rechthoek → klik → screenshot landt op je Desktop.
> Sleep ze dan in deze map met de juiste bestandsnaam (zie hieronder).

---

## Wat te screenshotten (volgorde = demo-script)

### 1. Landing page (`01-landing.png`)
**URL:** https://speeq-wkb-tool.vercel.app/landing
**Wat:** "Wkb-dossier in één foto." hero met de cinematic video.
**Demo-quote:** *"Dit is wat klanten als eerste zien. De propositie in één zin."*

### 2. Code-gate (`02-codegate.png`)
**URL:** https://speeq-wkb-tool.vercel.app (klik "Open de tool")
**Wat:** Het toegangscode-scherm.
**Demo-quote:** *"Soft gatekeeper — niet als security, maar als 'niet open op het web' bescherming."*

### 3. Login (`03-login.png`)
**Na code-gate ingevuld:**
**Wat:** Het Supabase auth scherm.
**Demo-quote:** *"Echte security: Supabase auth, multi-tenant. Elke bouwfirma heeft eigen omgeving."*

### 4. Vakman dashboard (`04-vakman-dashboard.png`)
**Login als vakman → mobile view**
**Wat:** Het hoofdscherm voor de vakman op telefoon: grote knop "Maak foto", project-selectie.
**Demo-quote:** *"Voor de vakman moet het frictionloos. Grote knoppen, geen menu's."*

### 5. Camera + capture (`05-camera-capture.png`)
**Klik "Maak foto" → camera view**
**Wat:** De camera-modus met overlay (inspectiepunt naam, GPS, EXIF check).
**Demo-quote:** *"GPS, EXIF, tijd, locatie — automatisch. Vakman drukt af, klaar."*

### 6. AI-validatie resultaat (`06-ai-validation.png`)
**Direct na capture**
**Wat:** Het schermpje met "AI gecheckt: PASSED 96%" of "NEEDS_REVIEW 73%".
**Demo-quote:** *"AI doet de eerste check in 2 seconden. De vakman weet meteen of het goed was."*

### 7. Projectleider dashboard (`07-projectleider-dashboard.png`)
**Login als projectleider op desktop**
**Wat:** De review-queue: lijst van NEEDS_REVIEW foto's met thumbnails.
**Demo-quote:** *"Wat de AI niet zeker weet, komt hier — voor de projectleider om handmatig te bevestigen."*

### 8. Review action (`08-review-approve.png`)
**Klik een NEEDS_REVIEW foto open**
**Wat:** Detail-scherm met grote foto, AI-notities, "Goedkeuren / Afkeuren" knoppen.
**Demo-quote:** *"Eén tik om goed te keuren. Daarna direct in het dossier."*

### 9. Dossier overzicht (`09-dossier-overview.png`)
**Klik door naar het project-dossier**
**Wat:** Het complete dossier met alle bewijsfoto's, GPS-pinpoints op tekening, status-overzicht.
**Demo-quote:** *"Hier is het hele Wkb-dossier. Per inspectiepunt zie je: foto, AI-check, leader-review, locatie op tekening."*

### 10. Finalized dossier (`10-finalized.png`)
**Een dossier dat al gefinaliseerd is (FINALIZED status)**
**Wat:** De gefinaliseerde versie met datum, ondertekening, locked status.
**Demo-quote:** *"Bij gereedmelding wordt het dossier ondertekend en gelockd — onveranderbaar bewijs voor de KB."*

---

## Cijfers om bij de hand te hebben

| Metric | Waarde |
|---|---|
| Foto's in productie | 248 |
| Auto-approved door AI | 149 (60%) |
| Door projectleider gereviewd | 22 rejected, 9+ approved manual |
| Gefinaliseerde dossiers | 3 |
| Snelste AI-validatie | onder 2 sec |
| Tenants live | 3 (incl. Combivo Vastgoedonderhoud) |

---

## Bij crash van live demo

1. Open deze map → laat de screenshots zien
2. Open Supabase Studio in een tab → laat de echte productie-cijfers zien
3. Vertel: *"De tool draait al echt in productie — dit zijn cijfers van vandaag"*
