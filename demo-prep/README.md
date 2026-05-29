# demo-prep — Sales-voorbereiding voor Combivo

> Deze map bevat alles wat klaar staat voor de Combivo-meeting (verzet naar volgende week).
> Aangemaakt 28 mei, in 29 mei sessie uitgebreid met **M1-M5 milestones** voor product-100%.
> 
> **Lees `build/m5-e2e/FINAL-REPORT.md` voor het complete overzicht.**

---

## Snel overzicht — wat heb je waar nodig?

| Map | Wat erin staat | Wanneer gebruiken |
|---|---|---|
| `presentation/` | **De 10-slide presentatie + Briefing + PDF** | **Het belangrijkste** — open `index.html` in fullscreen op je laptop, lees BRIEFING.md onderweg |
| `screenshots/` | Backup-screenshots van de live tool + productie-cijfers | Als de live demo crasht: open `11-production-stats.png` of toon screenshots één voor één |
| `demo-data/` | SQL-scripts voor schoon demo-project (al uitgevoerd!) + cleanup | Cleanup-script draaien ná de meeting |
| `migrations/` | Security-hardening SQL — geverifieerd via dry-run | Klaar voor échte deploy (3 fasen, zie M4 report) |
| `roadmap/` | 4 design-docs (Adobe PDF, Achterstallig, Concurrent) | Achtergrond bij de meeting |
| `build/` | Daadwerkelijke implementatie M2-M5 | Wanneer je echt gaat bouwen — code-stubs klaar |

---

## ⏱️ 5-minuten leesbeurt: BRIEFING.md

Open `presentation/BRIEFING.md` voor:
- Wie is Aldert Ensing
- Wat is hier echt aan de hand (showcase → productie)
- Het 10-slide script met wat je per slide zegt
- 3 openers (kies er één)
- Antwoorden op de 7 vragen die hij gaat stellen
- Pre-meeting checklist
- Wat te doen bij JA vs NEE

---

## 🎯 De presentatie

**Open:** `presentation/index.html` in Chrome/Safari
**Fullscreen:** druk `F` (of cmd+ctrl+F)
**Navigeren:** pijltjes ← → · cijfertoetsen 1-9, 0 voor slide 10
**Backup:** `SpeeQ-Combivo-Presentatie.pdf` (alle 10 slides) — open ook offline
**Tip:** Open hem nu 1× door om te wennen aan flow + ritme

---

## 🛡️ Backup als alles crasht

1. **Live demo crasht** → open `screenshots/11-production-stats.png` (live cijfers)
2. **Presentatie crasht** → open `presentation/SpeeQ-Combivo-Presentatie.pdf`
3. **Internet down** → vertel uit briefing — je weet de cijfers uit je hoofd: **252 foto's · 3 dossiers · 8 gefinaliseerd · 21 users**
4. **Telefoon-demo crasht** → toon `screenshots/02-codegate.png` + vertel hoe het normaal werkt

---

## ✅ Stand morgenochtend (jouw checklist)

- [ ] Telefoon vol opgeladen, 4G aan
- [ ] Demo-account ingelogd in Safari op telefoon (vakman-rol)
- [ ] Demo-account ingelogd in Chrome op laptop (projectleider-rol)
- [ ] `presentation/index.html` open in Chrome, in fullscreen geprobeerd
- [ ] BRIEFING.md 2× gelezen onderweg
- [ ] Eén verse foto op locatie maken vlak voor binnen gaan → "Vers van vanochtend"
- [ ] Railway-credit nog steeds bijgeladen?
- [ ] **Diep ademhalen. Je hebt 252 echte foto's aan je kant.**

---

## 🧹 Cleanup na de meeting

```bash
# Als de pilot doorgaat — niets verwijderen, demo data wordt onderdeel van Combivo's start
# Als de pilot NIET doorgaat — opruimen:
# Via Supabase MCP of SQL Editor:
# Voer 'demo-data/cleanup_sales_demo_project.sql' uit
```

Daarna eventueel `migrations/001_security_hardening.sql` testen op Supabase branch.

---

*Veel succes morgen.*
