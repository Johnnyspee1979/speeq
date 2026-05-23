/**
 * useVoicePlayback — speel tekst af via ElevenLabs TTS, met
 * web-native fallback bij netwerk-fout of offline-mode.
 *
 * Flow:
 *   1. Check voicePref aan + niet-lege tekst → anders no-op
 *   2. Stop lopende audio
 *   3. POST naar backend /api/voice/tts (cached MP3 URL)
 *   4. Speel mp3 via HTMLAudioElement
 *   5. Bij elke fout (netwerk / 4xx / 5xx) → fallback naar
 *      `window.speechSynthesis` (gratis, offline, geen kosten)
 *
 * Platform-strategie (web-first):
 *   - Web: HTMLAudioElement + speechSynthesis fallback ✅
 *   - Native (iOS/Android RN): no-op tot expo-av + expo-speech
 *     worden toegevoegd in een native-rebuild PR
 *
 * Returns:
 *   - playVoice(text)   → speel een uitspraak
 *   - stopVoice()       → stop alles wat speelt
 *   - isAvailable       → boolean voor UI-conditionals
 *
 * Onderdeel van docs/plans/2026-05-22-elevenlabs-voice-integration-design.md
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { BACKEND_URL } from '../config/app';
import { supabase } from '../lib/supabase';
import { useVoicePreferencesOptional } from '../context/VoicePreferencesContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseVoicePlaybackResult {
  playVoice: (text: string) => Promise<void>;
  stopVoice: () => void;
  isAvailable: boolean;
}

interface TtsResponse {
  url: string;
  cached: boolean;
  durationMs: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isWebAudioAvailable(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.Audio !== 'undefined'
  );
}

function isSpeechSynthAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

function speakViaSpeechSynth(text: string): void {
  if (!isSpeechSynthAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'nl-NL';
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn('[useVoicePlayback] speechSynth-fout:', err);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useVoicePlayback(): UseVoicePlaybackResult {
  const prefs = useVoicePreferencesOptional();
  const voiceEnabled = prefs?.voiceEnabled ?? false;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopVoice = useCallback((): void => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (isSpeechSynthAvailable()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  const playVoice = useCallback(
    async (text: string): Promise<void> => {
      const cleanText = text.trim();
      if (!voiceEnabled || !cleanText) return;
      if (!isWebAudioAvailable()) {
        // Native of SSR — geen audio mogelijk
        return;
      }

      stopVoice();

      // Probeer ElevenLabs via backend
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          speakViaSpeechSynth(cleanText);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/voice/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: cleanText }),
        });

        if (!response.ok) {
          throw new Error(`TTS HTTP ${response.status}`);
        }

        const body = (await response.json()) as TtsResponse;
        if (!body.url) throw new Error('Geen URL in TTS response');

        const audio = new window.Audio(body.url);
        audioRef.current = audio;
        await audio.play();
      } catch (err) {
        console.warn('[useVoicePlayback] ElevenLabs faalde, fallback:', err);
        speakViaSpeechSynth(cleanText);
      }
    },
    [voiceEnabled, stopVoice],
  );

  return {
    playVoice,
    stopVoice,
    isAvailable: isWebAudioAvailable() || isSpeechSynthAvailable(),
  };
}
