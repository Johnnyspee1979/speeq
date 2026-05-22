import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock localforage om opslagfouten te voorkomen en persistentie te testen
const mockStorage: Record<string, string | null> = {};
jest.mock('localforage', () => ({
  getItem: jest.fn(async (key: string) => {
    return mockStorage[key] !== undefined ? mockStorage[key] : null;
  }),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
    return value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

import { VoicePreferencesProvider, useVoicePreferences } from '../VoicePreferencesContext';
import localforage from 'localforage';

describe('VoicePreferencesContext Mobile', () => {
  beforeEach(() => {
    // Reset de mock storage en mocks voor elke test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  it('should initialize to true on iOS and toggle state', async () => {
    const { result } = renderHook(() => useVoicePreferences(), {
      wrapper: VoicePreferencesProvider
    });

    // Wacht tot de initialisatie-useEffect (loadPreferences) volledig is afgerond
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.voiceEnabled).toBe(true);

    act(() => {
      result.current.toggleVoice();
    });

    // Wacht tot de state-update en localforage.setItem zijn afgerond
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.voiceEnabled).toBe(false);
    expect(localforage.setItem).toHaveBeenCalledWith('speeq_voice_enabled', 'false');
  });

  it('should load saved preference from storage if present', async () => {
    // Stel vooraf een opgeslagen waarde in (uitgeschakeld op iOS)
    mockStorage['speeq_voice_enabled'] = 'false';

    const { result } = renderHook(() => useVoicePreferences(), {
      wrapper: VoicePreferencesProvider
    });

    // Wacht tot de useEffect klaar is met laden
    await act(async () => {
      // Wacht een micro-tick voor de async useEffect om te voltooien
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.voiceEnabled).toBe(false);
    expect(localforage.getItem).toHaveBeenCalledWith('speeq_voice_enabled');
  });
});

describe('VoicePreferencesContext Web', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
    Platform.OS = 'web';
  });

  it('should initialize to false on Web', async () => {
    const { result } = renderHook(() => useVoicePreferences(), {
      wrapper: VoicePreferencesProvider
    });

    expect(result.current.voiceEnabled).toBe(false);
  });
});



