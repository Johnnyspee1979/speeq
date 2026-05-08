# DKA-Leveranciers Vergelijking — Welke Digikoppeling-adapter voor SpeeQ?

> **Status:** Concept, nog te valideren met offertes en LTO-toegang.
> **Beslissing nodig vóór:** eerste echte STAM-melding richting gemeente.
> **Eigenaar:** Johnny Spee.

## Waarom we deze keuze maken (niet zelf bouwen)

`docs/DSO-Integratie.md:28` is hierin glashelder: *"Bouw Digikoppeling niet zelf."* Een DKA-leverancier doet:

- PKIoverheid-mTLS (server- + client-cert via Logius)
- WUS / WS-Security signing
- Reliable Messaging (acks, retries, idempotency)
- LTO/Pre-prod/Prod routing en logging voor audit

Wij sturen alleen JSON met Bearer-token naar hun adapter en mappen onze STAM-payload (`backend/src/dso/stamMapper.ts`).

## De vier serieuze opties op de NL-markt

| Leverancier | Type | mTLS/PKI inbegrepen | LTO toegang | Prijsindicatie* | Bekend met DSO/Omgevingswet |
|---|---|---|---|---|---|
| **Procura (Visma)** | Hosted DKA + connector platform | Ja | Ja, gratis bij offerte | €€ (~€800–1500/mnd vanaf) | Sterk — meerdere gemeenten |
| **Cloudation** | Cloud-native DKA, REST-first | Ja | Ja, sandbox | € (~€400–800/mnd) | Sterk — DSO/STAM-template |
| **CGI** | Enterprise DKA | Ja | Ja, traag onboarding | €€€€ (custom, vanaf ~€2K/mnd) | Zeer sterk — gov-incumbent |
| **Yenlo Connect2Go** | iPaaS met Digikoppeling-module | Ja | Ja | €€€ (~€1–2K/mnd) | Matig — generieker, niet WKB-specifiek |

*Prijsindicaties zijn ruwe schattingen op basis van openbare info en eerdere SaaS-offertes — **moeten geverifieerd worden via offerte-aanvraag**. Laat je niet pinnen op deze tabel.

## Aanbeveling — niet definitief

**Cloudation** als eerste offerte aanvragen, om twee redenen:

1. **REST-first matcht onze adapter-architectuur** in `backend/src/dso/adapter.ts` (axios POST + JSON). Geen XML/SOAP-bridge nodig.
2. **Prijspunt is bouwvakker-toegankelijk** — bij €600/mnd is doorrekenen aan klant haalbaar in een SaaS-tarief van €49–99/maand per project.

Procura als plan B als Cloudation geen WKB-specifieke template heeft.

CGI alleen overwegen als een grote bouw-klant (300+ projecten/jaar) het eist en betaalt.

Yenlo afvallen — te generiek, geen Omgevingswet-focus, prijs hoog.

## Concrete next steps (in volgorde)

1. **Offerte-aanvraag Cloudation + Procura** — zelfde mail, parallel. Vraag specifiek naar:
   - LTO-credentials binnen 1 week
   - Test-STAM-melding in hun sandbox vóór commitment
   - Maandelijkse opzegtermijn (geen jaarcontract bij start)
   - Prijs per melding bovenop vast bedrag (Procura rekent vaak per call)

2. **Bel Logius** (070-888 7878) om te checken welke DKA's actief geaccrediteerd zijn voor STAM via DSO. Lijst kan veranderen — eigen sanity-check.

3. **Vraag bestaande gemeente-klanten** (als die er zijn): *"Welke DKA gebruiken jullie voor binnenkomende STAM-meldingen?"* Hetzelfde gebruiken voorkomt mapping-mismatches.

## Wat Cloudation/Procura van ons nodig zullen hebben

- KvK-nummer Spee Solutions
- PKIoverheid-cert aanvraag bij Logius (duurt 4–6 weken — **start dit parallel**, niet na)
- Beschrijving van het software-product (SpeeQ WKB-borging) en geschatte volume (#STAM-meldingen/maand)
- Software-ID (`X-Wkb-Software-Id` header — staat al op `'SnapSyncApp-v1'` in `backend/src/dso/adapter.ts:93`, mogelijk hernoemen naar `'SpeeQ-v1'`)

## Wat we NIET nu doen

- **Geen DKA-keuze maken op basis van deze tabel alleen** — offertes zijn de enige harde data.
- **Geen mTLS-code in onze backend** — dat is leveranciersscope. Zie `docs/DSO-Integratie.md`.
- **Geen jaarcontract** in de eerste 6 maanden. We willen kunnen wisselen als LTO-tests struikelen.
- **Geen DSO-koppeling vóór de PKIoverheid-cert-aanvraag** is ingestuurd — die 4–6 weken wachttijd is de echte kritiek pad, niet de code.

---

*Dit document leeft. Update zodra offertes binnen zijn met echte cijfers.*
