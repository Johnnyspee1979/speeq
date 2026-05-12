# SpeeQ WKB — Handboek

> Het complete proces van de tool en Supabase, beschreven voor Johnny.
> Datum: 2026-05-12.

## Voor wie is dit handboek?

Dit handboek is voor **Johnny Spee** als eigenaar/maker van SpeeQ. Het beschrijft:
- Hoe de tool technisch in elkaar zit
- Hoe je klanten toevoegt en beheert
- Hoe de klant z'n eigen workspace gebruikt
- Hoe je wijzigingen live zet
- Wat je test voor elke release

Zodat je morgen, over 3 maanden, of als je iemand anders inhuurt om mee te bouwen — alles op één plek vindt.

## Inhoud

| # | Document | Wat staat erin |
|---|---|---|
| 01 | [Architectuur](01-architectuur.md) | Het grote plaatje van de hele stack |
| 02 | [Supabase opzetten](02-supabase-setup.md) | Nieuwe klant-Supabase aanmaken |
| 03 | [Maker-paneel](03-maker-paneel.md) | Hoe `/maker` werkt |
| 04 | [Klant onboarding](04-klant-onboarding.md) | Wat de klant ervaart |
| 05 | [Deploy naar Vercel](05-deploy-vercel.md) | Wijzigingen live krijgen |
| 06 | [Test checklist](06-test-checklist.md) | Wat testen voor release |

## Snelle links

| Wat | URL |
|---|---|
| Live tool | https://speeq-wkb.vercel.app |
| Maker-paneel | https://speeq-wkb.vercel.app/maker |
| Backup-URL | https://speeq-wkb-tool.vercel.app |
| Vercel dashboard | https://vercel.com/spee-solutions |
| Master-Supabase | https://supabase.com/dashboard/project/kgiuavfvhtdgwuygbyzo |
| GitHub repo | https://github.com/Johnnyspee1979/speeq |

## Architectuur in één regel

> **Eén web-app op Vercel. Eén master-Supabase voor je klantenlijst. Eén eigen Supabase per klant met al hun data.**

Daarmee is alles uitgelegd. De rest is detail.

## Wat is af op 2026-05-12

✅ Maker-paneel met klant CRUD en kopieer-link knop
✅ Slug-routing (`?t=jansen` → automatisch tenant)
✅ CodeGate bypass voor klant-links
✅ Tenant-branding per klant (logo, naam, footer)
✅ Tenant-PDF's met klant-branding in plaats van SpeeQ
✅ TypeScript 0 errors
✅ Deploy live op `speeq-wkb.vercel.app`

## Wat staat op de planning

⏳ Seed.sql voor 1-click Supabase setup van nieuwe klanten
⏳ Subdomain-routing (`jansen.speeq-wkb.vercel.app`)
⏳ Wachtwoord-vergeten knop op tenant login
⏳ Auto-resize logo bij upload (512×512)
⏳ Mobiele PWA-test op echte iPhone
⏳ Productie-test met eerste echte klant

## Hulp nodig?

Bij elk doc staat onderaan een link naar het volgende doc. Begin bij [01-architectuur](01-architectuur.md) als je nieuw bent. Begin bij [03-maker-paneel](03-maker-paneel.md) als je vandaag een klant wilt toevoegen.

Als iets niet klopt of mist: open een GitHub issue op de repo, of vraag Claude om dit handboek bij te werken.

---

*"Verschil tussen 1 en 40 klanten is alleen nog data — geen code."*
