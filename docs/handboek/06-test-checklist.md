# 06 — Test checklist

> Wat je doorloopt voordat je een release naar klanten stuurt. Print deze pagina of save als screenshot.

## Snel test-rondje (15 min)

### Fase 1 — Klant-flow op desktop (5 min)

```
[ ] Open https://speeq-wkb.vercel.app/maker
[ ] Login (johnny@speesolutions.nl + wachtwoord)
[ ] Demo Bouwgroep BV → klik 🔗 Kopieer link
[ ] Open Chrome incognito → plak link
[ ] ✓ GEEN code 0987 → direct login-scherm
[ ] Klik "Account aanmaken"
[ ] Mail: test@speesolutions.nl + sterk wachtwoord
[ ] ✓ Of direct binnen, of "bevestig je mail"
[ ] ✓ Workspace toont lege staat met welkom-tekst
```

**Als je "bevestig mail" krijgt en niet wilt**: Supabase project → Authentication → Providers → Email → "Confirm email" toggle UIT.

### Fase 2 — Branding + Team-tab (5 min)

```
[ ] Tab "Branding" → upload een logo
[ ] Vul bedrijfsnaam in
[ ] Sla op → refresh pagina
[ ] ✓ Logo zichtbaar bovenin
[ ] ✓ Naam zichtbaar bovenin

[ ] Tab "Team" → voeg testgebruiker toe
   - Naam: Piet de Tester
   - Mail: piet.test@example.com
   - Rol: VAKMAN
[ ] Klik 🔗 Kopieer uitnodig-link
[ ] Plak in 2e incognito-venster
[ ] ✓ JoinScreen verschijnt → "Maak account"
[ ] Maak account voor Piet
[ ] ✓ Piet komt binnen als VAKMAN
```

### Fase 3 — Mobiel (5 min, op je iPhone)

```
[ ] Open op iPhone Safari de klant-link
[ ] Login als Mark (test-user)
[ ] Deel-icoon onderin → "Zet op beginscherm"
[ ] ✓ SpeeQ icoon op beginscherm
[ ] Open vanaf icoon
[ ] ✓ Fullscreen, geen browser-balk
[ ] Tab Camera → maak een foto
[ ] ✓ Foto opgeslagen, zichtbaar in Dossier
```

## Uitgebreide test (1 uur — alleen vóór grote release)

### Multi-tenant isolatie
```
[ ] Open klant A in browser 1 (Chrome incognito)
[ ] Open klant B in browser 2 (Firefox)
[ ] Maak project in A
[ ] ✓ Project niet zichtbaar in B
[ ] Maak foto in A
[ ] ✓ Foto niet zichtbaar in B
[ ] Storage-buckets check: data echt gescheiden
```

### Rol-permissies (op één klant)
```
[ ] Maak gebruikers in alle 8 rollen
[ ] ADMIN: kan alles
[ ] PROJECTLEIDER: ziet alle projecten, geen branding-tab
[ ] WERKVOORBEREIDER: review-dashboard zichtbaar
[ ] KEYUSER: team-tab + branding-tab
[ ] VOORMAN: vakman-workspace
[ ] VAKMAN: alleen eigen werk
[ ] OPDRACHTGEVER: read-only portaal
[ ] KWALITEITSBORGER: review-screen alleen
```

### Camera + foto-flow
```
[ ] Open Camera-tab op mobiel
[ ] Selecteer template
[ ] Maak foto
[ ] Vul ContextForm in
[ ] FloorPlan picker verschijnt (als tekening geüpload)
[ ] Pin op tekening tikken
[ ] Foto opgeslagen lokaal (WatermelonDB)
[ ] Online: sync naar Supabase storage
[ ] Offline: opgeslagen in queue
[ ] Online weer: queue wordt automatisch verwerkt
```

### Dossier + PDF export
```
[ ] Werkvoorbereider tab → kies project
[ ] Foto's verschijnen geordend
[ ] Klik "Export dossier"
[ ] PDF wordt gegenereerd
[ ] ✓ Klant-logo zichtbaar in PDF
[ ] ✓ Klant-naam in footer
[ ] ✓ Foto's correct ingebouwd
[ ] ✓ FloorPlan-pins zichtbaar op tekening-sectie
[ ] Download werkt
```

### Offline-first
```
[ ] Vlieg-modus aan op telefoon
[ ] Open SpeeQ vanaf beginscherm
[ ] Maak 3 foto's
[ ] ✓ Foto's zichtbaar in dossier (lokaal)
[ ] Vlieg-modus uit
[ ] ✓ Foto's worden automatisch geüpload
[ ] ✓ Sync-status onderin "Gesynct (3)"
```

## Wat doe je als iets stuk gaat?

### Een tab crasht met witte pagina
1. DevTools console openen (F12)
2. Screenshot van rode foutmelding
3. Stuur naar Claude/jezelf met context

### Foto-upload faalt
- Check internetverbinding
- Check Supabase Storage quota
- Check RLS policy op `wkb-evidence` bucket

### Account aanmaken werkt niet
- Supabase project → Authentication → check is "Email" provider AAN
- Check of er een SMTP-server is geconfigureerd voor confirmation mails
- Tijdelijk: confirm email UIT zetten

### Maker-paneel weigert te laden
- Check master-DB Supabase status (kgiuavfvhtdgwuygbyzo)
- Re-login (uitloggen + login)
- Check je e-mail klopt: johnny@speesolutions.nl

## Pre-launch checklist (de eerste echte klant)

```
[ ] Klant heeft eigen Supabase project (niet master gebruiken)
[ ] Alle 17 migrations gerunneerd op klant's Supabase
[ ] Klant toegevoegd in /maker met juiste URL + key
[ ] Test-account aangemaakt op klant's Supabase
[ ] Logo + naam ingesteld in Branding-tab
[ ] Eerste test-project aangemaakt
[ ] Test-foto gemaakt en gesynct
[ ] PDF-export werkt met klant-logo
[ ] Link gedeeld met klant via mail + WhatsApp (test allebei)
[ ] Klant ingelogd, eerste foto gemaakt
[ ] Klant teveel uitgenodigd, één geaccepteerd
[ ] Mobiele app geïnstalleerd door klant
[ ] AVG/privacy verklaring gestuurd
```

## Versie-log bijhouden

Per deploy noteer in `CHANGELOG.md`:
```
## 2026-05-12 — v0.x.y
- Toegevoegd: maker-paneel met slug-routing
- Fixed: CodeGate bypass voor ?t= tenant links
- Tests: 3 risico's opgelost (storage, manifest, invites)
```

Maakt rollback en debugging makkelijker.

---

**Klaar.** Je hebt nu alle handleidingen om SpeeQ door te ontwikkelen en uit te rollen.

Terug naar [README](README.md).
