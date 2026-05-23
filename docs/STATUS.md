# SpeeQ — STATUS

> **Eén pagina, één waarheid.** Open dit elke ochtend.
> Laatste update: 23 mei 2026 · sessie offline-stack + voice + UX-diagnose

---

## 🟢 Productie

| Wat | URL / Plek |
|---|---|
| Frontend (web/PWA) | `speeq-a9q4ndkrk-spee-solutions.vercel.app` |
| Backend API | `awake-beauty-production-9a80.up.railway.app` |
| Supabase project | `kgiuavfvhtdgwuygbyzo` (eu-central-1) |
| Voice TTS bucket | `speeq-voice-cache` (public, 5MB cap, mp3) |
| Test-project | "Wkb Dossier 104A" |
| Sessie-verslag | `docs/sessies/2026-05-22-offline-stack-uitbouw.md` |

---

## ✅ Werkt (technisch gevalideerd)

- Login + tenant-switch
- Werkvoorbereider/Kwaliteitsborger/AI Model dashboards (na #66 fix)
- Project + dossier-export naar PDF (met handtekening-blok)
- Punchlist met 50+ preset-inspectiepunten
- Team beheer (rollen + disciplines)
- Bedrijfsbranding (logo + accentkleur in PDF)
- Modules-toggles (AI, GPS, PDF, Offline, Meertalig)
- Offline-stack (SQLite, sync-engine, conflict-resolutie)
- MobileNet on-device foto-categorisatie (web)
- ElevenLabs TTS via `/api/voice/tts` (Rachel, NL)
- Voice-toggle UI rechtsonder
- Voice-feedback in CameraView + RejectionBanner

---

## ⚠️ Niet getest in productie

- Camera-flow op echte telefoon (vakman-foto-maken)
- Sync-conflict-resolutie met 2 echte gebruikers
- PDF-export met écht logo + content
- Voice-output met betalende API-key (key staat in Railway, niet handmatig getest)

---

## 🔴 Pijnpunten gevonden tijdens demo (23 mei)

| # | Wat | Impact |
|---|---|---|
| 1 | Geen onboarding voor leeg project | Klant staart naar lege schermen |
| 2 | 14 items in zijbalk, alle rollen door elkaar | Overweldigd |
| 3 | Camera-icoon doet niets op desktop | Verwarrend |
| 4 | "Bewijs/Dossier/Punchlist" — 3 woorden, 1 ding | Terminologie |
| 5 | Links openen externe overheid-pagina's | Onbedoelde uitstap |
| 6 | Klik op verkeerd icoon → raw JSON-pagina | Niet user-proof |

Zie `docs/sessies/2026-05-23-ux-ultraplan.md` voor volledige diagnose + plan.

---

## 🎯 Volgende 3 prioriteiten (in volgorde)

### 1. Leeg-project wizard met QR-code · 1 dag · NU
Bij 0 foto's: vriendelijk blok + QR-code naar telefoon-URL.
**Waarom:** lost het grootste pijnpunt op (lege schermen).

### 2. Rol-keuze bij eerste login · 2 dagen
"Ben je vakman / werkvoorbereider / kwaliteitsborger?"
Zijbalk past zich aan op basis van rol.
**Waarom:** van 14 items → 5 per rol.

### 3. Camera-icoon greyed-out op desktop + tooltip · 0.5 dag
"Werkt op telefoon" hover-tekst.
**Waarom:** geen verwarring meer over knoppen die niets doen.

**Niet doen voordat 1-3 af zijn:** nieuwe AI-features, nieuwe voice-features, nieuwe modules.

---

## 🚫 Bewust niet gedaan

| Item | Reden |
|---|---|
| Voice STT (Whisper) | Buiten huidige scope, ligt op `backup/main-voice-experimental` |
| KiK-koppeling offline | Extern systeem, fundamenteel onmogelijk |
| AI semantisch begrip offline | Te zwaar voor mobiel |
| Cross-device sync | Buiten week-1-8 roadmap |
| Native MobileNet | Vereist `tfjs-react-native` + native rebuild |
| Native voice playback | Vereist `expo-av` + `expo-speech` + native rebuild |
| Auto-deploy GitHub → Railway | Te complex, blijft `railway up` |

---

## 📋 Demo-script voor verkoopgesprek (5 min)

1. **Open** `speeq-a9q4ndkrk-spee-solutions.vercel.app`
2. **Toon Modules** — "Klant kiest zelf: AI ja/nee, GPS ja/nee, Offline ja/nee"
3. **Toon Presets** — "50+ kant-en-klare checks, niets zelf bedenken"
4. **Toon Bedrijfsbranding** — "Jouw logo, jouw kleur, in elk dossier"
5. **Klik PDF-export** → toon de print-preview met handtekening-blok
6. **Eindig met:** "Vakman op de bouwplaats opent dit op telefoon, maakt foto, AI checkt, jij krijgt het in je dashboard"

---

## 🔑 Setup-checklist voor nieuwe omgeving

| Stap | Hoe |
|---|---|
| Supabase project | `kgiuavfvhtdgwuygbyzo` of nieuw via MCP |
| Voice cache bucket | `npx ts-node backend/src/scripts/setupVoiceBucket.ts` |
| `ELEVENLABS_API_KEY` op Railway | Variables tab → Add |
| Frontend deploy | `npx vercel --prod --yes` vanuit `frontend/` |
| Backend deploy | `cd backend && railway up` |

---

## 📞 Voor je het vergeet

| Item | Wanneer |
|---|---|
| Oude ElevenLabs API key disablen (per-ongeluk als variabele-naam geplakt) | Vandaag nog |
| Railway trial upgrade naar Hobby ($5/m) | Voor 30 mei |
| Eerste klant op de tool zetten + observeren | Deze week |

---

*Single source of truth. Schrijf hier wat verandert, niet ergens anders.*
*Bij twijfel: dit document is leidend boven oudere docs.*
