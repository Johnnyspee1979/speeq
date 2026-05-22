import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import localforage from 'localforage';

interface VoicePreferencesContextType {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

const VoicePreferencesContext = createContext<VoicePreferencesContextType | undefined>(undefined);

const STORAGE_KEY = 'speeq_voice_enabled';

// Bepaal de standaardwaarde op basis van het platform
// Mobiel (iOS/Android) staat standaard AAN (true), Desktop/Web staat standaard UIT (false)
const getDefaultVoiceValue = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

export const VoicePreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(getDefaultVoiceValue());

  // Laad opgeslagen instelling bij het opstarten
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedValue = await localforage.getItem<string>(STORAGE_KEY);
        if (storedValue !== null) {
          setVoiceEnabledState(storedValue === 'true');
        } else {
          // Als er nog geen opgeslagen waarde is, gebruik de platform default
          setVoiceEnabledState(getDefaultVoiceValue());
        }
      } catch (error) {
        console.error('Fout bij het laden van spraakinstellingen:', error);
      }
    };

    loadPreferences();
  }, []);

  const setVoiceEnabled = async (enabled: boolean) => {
    setVoiceEnabledState(enabled);
    try {
      await localforage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Fout bij het opslaan van spraakinstelling:', error);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  return (
    <VoicePreferencesContext.Provider value={{ voiceEnabled, toggleVoice, setVoiceEnabled }}>
      {children}
    </VoicePreferencesContext.Provider>
  );
};

export const useVoicePreferences = () => {
  const context = useContext(VoicePreferencesContext);
  if (context === undefined) {
    throw new Error('useVoicePreferences must be used within a VoicePreferencesProvider');
  }
  return context;
};
