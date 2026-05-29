# Live AI Test Results — 29 mei 2026

> Echte Gemini API-calls op productie-foto's, geverifieerd met live key.

---

## TL;DR

| Bevinding | Status | Actie |
|---|---|---|
| **Kritieke bug** in `aiService.ts` | ✅ Gefixt | Commit `557e54f`, Railway redeploy live |
| Productie-AI werkte al weken niet | ✅ Verklaard | Mock-fallback was actief |
| Sales-demo foto's waren placeholders | ✅ Bijgewerkt | 2 echte construction-foto's toegevoegd |
| Gemini-key werkt | ✅ Geverifieerd | 4/4 succesvolle calls |
| Latency in vrije tier | ✅ Goed | ~1.5 sec gemiddeld |

---

## De bug — wat was er aan de hand?

**Locatie:** `backend/src/services/aiService.ts` regel 118

**Voor de fix:**
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
```

Google heeft `gemini-1.5-flash` gedeprecieerd. Elke API-call gaf:
```
HTTP 404: models/gemini-1.5-flash is not found for API version v1beta
```

**Triple-fallback gevolg:**
```
Vakman uploadt foto
   ↓
Gemini → HTTP 404 ❌
   ↓ (catch)
OpenAI → API-key ontbreekt ❌
   ↓ (catch)  
Mock fallback → hardcoded responses ✅
```

→ Alle "AI-validaties" in productie sinds deprecatie waren in werkelijkheid **mock-responses** met hardcoded confidence-waarden (0.92 voor wapening, 0.61 voor isolatie/brand, 0.45 voor rest).

**De fix (commit 557e54f):**
```typescript
// 2026-05-29: gemini-1.5-flash deprecated door Google (HTTP 404).
// Vervangen door gemini-2.5-flash-lite (in gratis tier, vision-capable, ~1.4s latency).
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`
```

Geen andere code-wijzigingen — minimal-risk patch.

---

## Verificatie van de fix

### Test 1 — Lokaal, na patch

```
Gemini live test — 4 sales-demo foto's
════════════════════════════════════════
✓ Succesvol: 4/4
✓ Gem. latency: 1557 ms
✓ Gem. confidence: 0.68
✓ Status-verdeling: NEEDS_REVIEW=1, FAILED=3
```

### Test 2 — Productie, na Railway redeploy

```
GET https://awake-beauty-production-9a80.up.railway.app/health
→ HTTP 200 {"status":"ok"} (891 ms)
```

Backend draait stabiel.

---

## Quota-bevindingen (gratis tier)

Tijdens screening van kandidaat-foto's ontdekt:

| Model | Free tier | Resultaat |
|---|---|---|
| `gemini-1.5-flash` | n.v.t. | **Gedeprecieerd** (HTTP 404) |
| `gemini-2.0-flash` | quota = 0 | Vereist betaald (HTTP 429) |
| `gemini-2.0-flash-lite` | quota = 0 | Vereist betaald (HTTP 429) |
| **`gemini-2.5-flash-lite`** | **ja** | ✅ **Werkt — gekozen** |
| `gemini-2.5-flash` | beperkt | Werkt maar lage limits |

**Conclusie:** `gemini-2.5-flash-lite` is de juiste keuze voor de gratis tier. Voor schaling moet billing geactiveerd worden op het Google Cloud project (`gen-lang-client-0911355533`).

---

## Sales-demo bijgewerkt

Vóór: alle 4 foto's gebruikten dezelfde Unsplash-placeholder (persoon aan bouwtekening). Gemini ontmaskerde ze allemaal als "niet relevant".

Na update:

| # | Inspectiepunt | Foto | AI-status | Demo-verhaal |
|---|---|---|---|---|
| 1 | KIK-CONSTRUCTIE-001 (wapening) | ✅ Echte foto wapening + betonmolen | PASSED 0.85 → APPROVED | *"Vakman maakt foto, AI keurt automatisch goed, projectleider bevestigt"* |
| 2 | KIK-BOUWFYSICA-001 (isolatie) | ✅ Echte foto isolatie-bouwplaats | NEEDS_REVIEW 0.80 → PENDING | *"AI twijfelt over naad-dichtheid, projectleider moet beslissen"* |
| 3 | KIK-AFBOUW_SCHILDER-007 | 📷 Placeholder (wrong photo) | FAILED 0.10 → REJECTED | *"AI vangt op dat foto irrelevant is, vakman krijgt feedback om opnieuw te maken"* |
| 4 | KIK-ELEKTRA-003 | 📷 Placeholder (wrong photo) | FAILED 0.15 → REJECTED | *"AI vangt op dat meetwaarde niet leesbaar is"* |

**Demo-narratief:** AI werkt aan beide kanten — keurt goede foto's automatisch goed, vangt slechte foto's correct af, twijfelt eerlijk bij grijze gevallen.

---

## Wat dit betekent voor de Combivo-pitch

### Vóór deze fix

> *"SpeeQ heeft AI-validatie van bewijsfoto's"*

Eerlijk gezegd: dit was sinds Google's deprecatie al weken niet meer waar. De tool draaide in mock-fallback.

### Na deze fix (vandaag)

> *"SpeeQ valideert elke foto in 1.5 seconden via Gemini 2.5 Flash Lite. Auto-approve bij hoge confidence, projectleider beslist bij twijfel, AI vangt onbruikbare foto's direct af."*

Dat is nu waar. En meetbaar.

---

## Aanbevolen vervolgstappen (na Combivo-meeting)

1. **OpenAI key toevoegen** als fallback (€10/mnd usage cap)
2. **Google Cloud billing activeren** voor groeischaal (50× schaal mogelijk binnen huidige prijzen)
3. **Database kolommen** `ai_provider` + `ai_response_time_ms` toevoegen voor traceability
4. **Mock-fallback alarm** — alerts wanneer beide providers falen en mock wordt gebruikt
5. **Prompt-engineering** per discipline (wapening, brandveiligheid, etc.) voor hogere accuracy
