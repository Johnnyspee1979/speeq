# AI Provider Comparison — Gemini vs OpenAI

> Analyse + runbare benchmark van de twee AI-providers in SpeeQ.

## Files

| File | Doel |
|---|---|
| `AI-PROVIDER-COMPARISON.md` | Volledige analyse — leesvolgorde #1 |
| `compare-providers.ts` | A/B-test script, runbaar zodra je keys hebt |
| `README.md` | Dit bestand |

## Snel runnen

```bash
cd demo-prep/build/ai-comparison

# Pak env-vars (uit Railway-config of backend/.env)
export GEMINI_API_KEY=...
export OPENAI_API_KEY=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...

# Run tegen sales-demo project (4 foto's)
npx ts-node compare-providers.ts

# Of: tegen 1 specifieke foto
npx ts-node compare-providers.ts --image-url=https://example.com/foto.jpg

# Of: meer foto's, ander project
npx ts-node compare-providers.ts --project=demo-bam-01 --limit=20
```

## Verwachte output

```
[1/4] KIK-INSTALLATIE-001
  Gemini: PASSED (0.91) in 1300ms
  OpenAI: PASSED (0.94) in 4200ms
  Match: ✓ Δconf=0.03

...

═══════════════════════════════════════════════
SAMENVATTING
═══════════════════════════════════════════════
Gemini — gem. 1450ms, gem. confidence 0.87, 0 errors
OpenAI — gem. 4800ms, gem. confidence 0.91, 0 errors
Match-rate: 4/4 (100%)

Geschatte kosten:
  Gemini : $0.0004
  OpenAI : $0.0200
  Ratio  : 50× verschil
```

## Wat je leert

1. **Werkelijke latency** per provider in jouw situatie
2. **Status-match rate** — hoe vaak zijn beide het eens?
3. **Confidence-spread** — verschillen in zekerheid
4. **Werkelijke kosten** per 250-foto-batch
5. **Failure modes** — welke breekt eerst bij rare input?

## Aanbevolen gebruik

Run dit script wekelijks tijdens groei van het platform. Per provider veranderen modellen + prijzen. De huidige "Gemini-first" keuze kan over 6 maanden niet meer optimaal zijn.
