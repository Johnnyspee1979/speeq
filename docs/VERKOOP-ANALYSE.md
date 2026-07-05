# SpeeQ — Verkoopanalyse (juli 2026)

Nuchtere GTM-analyse op basis van 5 parallelle onderzoeken: productfeiten (repo),
markt & concurrentie (web), doelgroep & kanalen, pricing, en koop-bezwaren.
Bronnen: repo-docs + intern marktverslag (29 mei 2026) + web-research juli 2026.

---

## 1. De harde waarheden eerst

| # | Waarheid | Gevolg |
|---|---|---|
| 1 | **De "40 klanten" zijn geen wachtlijst.** Het is een capaciteitsdoel uit de bouwopdracht-PDF ("nog 37 plekken vrij" = plekken, geen personen). Het interne verslag zegt letterlijk: nul betalend, geen namenlijst. | Bouw eerst een echte prospectlijst — dat is goedkoper dan elk marketingkanaal. |
| 2 | **Verbouw valt (nog) niet onder de Wkb** — uitbreiding uitgesteld, evaluatie uiterlijk 1-1-2027. | Nergens claimen dat verbouw Wkb-plichtig is. Verbouw-dossier = vrijwillig product. |
| 3 | **DSO/STAM-melding is nog niet echt**: DKA-leverancier niet gekozen, PKIoverheid-cert niet aangevraagd (4–6 wkn doorlooptijd). | Verkopen als **"meldingsklaar dossier"**, niet als werkende automelding. PKIoverheid-aanvraag = kritiek pad, nu starten. |
| 4 | **Twee tegenstrijdige prijsmodellen** in de eigen docs: €49/€149/€299/€899 (handboek + AV + landing-spec) vs €299/€599 (commerce/LS). | Eén bron van waarheid kiezen vóór de LS-store en de AV gelijktrekken. |
| 5 | **Vandaag kan niemand betalen**: code lokaal, cert pending, LS-store bestaat niet, migratie + betaalmuur uit. | Opleverchecklist Blok B–E is voorwaarde voor élke livegang-belofte. |

## 2. Wat je wél verkoopt (aantoonbaar in code/docs)

| USP | Bewijs | Verkoopframe |
|---|---|---|
| Offline-first bewijs (EXIF/GPS/tijd) | SQLite-kluis + sync-engine in code | Demo in **vliegtuigmodus** — dat kan geen concurrent naspelen |
| Eigen database per klant (EU) | Multi-tenant architectuur | "Niemand op de NL-markt durft dit publiek te beloven" — AVG-goud richting gemeenten/corporaties |
| AI-fotovalidatie (gpt-4o) | aiService.ts, fail-closed sinds audit | ⚠️ Niet meer uniek (STA AI bestaat). Claim: "AI die offline doorwerkt en in de EU blijft, gebruiker beslist" |
| Dubbel dossier op één knop | dossierGenerator + consumerDossierGenerator | Consumentendossier (7:757a BW) + Bevoegd Gezag in één flow |
| Juridisch + betaal-stack compleet | docs/juridisch + LS-stack, 1460 tests groen | DPA publiek = boven STA/Vastlegg in juridische perceptie |

**Het juridische anker** (centrale claim, géén "tijdsbesparing"):
> *Art. 7:758 lid 4 BW — de aannemer is aansprakelijk tenzij hij kan bewijzen dat het niet aan hem ligt. Jouw dossier is jouw verweer.*
> En: *zonder compleet dossier geen ingebruikname* (feitelijk; geen boetes claimen — die bestaan niet als vast bedrag).

## 3. Markt & concurrentie

| Speler | Prijs | Gat t.o.v. SpeeQ |
|---|---|---|
| Ed Controls | €59–82 /gebruiker/mnd | Geen consumentendossier, geen DSO |
| PlanRadar | €26–129 /mnd | Generiek, geen Wkb-diepte |
| Snagstream | Op aanvraag + jaarcontract | Ondoorzichtig — zet jouw publieke prijs ertegenover |
| Homigo | €0–60 /mnd | Zelfde doelgroep, geen AI/dossier-BG/DSO |
| Vastlegg | Niet publiek (14d trial) | Dichtstbijzijnde claim-concurrent — **trial draaien** |

Marktomvang: 5.118 Wkb-bouwmeldingen in 2025; actieve GK1-populatie = orde
enkele duizenden aannemers. **De koper is de seriematige MKB-aannemer (5–50 man,
≥3 Wkb-projecten/jaar).** De kwaliteitsborger koopt niet — die is je kanaal.

## 4. Prijsadvies

| Trede | Prijs | Wanneer |
|---|---|---|
| Proefproject | 30 dagen gratis (zit al in code: `on_trial`) | Instap, "één project, één middag op de bouw" |
| Founder-deal | 12 mnd Basis à **€149**/mnd | Eerste ~10 klanten, tegen testimonial + logo |
| Basis | €299/mnd of €2.990/jr ("2 maanden gratis") | Standaard, 5+ appgebruikers / ≥3 projecten p.j. |
| Professional | €599/mnd | **Pas actief verkopen** als KiK/DSO/ERP-koppelingen live zijn |

Rekensom voor de pricingpagina: €299/mnd bij 5 projecten ≈ **€60 per project** —
tegenover €2.000–5.000 kwaliteitsborger-kosten per GK1-woning. En: "goedkoper dan
5 Ed Controls-licenties". Urenbesparing pas claimen na meting bij eerste 5 klanten.

## 5. Kanalen (gerangschikt voor een eenmanszaak)

| # | Kanaal | Eerste stap |
|---|---|---|
| 1 | **Kwaliteitsborgers als multiplier** (TloKB-register; elk borgerbedrijf = tientallen aannemers) | 10 borgers selecteren (start Zuid-Holland), één korte mail: "mijn aannemers leveren u een compleet dossier in uw format — 20 min demo?" |
| 2 | **LinkedIn** (rustige stijl, content ligt klaar in het kennisboek) | 3 posts uit het kennisboek-artikel, 1/week, vaste CTA: "één project, één middag op de bouw" |
| 3 | **AFNL-NOA / vakmedia** (~1.800 mkb-leden, exact het profiel) | Kennisartikel (geen advertentie) pitchen aan bouwbelang.com |

Instrumentaanbieders-partnerkanaal (KiK/WKI): **valt nu af** — geen geloofwaardig
aanbod zonder werkende integraties + PKIoverheid.

## 6. De 6 koop-bezwaren + eerlijkste antwoord

| Bezwaar | Eerlijkste antwoord | Nog te fixen |
|---|---|---|
| "WhatsApp + Excel werkt ook" | Klopt — tot het dossier of de melding moet. Rekensom per dossier | Rekenvoorbeeld maken |
| "Mijn borger heeft al een systeem" | SpeeQ vervangt dat niet; het voedt de borger met gestructureerd bewijs | 1 borger als launching partner, schriftelijk |
| "1-mans-bedrijf — wat als je omvalt?" | Export-ZIP + back-ups geregeld; continuïteit nog niet | **Continuïteitsclausule + self-service export + SLA afzwakken** |
| "Is dat AI-oordeel juridisch iets waard?" | Nee — AI is voorsortering, borger borgt. Staat al in de SOA | Zelfde disclaimer in AV + verkoopcopy |
| "Werkt die DSO-melding echt?" | Nog niet — "in aansluittraject" | DKA kiezen, PKIoverheid, 1 echte melding |
| "Weer een abonnement" | Maandelijks opzegbaar, 60 dgn aankondiging prijswijziging | AV-prijzen gelijktrekken met LS |

## 7. 30-dagen-plan (max 3 acties per week)

**Week 1 — fundament**
1. Prijsmodel kiezen (advies: ladder uit §4) → AV + landing-spec + LS gelijk
2. PKIoverheid-aanvraag indienen (kritiek pad 4–6 wkn)
3. Opleverchecklist Blok B (review → push → deploy)

**Week 2 — bewijsbaar maken**
1. Eén echte bouwplaats-test (telefoon, vliegtuigmodus) → foto's/citaten
2. Continuïteitsclausule + self-service export regelen
3. LS-store + varianten aanmaken (checklist §1)

**Week 3 — kanaal 1 + 2 openen**
1. 10 borgers mailen (TloKB-selectie Zuid-Holland)
2. LinkedIn-post 1 live
3. Vastlegg-trial draaien (prijs/claims achterhalen)

**Week 4 — eerste deal**
1. Founder-deal aanbieden aan de 3 warmste prospects
2. Eerste proefproject begeleiden (uren loggen!)
3. LinkedIn-post 2 + borger-follow-ups

---

*Alle beweringen herleidbaar tot repo-bestanden of web-bronnen (verzameld juli
2026; concurrent-prijzen vóór publicatie in campagnemateriaal handmatig
verifiëren). Zusterdocument: [PROMPT-VERBETERING-OPUS48.md](PROMPT-VERBETERING-OPUS48.md).*
