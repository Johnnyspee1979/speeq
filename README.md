# Wkb Snap & Sync

## Product‑visie
Wkb Snap & Sync is een offline‑first tool voor Gevolgklasse 1 bouwprojecten. Het doel is om bewijslast (foto’s, metadata, inspectiepunten) juridisch houdbaar vast te leggen op de bouwplaats — zelfs zonder bereik — en dit veilig te synchroniseren naar de cloud.

## Kernprincipes
- **Offline‑first**: bewijs wordt direct lokaal opgeslagen; sync volgt bij verbinding.
- **Onweerlegbaarheid**: EXIF, GPS en timestamps zijn verplicht.
- **Bouwplaats‑UX**: grote knoppen, minimale frictie, directe feedback.
- **Open integraties**: API‑first richting kwaliteitsborgers, DSO en ERP.

## MVP‑scope (Gevolgklasse 1)
1. **Veld‑camera** met GPS/EXIF en inspectiepuntkoppeling.
2. **Lokale opslag** (SQLite) met bewijsstatus.
3. **Dossieroverzicht** met filter en statuslabels.
4. **Cloud sync** (Supabase) inclusief Storage‑uploads.
5. **Dossier‑API** in backend voor aggregatie.

## Architectuur (hoog niveau)
- **Frontend**: Expo (React Native) + SQLite + offline sync.
- **Backend**: Node/Express + Supabase service key.
- **Storage**: Supabase Storage voor foto’s.

## Projectstructuur
- [frontend](frontend) — mobiele app
- [backend](backend) — dossier‑API
- [docs](docs) — visie & rapporten

## Documentatie
- [Project Initiation & Architecture Report](docs/Project-Initiation-Architecture-Report.md)
- [Strategisch Implementatierapport](docs/Strategisch-Implementatierapport.md)
- [A Student’s Guide to the Wkb](docs/Students-Guide-Wkb.md)
- [Project Initiation & Architectuur Rapport](docs/Project-Initiation-Architectuur-Rapport.md)
- [DSO‑LV Integratie (Digikoppeling)](docs/DSO-Integratie.md)
- [Elevator Pitch — Wkb Snap & Sync](docs/Elevator-Pitch-Wkb.md)

## Start (dev)
1. **Install dependencies**
	- Frontend: `cd frontend && npm install`
	- Backend: `cd backend && npm install`
2. **Environment**
	- Maak van [backend/.env.example](backend/.env.example) een `.env` en vul `SUPABASE_URL` en `SUPABASE_SERVICE_KEY` in.
	- Maak van [frontend/.env.example](frontend/.env.example) een `.env` en vul `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `EXPO_PUBLIC_BACKEND_URL` in.
	- Optioneel kun je in de frontend ook `EXPO_PUBLIC_DEFAULT_PROJECT_ID`, `EXPO_PUBLIC_PROJECT_NAME`, `EXPO_PUBLIC_GEVOLGKLASSE` en `EXPO_PUBLIC_KWALITEITSBORGER` instellen.
3. **Supabase**
	- Maak tabel `evidence` aan met minimaal: `photo_uri`, `latitude`, `longitude`, `timestamp`, `project_id`, `inspection_point_id`, `ai_status`, `ai_confidence`, `ai_notes`
	- Maak tabel `presets` aan met minimaal: `type`, `value`
	- Maak Storage bucket `wkb-evidence` aan
4. **Run**
	- Frontend: `cd frontend && npm start`
	- Backend: `cd backend && npm start`
5. **Checks**
	- Frontend: `cd frontend && npm run typecheck`
	- Backend: `cd backend && npm run typecheck`

## Roadmap (kort)
- Echte DSO-koppeling in plaats van demo-adapter
- Echte cloud-AI modelintegratie
- Authenticatie en projectrollen
- Dossierexport verrijken met handtekeningen en audittrail
