# _archief

Gearchiveerde code — bewust uit de actieve codebase gehaald, bewaard voor
naslag. Besluit: zie `docs/adr/0001-fundament-besluiten.md` (17 juli 2026).

| Wat | Was | Waarom gearchiveerd |
|---|---|---|
| `admin-cockpit/` | Losse Vite-app "speeq-cockpit" (tenant-beheer) | Kapot gedrift: wees op poort 4100 (backend draait op 4103), stuurde geen Authorization-header terwijl `/api/v1/tenants` inmiddels `requireAuth` eist, had geen deploy-pipeline. Het in-app MakerDashboardScreen (gatekeeper, e-mail-gated) is hét command center. |
| `MakerDashboard-v1.tsx` | Oudste Maker-generatie, bereikbaar via `/maker`-route met eigen auth-flow | Vervangen door `frontend/src/screens/MakerDashboardScreen.tsx` (in-app, achter login + maker-e-mail-gate). De `/maker`-route en deze bypass-flow zijn uit `App.tsx` verwijderd. |

Niets in deze map wordt gebouwd, getest of gedeployed.
