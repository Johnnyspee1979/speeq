# 07 — Prijsmodel & strategie

> Hoe SpeeQ z'n prijzen vastgesteld zijn, waarom, en wat realistisch is voor Johnny als solo-maker.
> Datum: 2026-05-12.

## Het strategisch principe

> **Je verkoopt geen Wkb-software. Je verkoopt rust op de avond voor oplevering.**
> Dat mag geld kosten.

Johnny's uitgangspunt:
> *"Goedkoop is duurkoop. Liever 20 klanten van €200 dan 200 klanten van €30."*

Premium-positionering werkt op 3 regels:
1. **Wees nooit de goedkoopste** — dan ben je een commodity
2. **Wees zichtbaar duurder dan middenmoot** — dat signaleert kwaliteit
3. **Wees zichtbaar goedkoper dan "vraag offerte aan"** — dat is je transparantie-wapen

## Marktpositie

```
Vastlegg ──── Homigo ──── Bouwportaal ──── STA Software ──── Procore
  €15          €69          €45+€5/u       offerte           enterprise
                                          (~€200-400?)
                  └────────── SpeeQ zone ──────────┘
                  (premium zonder enterprise-duur)
```

## De 4 pakketten

| Pakket | Prijs/mnd | Hosting-kosten | Marge | Voor wie |
|---|---|---|---|---|
| **Solo** | €49 | €23 | €26 | ZZP, klusbedrijf, 1-mans aannemer |
| **Team** | €149 | €23 | €126 | MKB 2-10 man |
| **Pro** | €299 | €31 | €268 | MKB 10-30 man |
| **Enterprise** | €699+ | €100+ | €599+ | 30+ users, multi-locatie |

**Jaar-bundel:** 12 maanden vooruit betalen → 2 maanden gratis (≈17% korting). Cashflow boost + minder churn.

## Wat krijg je voor je geld (value stacking)

| Feature | Solo €49 | Team €149 | Pro €299 | Enterprise |
|---|:-:|:-:|:-:|:-:|
| Eigen Supabase-database (EU) | ✅ | ✅ | ✅ | ✅ dedicated |
| Projecten | 5 actief | 25 actief | onbeperkt | onbeperkt |
| Gebruikers | 1 admin + 2 | onbeperkt | onbeperkt | onbeperkt + SSO |
| Foto-opslag | 25 GB | 100 GB | 250 GB | vanaf 1 TB (fair-use) |
| Borgingsdossier PDF | ✅ | ✅ | ✅ | ✅ |
| Eigen branding in PDF | — | ✅ | ✅ | ✅ + white-label |
| Bouwtekening-pins | ✅ | ✅ | ✅ | ✅ |
| Offline-first PWA | ✅ | ✅ | ✅ | ✅ |
| Klantportaal (opdrachtgever) | — | ✅ | ✅ | ✅ |
| Bonscanner | — | ✅ | ✅ | ✅ |
| Support-respons | 24u e-mail | 8u e-mail | 4u + WhatsApp | 1u (werkuren 8-18) |
| Onboarding | self-service | 30 min video | 60 min remote + opname | volledig traject |
| Maandelijks opzegbaar | ✅ | ✅ | ✅ | jaarcontract |

> **NB:** AI foto-analyse staat (nog) niet op de prijspagina. Pas toevoegen als de Vision API call écht in code zit. Beloof niet wat er niet is.

## Waarom deze cijfers kloppen

**Solo €49 vs Vastlegg €15:**
- 3× duurder, maar 10× de tool
- Vastlegg heeft geen eigen database, geen bouwtekening-pins, geen offline, geen klant-branding
- Voor €34/mnd meer krijgt de ZZP'er een tool die er over 5 jaar nog is

**Team €149 vs Ed Controls €59/user:**
- Voor 5 users: Ed Controls = €295/mnd, SpeeQ Team = €149/mnd
- Besparing **€146/mnd = €1.752/jaar**
- Plus eigen database, klantportaal — features die Ed Controls niet heeft

**Pro €299 vs STA Software (vermoedelijk €300-500):**
- Transparante prijs in plaats van "offerte op aanvraag"
- Onboarding 60 min remote inbegrepen — STA rekent dat los

**Enterprise €699+:**
- 5-10 Enterprise klanten = de kers-op-de-taart
- Eén Enterprise-klant ≈ 14× Solo-klant qua omzet, ≈ 3× minder support-werk

## Realisability check — wat NU al draait

| Belofte | Status |
|---|---|
| Eigen Supabase per klant | ✅ Maker-paneel + slug-routing live |
| Bouwtekening-pins | ✅ FloorPlanService + viewer in code |
| Klant-branding in PDF | ✅ TenantBrandingScreen actief |
| 8 rollen + RLS | ✅ Productie sinds april |
| Offline-first PWA | ✅ WatermelonDB + sync engine |
| Borgingsdossier PDF | ✅ 1-klik export werkt |
| Bonscanner | ✅ Service bestaat |
| Maandelijks opzegbaar | ✅ Geen lock-in |

## Wat NIET beloven (solo niet vol te houden)

| Belofte | Probleem | Aanpassing |
|---|---|---|
| 2u on-site onboarding | 6u/klant rijden+sessie, onhaalbaar bij groei | **60 min remote + opname** |
| 1u support 24/7 Enterprise | Solo onhaalbaar | **1u binnen werkuren 8-18** |
| AI foto-analyse | `ai_status` veld bestaat, maar geen echte Vision API call | **Schrap tot bewezen werkend** |
| SSO standaard | Supabase SSO pas vanaf $599/mnd plan of zelf bouwen | **Alleen Enterprise, levertijd 4-6 weken** |
| 500 GB Pro | Marge wordt te krap bij groei | **250 GB Pro** |
| Onbeperkt Enterprise | $50-150 extra/klant | **vanaf 1 TB, fair-use** |

## De harde kostenvloer

**Supabase Pro is verplicht per klant** ($25/mnd ≈ €23/mnd). De Free tier pauseert na 1 week stilte — niet acceptabel voor klanten.

Bij 40 klanten: ~€920/mnd hosting-kosten als vloer. Reken hiermee in je prijscalculatie.

## Hoeveel klanten kun je solo aan?

Bij een gemixte portefeuille van 40 klanten:

```
20× Solo  × €49  = €  980   +   20× 1u  =  20u/mnd
10× Team  × €149 = €1.490   +   10× 3u  =  30u/mnd
 8× Pro   × €299 = €2.392   +    8× 6u  =  48u/mnd
 2× Enter × €699 = €1.398   +    2×10u  =  20u/mnd
─────────────────────────────────────────────────────
            MRR  = €6.260        Tijd   = 118u/mnd
       Hosting   = − €965
       ───────────────────
       Netto MRR = €5.295   →   €63.540/jaar
```

**118 uur/maand support = 27 uur/week.** Haalbaar maar weinig ruimte voor development of sales.
Realistisch maximum solo: **30-35 klanten, daarna iemand inhuren of klanten weigeren.**

## De claims voor de website

Deze mogen hard worden gemaakt:

1. *"De enige Wkb-tool met fysiek gescheiden databases per klant in de EU."*
2. *"Flat-fee. Geen per-user kosten. Geen verrassingen."*
3. *"Maandelijks opzegbaar. Je data is van jou."*
4. *"Onboarding inbegrepen. Geen verborgen consultancy-uren."*
5. *"Onder de €300/maand voor onbeperkte gebruikers."*

## Anti-advies — wat NIET doen

| ❌ Doe niet | Waarom |
|---|---|
| €19.99 ZZP-tier maken | Saboteert je premium-merk. Vastlegg wint die race. |
| Free tier introduceren | Gratis klanten zijn vaak het meest veeleisend |
| Per-user pricing | Rommelig + straft groei van klanten |
| "Vraag offerte aan" voor Pro | Daar zit STA al — jouw wedge is transparantie |
| Concurreren op prijs in low-end ZZP | Onhoudbare prijzenoorlog, dauwloos werk |
| AI beloven voor het werkt | Vertrouwen kapot bij eerste klant die het test |

## Drie keiharde checks vóór livegang

**1. Verifieer AI-status werkelijk**
Zoek in code: gebeurt er iets met OpenAI/Anthropic Vision API? Zo nee → schrap "AI" van website. Zo ja → claim mag.

**2. Test één klant op betaalde Supabase Pro**
Zet één klant op betaalde Supabase Pro ($25). Controleer of foto-sync, RLS, branding allemaal blijven werken.

**3. Bouw een "uren-logboek" per klant**
Simpel sheet: hoeveel uur kostte klant X deze maand? Na 3 maanden weet je welke klanten winstgevend zijn en welke je moet de-prioriteren.

## Actieplan in 3 stappen

| # | Wat | Wanneer |
|---|---|---|
| 1 | Pas Stitch-prompt aan met deze 4 tiers + value-table | Deze week |
| 2 | Bouw échte AI foto-analyse (Vision API via Edge Function, ~1 dag werk) | Volgende maand |
| 3 | Evalueer 5 eerste betalende klanten tegen je urenboekje, pas tiers aan op échte data | Q3 2026 |

## Eindoordeel realisability

**Ja, dit is realiseerbaar — mits:**
- AI niet beloven tot het werkt
- On-site onboarding remote houden
- Accepteren dat Supabase je vloer-kost van ~€23/klant is
- Maximum 30-35 klanten solo, daarna keuze: inhuren of weigeren

---

**Terug naar:** [README](README.md) · **Vorige:** [06-test-checklist](06-test-checklist.md)
