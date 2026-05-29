/**
 * AI Provider A/B vergelijking-script.
 *
 * Pakt een set foto's (uit demo-data of cli-arg), draait ze door beide providers,
 * en levert een rapport met snelheid, kosten-schatting en kwaliteit-match.
 *
 * Vereist:
 *   GEMINI_API_KEY
 *   OPENAI_API_KEY
 *
 * Gebruik:
 *   npx ts-node compare-providers.ts                            # tegen sales-demo project
 *   npx ts-node compare-providers.ts --project=<id>             # andere project
 *   npx ts-node compare-providers.ts --limit=10                 # max 10 foto's
 *   npx ts-node compare-providers.ts --image-url=<url>          # 1 specifieke foto
 */

import axios from 'axios';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DEFAULT_PROJECT = 'sales-demo-2026-05-29';

interface ProviderResult {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' | 'ERROR';
  confidence: number;
  feedback: string;
  detectedObjects: string[];
  durationMs: number;
  rawError?: string;
}

interface ComparisonRow {
  inspection_point: string;
  image_url: string;
  gemini: ProviderResult;
  openai: ProviderResult;
  statusMatch: boolean;
  confidenceDelta: number;
}

const SYSTEM_PROMPT = `You are a professional construction quality inspector in the Netherlands checking evidence for the 'Wet kwaliteitsborging voor het bouwen' (Wkb). Analyze the provided image against the requested inspection point. Return a JSON object without any markdown wrapping (just the braces and content) with: 'status' ('PASSED', 'FAILED', or 'NEEDS_REVIEW'), 'confidence' (number 0-1), 'detectedObjects' (array of strings), 'feedback' (string in Dutch explaining the finding), 'checks' (array of string checks performed).`;

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function callGemini(imageUrl: string, inspectionPoint: string): Promise<ProviderResult> {
  const start = Date.now();
  try {
    // Download + base64
    const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imgResp.data).toString('base64');
    const mimeType = imgResp.headers['content-type'] || 'image/jpeg';

    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { text: `Controleer deze foto voor het Wkb-inspectiepunt: ${inspectionPoint}` },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    };

    const r = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      payload,
      { timeout: 15000 }
    );

    const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);

    return {
      status: result.status ?? 'NEEDS_REVIEW',
      confidence: result.confidence ?? 0,
      feedback: result.feedback ?? '',
      detectedObjects: result.detectedObjects ?? [],
      durationMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      status: 'ERROR',
      confidence: 0,
      feedback: e.message,
      detectedObjects: [],
      durationMs: Date.now() - start,
      rawError: e.message,
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(imageUrl: string, inspectionPoint: string): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const r = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Controleer deze foto voor het Wkb-inspectiepunt: ${inspectionPoint}` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const text = r.choices[0].message.content ?? '{}';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);

    return {
      status: result.status ?? 'NEEDS_REVIEW',
      confidence: result.confidence ?? 0,
      feedback: result.feedback ?? '',
      detectedObjects: result.detectedObjects ?? [],
      durationMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      status: 'ERROR',
      confidence: 0,
      feedback: e.message,
      detectedObjects: [],
      durationMs: Date.now() - start,
      rawError: e.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

async function main() {
  // Args
  const args = process.argv.slice(2);
  const projectArg = args.find(a => a.startsWith('--project='))?.split('=')[1];
  const imageArg = args.find(a => a.startsWith('--image-url='))?.split('=')[1];
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5;

  // Check creds
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY niet gezet'); process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY niet gezet'); process.exit(1);
  }

  // Verzamel test-cases
  let testCases: Array<{ inspection_point: string; image_url: string }> = [];

  if (imageArg) {
    testCases.push({ inspection_point: 'manual-test', image_url: imageArg });
  } else {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('❌ Supabase env-vars niet gezet voor project-mode');
      process.exit(1);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('evidence')
      .select('inspection_point_id, photo_uri')
      .eq('project_id', projectArg ?? DEFAULT_PROJECT)
      .not('photo_uri', 'is', null)
      .limit(limit);
    if (error) { console.error('Supabase error:', error.message); process.exit(1); }
    testCases = (data ?? []).map(d => ({
      inspection_point: d.inspection_point_id,
      image_url: d.photo_uri,
    }));
  }

  console.log(`Test cases: ${testCases.length}`);
  console.log('─'.repeat(80));

  // Run
  const rows: ComparisonRow[] = [];
  for (const [i, tc] of testCases.entries()) {
    console.log(`\n[${i+1}/${testCases.length}] ${tc.inspection_point}`);
    console.log(`  URL: ${tc.image_url}`);

    // Parallel beide providers
    const [gemini, openai] = await Promise.all([
      callGemini(tc.image_url, tc.inspection_point),
      callOpenAI(tc.image_url, tc.inspection_point),
    ]);

    const statusMatch = gemini.status === openai.status;
    const confidenceDelta = Math.abs(gemini.confidence - openai.confidence);

    rows.push({ inspection_point: tc.inspection_point, image_url: tc.image_url, gemini, openai, statusMatch, confidenceDelta });

    console.log(`  Gemini: ${gemini.status} (${gemini.confidence.toFixed(2)}) in ${gemini.durationMs}ms`);
    console.log(`          ${gemini.feedback.slice(0, 100)}${gemini.feedback.length > 100 ? '…' : ''}`);
    console.log(`  OpenAI: ${openai.status} (${openai.confidence.toFixed(2)}) in ${openai.durationMs}ms`);
    console.log(`          ${openai.feedback.slice(0, 100)}${openai.feedback.length > 100 ? '…' : ''}`);
    console.log(`  Match:  ${statusMatch ? '✓' : '✗'}  Δconfidence=${confidenceDelta.toFixed(2)}`);
  }

  // Rapport
  console.log('\n' + '═'.repeat(80));
  console.log('SAMENVATTING');
  console.log('═'.repeat(80));

  const geminiErrors = rows.filter(r => r.gemini.status === 'ERROR').length;
  const openaiErrors = rows.filter(r => r.openai.status === 'ERROR').length;
  const matches = rows.filter(r => r.statusMatch).length;

  const avgGeminiMs = rows.reduce((s, r) => s + r.gemini.durationMs, 0) / rows.length;
  const avgOpenaiMs = rows.reduce((s, r) => s + r.openai.durationMs, 0) / rows.length;
  const avgGeminiConf = rows.filter(r => r.gemini.status !== 'ERROR').reduce((s, r) => s + r.gemini.confidence, 0) / Math.max(1, rows.length - geminiErrors);
  const avgOpenaiConf = rows.filter(r => r.openai.status !== 'ERROR').reduce((s, r) => s + r.openai.confidence, 0) / Math.max(1, rows.length - openaiErrors);

  console.log(`\nGemini  — gem. ${avgGeminiMs.toFixed(0)}ms, gem. confidence ${avgGeminiConf.toFixed(2)}, ${geminiErrors} errors`);
  console.log(`OpenAI  — gem. ${avgOpenaiMs.toFixed(0)}ms, gem. confidence ${avgOpenaiConf.toFixed(2)}, ${openaiErrors} errors`);
  console.log(`Match-rate (zelfde status): ${matches}/${rows.length} (${(matches/rows.length*100).toFixed(0)}%)`);

  // Kosten-schatting
  const geminiCostEst = rows.length * 0.0001;
  const openaiCostEst = rows.length * 0.005;
  console.log(`\nGeschatte kosten:`);
  console.log(`  Gemini : $${geminiCostEst.toFixed(4)}`);
  console.log(`  OpenAI : $${openaiCostEst.toFixed(4)}`);
  console.log(`  Ratio  : ${(openaiCostEst/geminiCostEst).toFixed(0)}× verschil`);

  // JSON dump (voor verdere analyse)
  const fs = require('fs');
  const out = `/tmp/ai-comparison-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), rows }, null, 2));
  console.log(`\nVolledige resultaten: ${out}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
