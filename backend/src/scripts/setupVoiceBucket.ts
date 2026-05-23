/**
 * setupVoiceBucket — bootstrap script voor `speeq-voice-cache` bucket.
 *
 * Idempotent — bestaande bucket wordt niet aangeraakt. Bucket is publiek
 * leesbaar zodat `<audio src={url}>` direct werkt zonder JWT-headers.
 *
 * Run één keer per environment:
 *   npx ts-node backend/src/scripts/setupVoiceBucket.ts
 *
 * Vereist: SUPABASE_URL + SUPABASE_SERVICE_KEY in .env
 */

import 'dotenv/config';

const { getSupabaseAdminClient } = require('../services/supabaseAdmin');
const { VOICE_BUCKET } = require('../services/elevenLabsService');

async function main() {
  const supabase = getSupabaseAdminClient();

  console.log(`[setupVoiceBucket] check bucket "${VOICE_BUCKET}"...`);
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Kon buckets niet ophalen:', listError.message);
    process.exit(1);
  }

  const exists = buckets?.some((b: { name: string }) => b.name === VOICE_BUCKET);
  if (exists) {
    console.log(`[setupVoiceBucket] bucket bestaat al — niets te doen.`);
    process.exit(0);
  }

  console.log(`[setupVoiceBucket] aanmaken...`);
  const { error: createError } = await supabase.storage.createBucket(VOICE_BUCKET, {
    public: true,
    fileSizeLimit: 5_000_000, // 5MB per mp3 (ruim — meestal <100KB)
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3'],
  });

  if (createError) {
    console.error('Aanmaken faalde:', createError.message);
    process.exit(1);
  }

  console.log(`[setupVoiceBucket] ✓ "${VOICE_BUCKET}" aangemaakt (public, audio/mpeg, 5MB cap)`);
}

main().catch((err) => {
  console.error('Fataal:', err);
  process.exit(1);
});
