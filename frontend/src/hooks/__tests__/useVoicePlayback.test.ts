/**
 * Unit-tests voor useVoicePlayback.
 *
 * Gedekt:
 *   - voiceEnabled=false → no-op
 *   - lege text → no-op
 *   - geen sessie → speechSynth fallback
 *   - TTS-success: HTMLAudio.play() aangeroepen met de cached URL
 *   - TTS-error (HTTP 500) → speechSynth fallback
 *   - netwerk-fout → speechSynth fallback
 *   - stopVoice pauseert + cancelt speechSynth
 *   - unmount = cleanup
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('../../config/app', () => ({
  BACKEND_URL: 'https://backend.example',
}));

const mockGetSession = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

// VoicePreferences — default voiceEnabled = true voor de meeste tests
let mockVoiceEnabled = true;
jest.mock('../../context/VoicePreferencesContext', () => ({
  useVoicePreferencesOptional: () => ({
    voiceEnabled: mockVoiceEnabled,
    isLoaded: true,
    toggleVoice: jest.fn(),
    setVoiceEnabled: jest.fn(),
  }),
}));

// fetch + Audio + speechSynthesis global mocks
const mockFetch = jest.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

const mockAudioPlay = jest.fn(() => Promise.resolve());
const mockAudioPause = jest.fn();
class MockAudio {
  src: string;
  constructor(src: string) {
    this.src = src;
  }
  play = mockAudioPlay;
  pause = mockAudioPause;
}

const mockSpeechCancel = jest.fn();
const mockSpeechSpeak = jest.fn();
class MockUtter {
  text: string;
  lang = '';
  rate = 1;
  constructor(text: string) {
    this.text = text;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVoiceEnabled = true;
  mockGetSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'tok-123' } },
  });
  mockFetch.mockReset();
  mockAudioPlay.mockClear();
  mockAudioPause.mockClear();
  mockSpeechCancel.mockClear();
  mockSpeechSpeak.mockClear();

  // Window globals
  (globalThis as unknown as { window: unknown }).window = {
    Audio: MockAudio,
    speechSynthesis: {
      cancel: mockSpeechCancel,
      speak: mockSpeechSpeak,
    },
    SpeechSynthesisUtterance: MockUtter,
  };

  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
});

// Importeer NA mocks
import { useVoicePlayback, type UseVoicePlaybackResult } from '../useVoicePlayback';

let lastResult: UseVoicePlaybackResult | null = null;
const Probe = (): null => {
  lastResult = useVoicePlayback();
  return null;
};

function renderProbe() {
  return render(React.createElement(Probe));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useVoicePlayback — guard-clauses', () => {
  it('voiceEnabled=false → no-op', async () => {
    mockVoiceEnabled = false;
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('hallo wereld');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockAudioPlay).not.toHaveBeenCalled();
    expect(mockSpeechSpeak).not.toHaveBeenCalled();
  });

  it('lege text → no-op', async () => {
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('   ');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useVoicePlayback — TTS success', () => {
  it('roept backend en speelt cached MP3', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          url: 'https://cdn/abc.mp3',
          cached: true,
          durationMs: 12,
        }),
    });

    renderProbe();
    await act(async () => {
      await lastResult!.playVoice('akkoord');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://backend.example/api/voice/tts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-123',
        }),
      }),
    );
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
    expect(mockSpeechSpeak).not.toHaveBeenCalled();
  });

  it('strijdt lopende audio voor nieuwe playback', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://cdn/a.mp3', cached: true, durationMs: 1 }),
    });

    renderProbe();
    await act(async () => {
      await lastResult!.playVoice('eerste');
    });
    await act(async () => {
      await lastResult!.playVoice('tweede');
    });

    // De eerste audio moet zijn gepauzeerd door stopVoice in de tweede aanroep
    expect(mockAudioPause).toHaveBeenCalled();
    expect(mockAudioPlay).toHaveBeenCalledTimes(2);
  });
});

describe('useVoicePlayback — fallback', () => {
  it('geen sessie → speechSynth direct', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('hallo');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSpeechSpeak).toHaveBeenCalledTimes(1);
  });

  it('TTS HTTP 500 → speechSynth fallback', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('test');
    });

    expect(mockSpeechSpeak).toHaveBeenCalledTimes(1);
    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('netwerk-throw → speechSynth fallback', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('hi');
    });

    expect(mockSpeechSpeak).toHaveBeenCalledTimes(1);
  });

  it('empty url in response → fallback', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: '', cached: false, durationMs: 0 }),
    });
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('hi');
    });

    expect(mockSpeechSpeak).toHaveBeenCalledTimes(1);
  });
});

describe('useVoicePlayback — stopVoice', () => {
  it('pauseert lopende audio + cancelt speechSynth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://cdn/x.mp3', cached: true, durationMs: 1 }),
    });
    renderProbe();

    await act(async () => {
      await lastResult!.playVoice('something');
    });

    act(() => {
      lastResult!.stopVoice();
    });

    expect(mockAudioPause).toHaveBeenCalled();
    expect(mockSpeechCancel).toHaveBeenCalled();
  });
});

describe('useVoicePlayback — unmount cleanup', () => {
  it('triggert stop bij unmount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://cdn/y.mp3', cached: true, durationMs: 1 }),
    });
    const { unmount } = renderProbe();

    await act(async () => {
      await lastResult!.playVoice('x');
    });

    mockSpeechCancel.mockClear();
    unmount();

    await waitFor(() => {
      expect(mockSpeechCancel).toHaveBeenCalled();
    });
  });
});

describe('useVoicePlayback — isAvailable', () => {
  it('true op web met Audio + speechSynth', () => {
    renderProbe();
    expect(lastResult?.isAvailable).toBe(true);
  });
});
