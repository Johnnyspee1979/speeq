# SpeeQ WKB Tool

> **Live website:** <https://speeq-wkb-tool.vercel.app>
> **Aliassen:** <https://speeq-wkb.vercel.app> · <https://wkb-snap-sync.vercel.app>
> **Eigenaar:** Spee Solutions
> **Status:** in actieve ontwikkeling — Gevolgklasse 1 MVP

Kwaliteitsborging voor de bouw. De vakman maakt een foto, SpeeQ doet de rest — AI-validatie, GPS-koppeling, dossier-opbouw. Geen Excel-lijstjes meer.

---

## Wat is dit precies?

Dit is de repository van **SpeeQ WKB Tool**, een offline-first Wkb-bewijsregistratie tool voor de Nederlandse bouw (Wet kwaliteitsborging voor de bouw, gevolgklasse 1).

De live website draait op **Vercel** vanuit de `frontend/` map. Drie URLs leiden naar dezelfde site:

| URL | Doel |
|---|---|
| 🎯 <https://speeq-wkb-tool.vercel.app> | **Primair** — gebruik deze in marketing en communicatie |
| 🔁 <https://speeq-wkb.vercel.app> | Korte alias |
| 📦 <https://wkb-snap-sync.vercel.app> | Legacy alias — werkt nog zodat oude links niet breken |

Het Vercel-project heet intern nog `wkb-snap-sync` (de oude codename). Niet hernoemen — dat zou alle drie de aliassen breken. De **product-naam is SpeeQ WKB Tool** en die naam wordt overal in de UI, marketing en communicatie gebruikt.

---

## Publieke flow op de website

```
Landing page  →  Code-gate  →  Login  →  Tool
   (video)       (woord)      (Supabase)
```

1. **Landing page** (`LandingScreen.tsx`) — cinematic video hero, marketing, CTA "Open de tool"
2. **Code-gate** (`CodeGateScreen.tsx`) — soft gatekeeper met toegangscode (`code`). Niet bedoeld als echte security; alleen om de tool niet open op het publieke internet te zetten.
3. **Login** (`LoginScreen.tsx`) — Supabase auth (echte security)
4. **Tool** — de werkelijke WKB-app (dashboards per rol: vakman / werkvoorbereider / projectleider / opdrachtgever)

Deep-link bypasses (`?join=` voor vakman-uitnodigingen, `?approve=` voor opdrachtgever-handtekeningen) slaan landing + code-gate over.

---

## Product-visie

- **Offline-first:** bewijs wordt direct lokaal opgeslagen; sync volgt bij verbinding
- **Onweerlegbaarheid:** EXIF, GPS en timestamps zijn verplicht
- **Bouwplaats-UX:** grote knoppen, minimale frictie, directe feedback
- **Open integraties:** API-first richting kwaliteitsborgers, DSO en ERP

---

## Tech stack

| Laag | Tech |
|---|---|
| Frontend | Expo (React Native) + React Native Web |
| Lokale opslag | SQLite (op native) / IndexedDB-fallback (op web) |
| Backend | Node/Express + Supabase service key |
| Auth + database | Supabase |
| File storage | Supabase Storage |
| Web hosting | Vercel (deploys vanuit `frontend/`) |

---

## Projectstructuur

```
speeq/
├── frontend/        ← Expo app (web + mobile) — wordt naar Vercel gedeployd
│   ├── src/
│   │   ├── screens/      Landing / CodeGate / Login / Dashboards / Camera
│   │   ├── components/   Herbruikbare UI
│   │   ├── services/     Supabase, sync, dossier-export
│   │   ├── theme/        Govtech light + SpeeQ groen
│   │   └── assets/       3D logo's + landing video's
│   └── App.tsx
├── backend/         ← Node/Express dossier-API
├── supabase/        ← migrations + edge functions
└── docs/            ← visie, architectuur, rapporten
```

---

## Deploy (web)

De live website draait via Vercel vanuit de `frontend/` map:

```bash
cd frontend
npx vercel --prod --yes
```

Production URL (primair): <https://speeq-wkb-tool.vercel.app>
Aliassen die ook werken: `speeq-wkb.vercel.app` · `wkb-snap-sync.vercel.app`

---

## Lokaal draaien (dev)

1. **Install dependencies**
   - Frontend: `cd frontend && npm install`
   - Backend: `cd backend && npm install`

2. **Environment**
   - Maak van [backend/.env.example](backend/.env.example) een `.env` en vul `SUPABASE_URL` en `SUPABASE_SERVICE_KEY` in
   - Maak van [frontend/.env.example](frontend/.env.example) een `.env` en vul `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `EXPO_PUBLIC_BACKEND_URL` in

3. **Run**
   - Frontend (web): `cd frontend && npm run web`
   - Frontend (mobile): `cd frontend && npm start`
   - Backend: `cd backend && npm start`

4. **Checks**
   - Frontend: `cd frontend && npx tsc --noEmit`
   - Backend: `cd backend && npm run typecheck`

---

## Documentatie

- [Project Initiation & Architecture Report](docs/Project-Initiation-Architecture-Report.md)
- [Strategisch Implementatierapport](docs/Strategisch-Implementatierapport.md)
- [A Student's Guide to the Wkb](docs/Students-Guide-Wkb.md)
- [Project Initiation & Architectuur Rapport](docs/Project-Initiation-Architectuur-Rapport.md)
- [DSO-LV Integratie (Digikoppeling)](docs/DSO-Integratie.md)
- [Elevator Pitch](docs/Elevator-Pitch-Wkb.md)

---

## Belangrijke conventies

- **Niet hernoemen:** het Vercel-project heet intern `wkb-snap-sync` (oude codename). Daar hangen drie aliassen aan: `speeq-wkb-tool.vercel.app` (primair), `speeq-wkb.vercel.app` (kort) en `wkb-snap-sync.vercel.app` (legacy). Renamen breekt alle drie. De **product-naam is SpeeQ WKB Tool** — die naam wordt in alle UI, marketing en communicatie gebruikt.
- **Branding kleuren:** SpeeQ navy `#1B3A5C` + SpeeQ groen `#7CB94B`
- **Achtergrond website:** `#F8FAFC` (Govtech light)
- **Code-gate code:** `0987`. Zit in `frontend/src/screens/CodeGateScreen.tsx` als `TOOL_ACCESS_CODE`.

---

## Roadmap (kort)

- Echte DSO-koppeling i.p.v. demo-adapter
- Echte cloud-AI modelintegratie (i.p.v. heuristiek)
- Rollen-management uitbreiden
- Dossierexport verrijken met handtekeningen en audittrail
- Bouwtekening-annotatie (Sprint 1 plan)
- i18n: NL / EN / DE

---

© 2026 Spee Solutions
