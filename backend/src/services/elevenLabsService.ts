/**
 * ElevenLabsService — Text-to-Speech via ElevenLabs met Supabase Storage cache.
 *
 * Werking:
 *   1. MD5(text) → filename hash
 *   2. Bestaat al in `speeq-voice-cache` bucket? → return publieke URL (geen API-call)
 *   3. Niet gecacht → ElevenLabs POST → upload mp3 naar bucket → return URL
 *
 * Caching-strategie:
 *   - Statische zinnen (menu, AudioFeedback) worden 1× gegenereerd en daarna
 *     gratis hergebruikt over alle tenants/sessions (~90% cost savings).
 *   - Dynamische teksten (dagrapport, transcriptie-polish) krijgen unieke
 *     hashes en worden dus alleen gecached per exacte tekst-match.
 *
 * Default-config (overschrijfbaar via ENV):
 *   - ELEVENLABS_VOICE_ID  → 21m00Tcm4TlvDq8ikWAM (Rachel, multilingual NL/EN)
 *   - ELEVENLABS_MODEL_ID  → eleven_turbo_v2_5    (3× goedkoper dan v2)
 *   - ELEVENLABS_STABILITY → 0.5
 *   - ELEVENLABS_SIMILARITY_BOOST → 0.75
 *
 * Bucket-vereiste: `speeq-voice-cache` moet publiek-leesbaar zijn in Supabase
 * Storage. Setup-script: `backend/src/scripts/setupVoiceBucket.ts`.
 *
 * Onderdeel van docs/plans/2026-05-22-elevenlabs-voice-integration-design.md
 */

const crypto = require('crypto');
const axios = require('axios');
const { getSupabaseAdminClient } = require('./supabaseAdmin');
const { backendConfig } = require('../config');

// ─── Constants ──────────────────────────────────────────────────────────────

const VOICE_BUCKET = 'speeq-voice-cache';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpokenAudioResult {
  url: string;
  cached: boolean;
  durationMs: number;
}

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readConfig(): ElevenLabsConfig {
  return {
    apiKey: backendConfig.elevenLabsApiKey ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID,
    stability: Number(process.env.ELEVENLABS_STABILITY ?? '0.5'),
    similarityBoost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? '0.75'),
  };
}

function hashText(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

// ─── Public API ─────────────────────────────────────────────────────────────

class ElevenLabsService {
  /**
   * Lift `text` naar een publieke MP3-URL. Idempotent — herhaalde calls met
   * dezelfde tekst doen 1× API-call, daarna alleen Supabase-list.
   *
   * Throws bij:
   *   - Lege tekst
   *   - Ontbrekende API-key (alleen bij eerste-genereer call)
   *   - Supabase upload-fout
   *   - ElevenLabs non-2xx response
   */
  static async getSpokenAudioUrl(text: string): Promise<SpokenAudioResult> {
    const startedAt = Date.now();
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Tekst voor spraaksynthese mag niet leeg zijn.');
    }

    const filename = `${hashText(cleanText)}.mp3`;
    const supabaseAdmin = getSupabaseAdminClient();

    // 1. Cache-hit?
    const { data: fileExists, error: listError } = await supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .list('', { search: filename });

    if (listError) {
      // Niet fataal — log en val terug op API
      console.warn('[ElevenLabsService] cache-list faalde:', listError.message);
    }

    if (fileExists && fileExists.some((f: { name: string }) => f.name === filename)) {
      const { data: cacheFile } = supabaseAdmin.storage
        .from(VOICE_BUCKET)
        .getPublicUrl(filename);
      return {
        url: cacheFile.publicUrl,
        cached: true,
        durationMs: Date.now() - startedAt,
      };
    }

    // 2. Niet gecacht → genereer via ElevenLabs
    const cfg = readConfig();
    if (!cfg.apiKey) {
      throw new Error('ElevenLabs API key ontbreekt in de configuratie.');
    }

    const response = await axios({
      method: 'POST',
      url: `${ELEVENLABS_API_BASE}/text-to-speech/${cfg.voiceId}`,
      headers: {
        'xi-api-key': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        text: cleanText,
        model_id: cfg.modelId,
        voice_settings: {
          stability: cfg.stability,
          similarity_boost: cfg.similarityBoost,
        },
      },
      responseType: 'arraybuffer',
    });

    if (response.status >= 300) {
      throw new Error(`ElevenLabs API gaf ${response.status}`);
    }

    // 3. Upload naar Supabase Storage
    const buffer = Buffer.from(response.data);
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .upload(filename, buffer, {
        contentType: 'audio/mpeg',
        cacheControl: '31536000', // 1 jaar
        upsert: true,
      });

    if (uploadError) {
      console.error('[ElevenLabsService] upload faalde:', uploadError.message);
      throw uploadError;
    }

    const { data: cacheFile } = supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .getPublicUrl(filename);

    return {
      url: cacheFile.publicUrl,
      cached: false,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Voor tests + admin-UI: hoeveel cached MP3's staan er in de bucket?
   */
  static async getCacheStats(): Promise<{ count: number; bytes: number }> {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .list('', { limit: 10_000 });
    if (error) throw error;
    const count = data?.length ?? 0;
    const bytes =
      data?.reduce(
        (sum: number, f: { metadata?: { size?: number } }) =>
          sum + (f.metadata?.size ?? 0),
        0,
      ) ?? 0;
    return { count, bytes };
  }
}

module.exports = { ElevenLabsService, VOICE_BUCKET };
