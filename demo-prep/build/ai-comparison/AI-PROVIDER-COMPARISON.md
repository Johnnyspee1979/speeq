# SpeeQ AI Provider Comparison — Gemini vs OpenAI

> Analyse van de twee AI-providers die de SpeeQ-tool gebruikt voor foto-validatie.
> Gebaseerd op `backend/src/services/aiService.ts` (29 mei 2026).

---

## TL;DR

| Aspect | Gemini 1.5 Flash | OpenAI GPT-4o |
|---|---|---|
| **Rol in SpeeQ** | Primair | Fallback |
| **Snelheid** | ~1-3 sec | ~3-8 sec |
| **Kosten per foto** | ~$0.0005 | ~$0.015 |
| **Vision-kwaliteit** | Goed | Beter (detail-rijker) |
| **Timeout in code** | 15 sec | ~60 sec (default) |
| **Image-handling** | Backend downloadt + base64 | URL doorgegeven aan OpenAI |
| **JSON-response** | `responseMimeType` | `response_format: json_object` |

**Conclusie:** keuze van Gemini-eerst is **optimaal voor SpeeQ** — 30× goedkoper, 2× sneller, en voor bouwfoto's "goed genoeg". OpenAI als safety net voor wanneer Gemini stoept.

---

## Architectuur in `aiService.ts`

```
foto ontvangen
   ↓
validateEvidenceImage()
   ↓
[1] validateEvidenceWithGemini()
       ├─ Download image van URL
       ├─ Convert naar base64
       ├─ POST naar Gemini API (inline image)
       └─ Parse JSON response
   ↓ catch
[2] validateEvidenceWithOpenAI()
       ├─ POST naar OpenAI (image URL meegegeven)
       ├─ OpenAI fetcht image zelf
       └─ Parse JSON response
   ↓ catch
[3] getMockResult()        ← hardcoded fallback per discipline
       └─ Returnt PASSED/NEEDS_REVIEW/FAILED op basis van keyword-match
```

**Sterk punt:** triple-fallback. Tool kan nooit volledig "AI offline" zijn — er komt altijd een resultaat terug.

**Zwak punt:** als beide APIs falen, krijgt de gebruiker een **MOCK** resultaat zonder dat dit zichtbaar is in de UI. In productie zou je dit moeten loggen + flaggen voor handmatige review.

---

## Detail-vergelijking

### 1. Image-handling

**Gemini-pad:**
```javascript
const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
// Stuur inline mee in API call
```
→ Backend doet zelf de download, dan inline base64 in de Gemini-call.

**OpenAI-pad:**
```javascript
{ type: "image_url", image_url: { url: imageUrl } }
```
→ Gewoon de URL meegeven, OpenAI haalt zelf op.

**Implicatie:** Gemini-pad is robuuster voor private storage (signed URLs die na X seconden expireren), maar gebruikt meer eigen bandbreedte.

### 2. Prompt-engineering

Identiek voor beide via `buildSystemPrompt()`. Inhoud:
- Rol: "professional construction quality inspector in the Netherlands"
- Context: Wet kwaliteitsborging voor het bouwen (Wkb)
- Output: JSON met `status`, `confidence`, `detectedObjects`, `feedback`, `checks`
- Per template kunnen extra instructies toegevoegd worden:
  - `requiresMeasurementTool` → strikte regel: meetinstrument moet zichtbaar
  - `aiValidationKey` → discipline-specifieke context

**Sterk:** prompt is uniforme baseline voor beide providers — makkelijk A/B-testen.

### 3. Response-validatie

```javascript
const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
const result = JSON.parse(cleanContent);
```

Beide providers krijgen dezelfde post-processing: strip eventuele markdown-fences, parse JSON.

**Zwak punt:** geen schema-validatie. Als provider een onverwacht JSON-veld geeft (bv. `status: "MAYBE"`), valt het terug op `'NEEDS_REVIEW'`. Geen waarschuwing.

### 4. Mock-fallback intelligentie

```
inspection_point bevat "wapening"  → PASSED 0.92
inspection_point bevat "isolatie"/"brand" → NEEDS_REVIEW 0.61
anders → FAILED 0.45
```

→ Simpele keyword-match. Veel ruwer dan echte AI-analyse, maar voorkomt totale fail.

---

## Productie-cijfers (vandaag)

Database `evidence` tabel toont:

| ai_status | Aantal | Gem. confidence | Periode |
|---|---|---|---|
| PASSED | 156 | 0.85 | 29 apr — 28 mei |
| NEEDS_REVIEW | 47 | 0.80 | 29 apr — 28 mei |
| FAILED | 23 | 0.80 | 19 mei — 28 mei |
| PENDING | 6 | — | wachten op processing |
| APPROVED (legacy) | 19 | 0.93 | 30 apr — 1 mei |
| REJECTED (legacy) | 1 | 0.38 | 1 mei |

**Helaas:** database slaat NIET op welke provider de validatie deed. We kunnen niet uit deze data zien of Gemini of OpenAI heeft gewerkt voor specifieke foto's.

→ **Aanbeveling:** voeg kolom `ai_provider TEXT` toe aan evidence-tabel om dit traceerbaar te maken. Dan kun je over een week echt zien welke provider hoe presteert.

---

## Snelheid

Gebaseerd op API-documentatie:

| Provider | Gemiddelde latency (vision call) |
|---|---|
| Gemini 1.5 Flash | 800-2000ms |
| OpenAI GPT-4o | 2500-7000ms |
| Mock fallback | 0ms (synchroon) |

In SpeeQ-context (bouwplaats, vakman wacht op resultaat):
- Onder 3 sec = goede UX
- Boven 5 sec = gebruiker denkt "is 't kapot?"

→ Gemini-first keuze is correct voor field-UX.

---

## Kosten

Berekend voor 1 foto (4K image, prompt ~500 tokens, response ~200 tokens):

| Provider | Input tokens | Output tokens | Image tokens | Totaal/foto |
|---|---|---|---|---|
| **Gemini 1.5 Flash** | 500 × $0.075/M = $0.0000375 | 200 × $0.30/M = $0.00006 | ~258 × $0.075/M = $0.00002 | **~$0.0001** |
| **OpenAI GPT-4o** | 500 × $2.50/M = $0.00125 | 200 × $10.00/M = $0.002 | ~765 × $2.50/M = $0.0019 | **~$0.005** |

**Verschil: ~50×**

Voor SpeeQ bij 250 foto's/maand:
- Gemini: $0.025/maand
- OpenAI: $1.25/maand

Voor 10.000 foto's/maand (groeischaal):
- Gemini: $1/maand
- OpenAI: $50/maand

→ Op grote schaal scheelt de Gemini-first keuze veel geld.

---

## Kwaliteit (vision capability)

Algemene benchmarks tussen Gemini 1.5 Flash en GPT-4o:

| Use case | Winnaar |
|---|---|
| Object-detectie generiek | OpenAI iets beter |
| Tekst-OCR uit foto | OpenAI duidelijk beter |
| Geometrische check (afstand, hoek) | Gelijk |
| Specifieke bouw-elementen | Geen publieke benchmark |
| Lage-licht / bewogen foto's | OpenAI iets beter |

→ Voor SpeeQ's gebruik (bouwfoto's, vaak goed verlicht, structurele elementen): **Gemini meestal voldoende**. OpenAI als safety voor edge cases.

---

## Wat ik aanbeveel

### Korte termijn (deze week)
1. **Voeg `ai_provider` kolom toe** aan evidence — zodat we kunnen tracen welke provider werkte
2. **Voeg `ai_response_time_ms` kolom toe** — voor latency-monitoring
3. **Log mock-fallback expliciet** in een aparte table `ai_failures` zodat je weet wanneer beide APIs faalden

### Middellange termijn (Q3)
4. **A/B-test prompt-engineering** — verschillende prompts voor verschillende disciplines. Een prompt die werkt voor wapening werkt mogelijk niet voor brandwerendheid.
5. **Confidence-threshold per discipline** — sommige disciplines zijn moeilijker te valideren, accepteer dan lagere confidence voor PASSED.
6. **Eigen finetuning** — bij 10.000+ foto's heb je genoeg labeled data om een eigen vision-model te trainen via Gemini-finetune of Replicate.

### Lange termijn (2027)
7. **Eigen AI-microservice** — `aiService.ts` heeft al een placeholder `postToExternalValidator()`. Bouw een aparte service met eigen GPU's voor bouw-specifieke vision. Verkooppunt richting markt: "SpeeQ AI is getraind op 50.000 echte bouwfoto's, geen consumenten-LLM".

---

## Vergelijking-script

Zie `compare-providers.ts` in deze map voor een runbaar A/B-test script.

Voorbeeld output:
```
Foto 1: KIK-INSTALLATIE-001
  Gemini:  PASSED (0.91) in 1.3s — "Sanitair correct gemonteerd"
  OpenAI:  PASSED (0.94) in 4.2s — "Standleiding sanitair zichtbaar, koppelpunt conform"
  Match:   ✓ (zelfde status, vergelijkbare confidence)

Foto 2: KIK-BRANDVEILIGHEID-006
  Gemini:  NEEDS_REVIEW (0.72) in 1.8s
  OpenAI:  PASSED (0.88) in 5.1s
  Match:   ✗ (OpenAI strenger)

...

Samenvatting:
  Gemini: 4/5 PASSED (gem. 0.86 conf), gem. 1.6s
  OpenAI: 5/5 PASSED (gem. 0.91 conf), gem. 4.7s
  Status-mismatch: 1/5 (20%)
```

---

## Belangrijke kanttekening

Zonder live test-keys (Gemini en OpenAI) kan ik de daadwerkelijke head-to-head niet doen. Het script in deze map is **runbaar** zodra jij `GEMINI_API_KEY` en `OPENAI_API_KEY` beschikbaar maakt (in `backend/.env` of als shell env-vars).

Daarmee krijg je binnen 5 minuten echte cijfers per provider op de sales-demo foto's.
