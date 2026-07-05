# SpeeQ — opleverchecklist (verkoop → live bij de klant)

Eén overzicht van álles tussen "deal getekend" en "deze klant gebruikt SpeeQ live".
Afvinkbaar, in volgorde. Commerce-details staan in
[`commerce/lemon-squeezy-go-live.md`](commerce/lemon-squeezy-go-live.md) — die
herhaal ik hier niet, ik verwijs ernaar.

> Legenda: ✅ klaar · 🔄 loopt (achtergrondtaak) · ⏳ jouw actie (gated) · ⛔ ik doe dit bewust niet

---

## Stand vandaag (2026-07-04)

| Onderdeel | Status |
|---|---|
| Security- & data-integriteit-hardening (audit juli '26) | ✅ 12 fixes lokaal gecommit, getest |
| Backend-tests | ✅ 282/282 groen · tsc clean |
| Frontend-tests | ✅ 1178/1178 groen · tsc clean |
| Code gepusht/gedeployed | ⏳ nee — alles ligt lokaal klaar voor jouw review |
| `https://app.speesolutions.com` (443) | ⏳ cert bij Vercel (poort 80 = 200) |
| Go-live-blocker: betaalmuur op `/api/dso/stam/submit` | ✅ gefixt (`dc95ffe`) |
| Go-live-blocker: demo-payload in DSO-tab | 🔄 achtergrondtaak verifieert/fixt |
| Frontend-deps (Expo SDK 55-patches + minors) | 🔄 achtergrondtaak (smoketest) |

---

## Blok A — Deal & juridisch (mag nu al)

- [ ] Deal tekenen / opdrachtbevestiging (basis is verkoop-waardig)
- [ ] SOA + verwerkersovereenkomst naar klant (`docs/juridisch/*`)
- [ ] Tenant aanmaken met status `pending`

## Blok B — Code live zetten (jij, na review)

- [ ] Mijn 12 commits reviewen (`git log --oneline -12`)
- [ ] Pushen naar remote + deploy (Railway backend, Vercel frontend) — ⏳ **jij**
- [ ] `https://app.speesolutions.com` → 200 (Vercel-cert klaar) — ⏳ Vercel
- [ ] `https://api.speesolutions.com/api/health` → 200 (DNS-records, zie go-live-doc §1b) — ⏳ **jij**

## Blok C — Master-DB migratie (gated)

- [ ] `supabase/migrations/20260627_tenant_abonnement.sql` op master-DB draaien — ⏳ **jij**
      (voegt abonnement-kolommen toe; nodig vóór de betaalmuur werkt)

## Blok D — Commerce aanzetten (Lemon Squeezy)

Volg [`commerce/lemon-squeezy-go-live.md`](commerce/lemon-squeezy-go-live.md):

- [ ] Store + producten/varianten aanmaken → variant-ID's noteren (§1)
- [ ] `EXPO_PUBLIC_LS_*` env-vars in Vercel zetten (§4)
- [ ] Webhook-endpoint + signing secret gelijktrekken met Railway (§2, §4)
- [ ] Test-event vanuit LS → tenant krijgt status (§7)

## Blok E — Betaalmuur scherpzetten (de bewuste schakelaar)

- [ ] Alle betalende tenants hebben een `abonnement_status`
- [ ] `ENFORCE_SUBSCRIPTION=true` op Railway — ⏳ **jij**
- [ ] Tenant zónder abonnement → `402` met NL-melding (dossier-export, STAM én DSO-submit)

## Blok F — Laatste veiligheidscheck vóór een echte melding

- [ ] Demo-payload-blocker groen (achtergrondtaak) — **de DSO-tab mag geen demo-data
      naar bevoegd gezag sturen** 🔄
- [ ] Eén echte bouwmelding als eindtest (test-project) → komt correct binnen

---

## Definitie van "opgeleverd"

Blok B + C + D + E + F afgevinkt → de klant kan inloggen, betalen, bewijs vastleggen,
dossiers exporteren en meldingen indienen. Blok A + B mogen nu al; C–F wachten op
de twee achtergrondtaken (D/F) en jouw gated stappen (B/C/E).

### Wat ik (Claude) niet doe ⛔
Geen push/deploy, geen productie-migratie, geen `ENFORCE_SUBSCRIPTION`-flip, geen
account/DNS/geld-acties. Ik lever de geteste code + dit overzicht; de knoppen
blijven bij jou.
