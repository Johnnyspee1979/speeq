# 01 — Architectuur SpeeQ WKB Tool

> Hoe het hele systeem in elkaar zit, in één plaatje en een paar zinnen.

## Het grote plaatje

```
                    ┌──────────────────────────────────────┐
                    │   speeq-wkb.vercel.app               │
                    │   (Vercel CDN — wereldwijd snel)     │
                    │                                      │
                    │   Statisch gehost: HTML + JS         │
                    │   React Native + Expo Web build      │
                    └──────────────┬───────────────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │ Desktop      │      │ Tablet       │      │ Mobiel       │
    │ Chrome/Edge  │      │ Safari       │      │ PWA op iOS   │
    │ Firefox      │      │              │      │ + Android    │
    └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 │
                                 │  Praat met (afhankelijk van ?t=slug)
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │  MASTER SUPABASE (kgiuavfvhtdgwuygbyzo)                │
        │  ─────────────────────────────────────                 │
        │  • public.tenants  — registry van alle klanten         │
        │  • Bewaakt door RLS: alleen johnny@speesolutions.nl    │
        └────────────────────────────────────────────────────────┘
                                 │
                                 │  Stuurt elke klant naar
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │  PER-KLANT SUPABASE                                    │
        │  ────────────────────                                  │
        │  Jansen heeft jansen-xyz.supabase.co                   │
        │  Peters heeft peters-abc.supabase.co                   │
        │  Elke klant = EIGEN data, EIGEN auth, EIGEN bestanden  │
        └────────────────────────────────────────────────────────┘
```

## Drie afzonderlijke "werelden"

### 1. De Tool (frontend)
- **Stack**: React Native + Expo Web → gecompileerd naar statische HTML/JS
- **Host**: Vercel CDN op `speeq-wkb.vercel.app`
- **Aliases**: ook `speeq-wkb-tool.vercel.app`
- **Werkt op**: alle moderne browsers, installeerbaar als PWA op telefoon
- **Offline-first**: WatermelonDB lokaal, sync naar Supabase wanneer online

### 2. Master Supabase (jouw registry)
- **Project ID**: `kgiuavfvhtdgwuygbyzo`
- **URL**: `https://kgiuavfvhtdgwuygbyzo.supabase.co`
- **Wat staat erin**: één tabel `tenants` met de Supabase-credentials van elke klant
- **Wie heeft toegang**: alleen `johnny@speesolutions.nl` (RLS)
- **Wordt gebruikt door**: `/maker` paneel + slug-routing (`?t=slug`)

### 3. Klant-Supabase (1 per klant)
- **Wie maakt 'm aan**: jij (Johnny), op supabase.com
- **Wat staat erin**: ALLES van die klant — projecten, foto's, dossiers, teamleden
- **Wie heeft toegang**: alleen ingelogde gebruikers van die klant (RLS via `profiles.role`)
- **Isolatie**: een Jansen-gebruiker kan onmogelijk Peters' data zien

## Hoe een klant in z'n eigen workspace komt

```
1. Klant ontvangt link:  speeq-wkb.vercel.app/?t=jansen
2. Tool leest "?t=jansen"
3. Tool praat met MASTER → "geef Jansen's Supabase URL + key"
4. Tool schakelt om naar Jansen's eigen Supabase
5. Tool toont login-scherm uit Jansen's Supabase auth
6. Klant logt in OF maakt account
7. Klant ziet zijn eigen workspace met eigen branding/data
8. ?t=jansen wordt uit de URL gehaald (schone refresh)
9. Tenant-config wordt in browser opgeslagen (localforage)
10. Volgende keer: direct naar login zonder ?t=
```

## Belangrijkste bestanden

| Doel | Bestand |
|---|---|
| Tenant-config (per browser) | `frontend/src/config/tenant.ts` |
| Supabase-client (proxy, switcht per tenant) | `frontend/src/lib/supabase.ts` |
| Master-Supabase client (alleen `/maker`) | `frontend/src/services/MasterSupabase.ts` |
| Maker CRUD-service | `frontend/src/services/MakerService.ts` |
| Maker UI | `frontend/src/screens/MakerDashboard.tsx` |
| Slug-routing (`?t=`) | `frontend/App.tsx` — in `TenantGate` |
| Branding (per klant) | `frontend/src/services/TenantBrandingService.ts` |
| Team-uitnodiging (kopieer-link) | `frontend/src/screens/TeamBeheerScreen.tsx` |

## Wat NIET in de tool zit (bewust)

- ❌ Centrale gedeelde database voor alle klanten — opzettelijk niet, voor AVG/GDPR
- ❌ Mail-server / SMTP — invites werken via kopieer-link, dus geen Edge Function nodig
- ❌ Eigen authenticatie — Supabase auth doet alles
- ❌ Eigen file-storage — Supabase Storage doet alles

Dit houdt de tool simpel en de verantwoordelijkheid bij Supabase (één van de meest betrouwbare diensten ter wereld).

---

**Volgende doc:** [`02-supabase-setup.md`](02-supabase-setup.md) — hoe je een nieuwe klant-Supabase opzet.
