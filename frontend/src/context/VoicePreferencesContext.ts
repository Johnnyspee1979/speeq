/**
 * VoicePreferencesContext — voice-aan/uit toggle met persistence.
 *
 * Apparaat-specifieke defaults uit het design-doc:
 *   - iOS/Android (bouwplaats)  → standaard AAN
 *   - Web (kantoor)             → standaard UIT
 *
 * Persistence via localforage (web: IndexedDB; native: AsyncStorage-backend).
 * Eenmaal opgeslagen overrules de gebruikerskeuze de platform-default.
 *
 * `isLoaded` flag laat consumers wachten op de initial-load zodat we
 * geen flash van "wel/niet spraak" krijgen op eerste render.
 *
 * Onderdeel van docs/plans/2026-05-22-elevenlabs-voice-integration-design.md
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';
import localforage from 'localforage';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VoicePreferencesContextValue {
  voiceEnabled: boolean;
  /** Wachtte de initial-load uit storage al voltooid? */
  isLoaded: boolean;
  toggleVoice: () => Promise<void>;
  setVoiceEnabled: (enabled: boolean) => Promise<void>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VoicePreferencesContext =
  createContext<VoicePreferencesContextValue | undefined>(undefined);

// ─── Uitgezet ───────────────────────────────────────────────────────────────

/**
 * Gesproken feedback is uit het product gehaald (25 juli 2026). De zwevende
 * luidspreker-knop stond permanent over de app heen en leverde niets op.
 *
 * De context blijft bestaan zodat `useVoicePlayback`, `CameraView` en
 * `RejectionBanner` niet hoeven te weten dat de functie weg is: ze vragen
 * `voiceEnabled` op, krijgen `false`, en zwijgen. Geen losse eindjes, geen
 * halfwerkende knop.
 *
 * Wil je het ooit terug: geef `voiceEnabled` weer een echte state, zet de
 * opslag terug (sleutel `speeq_voice_enabled`) en hang de knop opnieuw in
 * TenantProvider. De backend-route `/api/voice/tts` is ongemoeid gelaten.
 */
export function getPlatformVoiceDefault(): boolean {
  return false;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export const VoicePreferencesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Geen state, geen opslag: altijd uit. Een eerder opgeslagen 'true' van een
  // gebruiker die de knop ooit aanzette, mag niet blijven nagalmen.
  const setVoiceEnabled = useCallback(async (_enabled: boolean) => {
    /* bewust leeg — spraak is uitgezet */
  }, []);

  const toggleVoice = useCallback(async () => {
    /* bewust leeg — spraak is uitgezet */
  }, []);

  return React.createElement(
    VoicePreferencesContext.Provider,
    {
      value: {
        voiceEnabled: false,
        isLoaded: true,
        toggleVoice,
        setVoiceEnabled,
      },
    },
    children,
  );
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useVoicePreferences(): VoicePreferencesContextValue {
  const ctx = useContext(VoicePreferencesContext);
  if (!ctx) {
    throw new Error(
      'useVoicePreferences moet binnen een <VoicePreferencesProvider> worden gebruikt',
    );
  }
  return ctx;
}

/**
 * Soft-variant — returnt null als er geen provider is. Handig voor
 * componenten die optioneel willen reageren op voice-state zonder de
 * provider als hard vereiste.
 */
export function useVoicePreferencesOptional(): VoicePreferencesContextValue | null {
  return useContext(VoicePreferencesContext) ?? null;
}
