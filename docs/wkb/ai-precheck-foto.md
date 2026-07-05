# AI-precheck op controlepunt-foto's

Bij het vastleggen van een bewijsfoto kan de gebruiker een **AI-precheck** doen:
het model stelt een gebrek-/observatie-omschrijving + categorie voor. De
gebruiker accepteert, past aan of negeert — **nooit** automatisch invullen.

## Model- en privacy-afweging (stap 1)

| Criterium | Keuze |
|---|---|
| Model | Vision-model via **Supabase Edge Function** (server-side secret), niet rechtstreeks vanuit de client. |
| Hosting | EU-regio vereist (AVG). Foto's van bouwplaatsen mogen **niet** ongecontroleerd naar een model buiten de EU. |
| Sleutel | Als Edge Function-secret (`AI_PRECHECK_KEY`), nooit in client/master-DB. |
| Kosten | 1 modelcall per expliciete precheck-tik (geen automatische bulk). |
| Latentie | Async; de controle zelf blokkeert nooit op de AI. |

> Is er geen geschikt EU-gehost vision-model voor een redelijke prijs, dan stopt
> de precheck-feature en blijft handmatig vastleggen werken. De precheck is
> **altijd optioneel**.

## Offline-first

- Geen netwerk → de foto + het controlepunt werken gewoon door; de precheck-taak
  gaat in een lokale queue met status **IN_AFWACHTING**.
- Zodra er weer netwerk is, draait de precheck na (**BEZIG** → **VOORSTEL_KLAAR**
  of **MISLUKT**).
- Een mislukte of uitgestelde precheck blokkeert de SpeeQ-workflow nooit.

## Statusmachine

```
IN_AFWACHTING ──(netwerk + start)──> BEZIG ──(voorstel)──> VOORSTEL_KLAAR
                                       └────(fout)────────> MISLUKT ──(opnieuw)──> IN_AFWACHTING
```

Alleen bij **VOORSTEL_KLAAR** kan de gebruiker accepteren (met optionele
aanpassing) of negeren. Accepteren levert `{omschrijving, categorie}` die de
gebruiker daarna bewust opslaat — de service vult niets zelf in.

## Zekerheid

`zekerheid` (0–1) → label: ≥0.8 hoog, ≥0.5 midden, anders laag. Bij **laag** toont
de UI nadrukkelijk dat het een ruwe suggestie is.

## Edge function

`supabase/functions/ai-precheck-foto/index.ts` — ontvangt een foto-referentie,
roept het vision-model (EU) aan en geeft `{omschrijving, categorie, zekerheid}`
terug. Sleutel als secret.

## Service

`frontend/src/services/AiPrecheckService.ts` — pure statusmachine
(`maakPrecheckTaak`, `markeerBezig`, `verwerkVoorstel`, `markeerMislukt`,
`accepteerVoorstel`, `negeerVoorstel`, `zekerheidsLabel`) + een
`vraagPrecheckAan` met injecteerbare aanroep. Tests dekken de transities en de
"nooit zonder akkoord invullen"-regel.
