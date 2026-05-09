# GitHub Actions — Vercel Deploy

Deze workflow (`vercel-deploy.yml`) deployt automatisch naar Vercel:

- **`www/`** → marketing-site
- **`frontend/`** → Expo web app

**Push naar `main`** = production deploy
**Pull request** = preview deploy met unieke URL als check op de PR

## Eenmalige setup (door beheerder)

### Stap 1 — Vercel projecten aanmaken
Maak op vercel.com twee projecten aan (zonder GitHub-koppeling — die hebben we hier niet nodig):
1. Project voor `www/` (Vite framework, root directory `www`)
2. Project voor `frontend/` (Other framework, root directory `frontend`)

### Stap 2 — Vercel project IDs ophalen
Voor elk project: **Settings → General** → kopieer:
- `Project ID` (begint met `prj_`)
- `Team ID` (op de team-pagina, begint met `team_`)

### Stap 3 — Vercel token aanmaken
https://vercel.com/account/tokens → **Create Token**
- Scope: het juiste team
- Expiration: aanbevolen 1 jaar

### Stap 4 — GitHub secrets toevoegen
Repo → **Settings → Secrets and variables → Actions** → **New repository secret**:

| Naam | Waarde |
|---|---|
| `VERCEL_TOKEN` | de token uit stap 3 |
| `VERCEL_ORG_ID` | het team-ID uit stap 2 |
| `VERCEL_PROJECT_ID_WWW` | project-ID van `www`-project |
| `VERCEL_PROJECT_ID_FRONTEND` | project-ID van `frontend`-project |

### Stap 5 — Klaar
Push iets naar `main` of open een PR; de workflow draait automatisch.
