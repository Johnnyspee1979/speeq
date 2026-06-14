// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: ai-precheck-foto
// ─────────────────────────────────────────────────────────────────────────────
// Ontvangt een foto-referentie bij een controlepunt en geeft een voorgestelde
// gebrek-/observatie-omschrijving + categorie + zekerheid terug. De modelsleutel
// staat als server-side secret (AI_PRECHECK_KEY) — nooit in de client.
//
// Privacy (AVG): gebruik uitsluitend een EU-gehost vision-model. Foto's van
// bouwplaatsen mogen niet ongecontroleerd buiten de EU verwerkt worden. De
// model-base-URL is configureerbaar via AI_PRECHECK_BASE_URL zodat de EU-regio
// expliciet ingesteld wordt; zonder geconfigureerde EU-endpoint weigert deze
// functie (fail-closed) i.p.v. naar een default buiten de EU te bellen.
//
// Deploy: supabase functions deploy ai-precheck-foto  (GATED — Johnny doet dit).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ALLOWED_CATEGORIEEN = [
  'constructie',
  'gevel',
  'installatie',
  'afbouw',
  'overig',
] as const;

type Categorie = (typeof ALLOWED_CATEGORIEEN)[number];

interface PrecheckRequest {
  fotoRef?: string;
  controlepuntId?: string;
  /** Optioneel: een korte hint over het controlepunt voor betere voorstellen. */
  context?: string;
}

interface PrecheckResponse {
  omschrijving: string;
  categorie: Categorie;
  zekerheid: number;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const normaliseerCategorie = (raw: unknown): Categorie => {
  const v = String(raw ?? '').toLowerCase();
  return (ALLOWED_CATEGORIEEN as readonly string[]).includes(v)
    ? (v as Categorie)
    : 'overig';
};

const clampZekerheid = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Alleen POST toegestaan.' }, 405);
  }

  const apiKey = Deno.env.get('AI_PRECHECK_KEY');
  const baseUrl = Deno.env.get('AI_PRECHECK_BASE_URL'); // EU-endpoint, verplicht
  if (!apiKey || !baseUrl) {
    // Fail-closed: zonder geconfigureerd EU-model geen call.
    return json(
      { error: 'AI-precheck niet geconfigureerd (EU-model + sleutel vereist).' },
      503,
    );
  }

  let body: PrecheckRequest;
  try {
    body = (await req.json()) as PrecheckRequest;
  } catch {
    return json({ error: 'Ongeldige JSON.' }, 400);
  }

  if (!body.fotoRef) {
    return json({ error: 'fotoRef ontbreekt.' }, 400);
  }

  try {
    // Modelaanroep naar het EU-gehoste vision-model. De exacte payload hangt af
    // van de gekozen provider; we sturen de foto-referentie + lichte context.
    const modelRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/vision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_ref: body.fotoRef,
        context: body.context ?? '',
        taak: 'gebrekherkenning-gevolgklasse-1',
      }),
    });

    if (!modelRes.ok) {
      return json({ error: `Model gaf status ${modelRes.status}.` }, 502);
    }

    const raw = (await modelRes.json()) as Record<string, unknown>;
    const out: PrecheckResponse = {
      omschrijving: String(raw.omschrijving ?? raw.description ?? '').slice(0, 500),
      categorie: normaliseerCategorie(raw.categorie ?? raw.category),
      zekerheid: clampZekerheid(raw.zekerheid ?? raw.confidence),
    };

    if (!out.omschrijving) {
      return json({ error: 'Model gaf geen bruikbaar voorstel.' }, 502);
    }
    return json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'onbekende fout';
    return json({ error: `Model onbereikbaar: ${msg}` }, 502);
  }
});
