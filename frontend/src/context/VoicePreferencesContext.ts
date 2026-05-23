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

const STORAGE_KEY = 'speeq_voice_enabled';

const VoicePreferencesContext =
  createContext<VoicePreferencesContextValue | undefined>(undefined);

// ─── Default per platform ───────────────────────────────────────────────────

/**
 * Bouwplaats (native) krijgt voice aan. Kantoor (web) krijgt voice uit
 * om geluidsuitbarstingen in open kantoren te voorkomen.
 */
export function getPlatformVoiceDefault(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

// ─── Provider ───────────────────────────────────────────────────────────────

export const VoicePreferencesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(
    getPlatformVoiceDefault(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await localforage.getItem<string>(STORAGE_KEY);
        if (cancelled) return;
        if (stored === 'true') setVoiceEnabledState(true);
        else if (stored === 'false') setVoiceEnabledState(false);
        // else: behoud platform-default
      } catch (err) {
        console.warn('[VoicePreferences] kon storage niet lezen:', err);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setVoiceEnabled = useCallback(async (enabled: boolean) => {
    setVoiceEnabledState(enabled);
    try {
      await localforage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      console.warn('[VoicePreferences] kon storage niet schrijven:', err);
    }
  }, []);

  const toggleVoice = useCallback(async () => {
    await setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled, setVoiceEnabled]);

  return React.createElement(
    VoicePreferencesContext.Provider,
    { value: { voiceEnabled, isLoaded, toggleVoice, setVoiceEnabled } },
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
