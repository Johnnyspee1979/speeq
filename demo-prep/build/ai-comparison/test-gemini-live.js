/**
 * Gemini live test — verifieert dat productie AI-flow werkt.
 *
 * Run vanuit deze map:
 *   cd demo-prep/build/ai-comparison
 *   node test-gemini-live.js
 *
 * Vereist (allemaal al in backend/ aanwezig):
 *   - backend/node_modules met axios, @supabase/supabase-js, dotenv
 *   - backend/.env met GEMINI_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_KEY
 */

const path = require('path');
const backendDir = path.resolve(__dirname, '../../../backend');
process.chdir(backendDir); // backend/node_modules gebruiken voor require()

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(backendDir, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const SYSTEM_PROMPT = `You are a professional construction quality inspector in the Netherlands checking evidence for the 'Wet kwaliteitsborging voor het bouwen' (Wkb). Analyze the provided image against the requested inspection point. Return a JSON object without any markdown wrapping with: 'status' ('PASSED', 'FAILED', or 'NEEDS_REVIEW'), 'confidence' (number 0-1), 'detectedObjects' (array of strings), 'feedback' (string in Dutch).`;

async function geminiCall(imageUrl, inspectionPoint) {
  const start = Date.now();
  try {
    const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
    const imageBase64 = Buffer.from(imgResp.data).toString('base64');
    const mimeType = imgResp.headers['content-type'] || 'image/jpeg';

    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { text: `Inspectiepunt: ${inspectionPoint}` },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    };

    const r = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      payload,
      { timeout: 25000 }
    );

    const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(clean);

    return {
      ok: true,
      status: result.status ?? 'NEEDS_REVIEW',
      confidence: result.confidence ?? 0,
      feedback: result.feedback ?? '',
      detectedObjects: result.detectedObjects ?? [],
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      error: e.response?.data?.error?.message || e.message,
      httpStatus: e.response?.status,
      durationMs: Date.now() - start,
    };
  }
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY missing');
    process.exit(1);
  }

  console.log(`Gemini-key gevonden (lengte ${GEMINI_API_KEY.length}, begint met "${GEMINI_API_KEY.slice(0,4)}...")`);
  console.log('');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from('evidence')
    .select('inspection_point_id, photo_uri, ai_status, ai_confidence')
    .eq('project_id', 'sales-demo-2026-05-29')
    .order('id');

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }
  if (!data || data.length === 0) { console.error('Geen evidence voor sales-demo project'); process.exit(1); }

  console.log(`Gemini live test — ${data.length} sales-demo foto's`);
  console.log('═'.repeat(80));

  const results = [];
  for (let i = 0; i < data.length; i++) {
    const ev = data[i];
    console.log(`\n[${i+1}/${data.length}] ${ev.inspection_point_id}`);
    console.log(`  Foto: ${ev.photo_uri?.slice(0, 70)}...`);
    console.log(`  Eerder ingevuld: ${ev.ai_status} (${ev.ai_confidence})`);

    const result = await geminiCall(ev.photo_uri, ev.inspection_point_id);
    results.push({ point: ev.inspection_point_id, ...result });

    if (result.ok) {
      console.log(`  ✓ Gemini live: ${result.status} (${result.confidence.toFixed(2)}) in ${result.durationMs}ms`);
      console.log(`    Detected: ${result.detectedObjects.slice(0, 4).join(', ')}`);
      console.log(`    Feedback: "${result.feedback.slice(0, 140)}${result.feedback.length > 140 ? '…' : ''}"`);
    } else {
      console.log(`  ✗ Gemini error${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}: ${result.error}`);
      console.log(`    Tijd voor error: ${result.durationMs}ms`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SAMENVATTING');
  console.log('═'.repeat(80));
  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  console.log(`Succesvol: ${ok.length}/${results.length}`);
  if (ok.length > 0) {
    const avgMs = ok.reduce((s, r) => s + r.durationMs, 0) / ok.length;
    const avgConf = ok.reduce((s, r) => s + r.confidence, 0) / ok.length;
    console.log(`Gem. latency: ${avgMs.toFixed(0)}ms`);
    console.log(`Gem. confidence: ${avgConf.toFixed(2)}`);
    const statusDist = ok.reduce((acc, r) => { acc[r.status] = (acc[r.status]||0)+1; return acc; }, {});
    console.log(`Status: ${Object.entries(statusDist).map(([k,v])=>`${k}=${v}`).join(', ')}`);
  }
  if (failed.length > 0) {
    console.log(`\nGefaalde foto's: ${failed.length}`);
    failed.forEach(f => console.log(`  - ${f.point}: ${f.error}`));
  }

  // Save full results
  const fs = require('fs');
  const out = `/tmp/gemini-live-test-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`\nVolledig rapport: ${out}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
