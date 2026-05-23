/**
 * Unit-tests voor VoicePreferencesContext.
 *
 * Geen JSX (de jest-config heeft geen .tsx transform op dit moment),
 * dus we gebruiken React.createElement direct.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// localforage in-memory mock
const lfStore = new Map<string, string>();
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) =>
      Promise.resolve(lfStore.has(key) ? lfStore.get(key) : null),
    setItem: (key: string, val: string) => {
      lfStore.set(key, val);
      return Promise.resolve(val);
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  VoicePreferencesProvider,
  useVoicePreferences,
  useVoicePreferencesOptional,
  getPlatformVoiceDefault,
  type VoicePreferencesContextValue,
} from '../VoicePreferencesContext';

// Probe-component zonder JSX
let lastCtx: VoicePreferencesContextValue | null = null;
const CtxProbe = (): null => {
  lastCtx = useVoicePreferences();
  return null;
};

function renderWithProvider() {
  return render(
    React.createElement(
      VoicePreferencesProvider,
      null,
      React.createElement(CtxProbe),
    ),
  );
}

beforeEach(() => {
  lfStore.clear();
  lastCtx = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── getPlatformVoiceDefault ─────────────────────────────────────────────────

describe('getPlatformVoiceDefault', () => {
  it('web → false (kantoor)', () => {
    expect(getPlatformVoiceDefault()).toBe(false);
  });
});

// ─── Provider — initial-load ────────────────────────────────────────────────

describe('VoicePreferencesProvider — initial load', () => {
  it('isLoaded begint op false en wordt true na localforage-read', async () => {
    renderWithProvider();
    expect(lastCtx?.isLoaded).toBe(false);
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));
  });

  it('gebruikt platform-default bij lege storage', async () => {
    renderWithProvider();
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));
    expect(lastCtx?.voiceEnabled).toBe(false); // web default
  });

  it("respecteert opgeslagen 'true'", async () => {
    lfStore.set('speeq_voice_enabled', 'true');
    renderWithProvider();
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));
    expect(lastCtx?.voiceEnabled).toBe(true);
  });

  it("respecteert opgeslagen 'false'", async () => {
    lfStore.set('speeq_voice_enabled', 'false');
    renderWithProvider();
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));
    expect(lastCtx?.voiceEnabled).toBe(false);
  });
});

// ─── setVoiceEnabled + toggleVoice ───────────────────────────────────────────

describe('VoicePreferencesProvider — mutations', () => {
  it('setVoiceEnabled persists naar localforage', async () => {
    renderWithProvider();
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));

    await act(async () => {
      await lastCtx!.setVoiceEnabled(true);
    });

    expect(lastCtx?.voiceEnabled).toBe(true);
    expect(lfStore.get('speeq_voice_enabled')).toBe('true');
  });

  it('toggleVoice flipt state', async () => {
    renderWithProvider();
    await waitFor(() => expect(lastCtx?.isLoaded).toBe(true));
    expect(lastCtx?.voiceEnabled).toBe(false);

    await act(async () => {
      await lastCtx!.toggleVoice();
    });
    expect(lastCtx?.voiceEnabled).toBe(true);
    expect(lfStore.get('speeq_voice_enabled')).toBe('true');

    await act(async () => {
      await lastCtx!.toggleVoice();
    });
    expect(lastCtx?.voiceEnabled).toBe(false);
  });
});

// ─── Hook-guards ─────────────────────────────────────────────────────────────

describe('useVoicePreferences (guard)', () => {
  it('throws zonder Provider', () => {
    let caught: unknown = null;
    const Probe = (): null => {
      try {
        useVoicePreferences();
      } catch (e) {
        caught = e;
      }
      return null;
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(React.createElement(Probe));
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/VoicePreferencesProvider/);
  });
});

describe('useVoicePreferencesOptional', () => {
  it('returnt null zonder Provider (geen throw)', () => {
    let captured: VoicePreferencesContextValue | null | undefined;
    const Probe = (): null => {
      captured = useVoicePreferencesOptional();
      return null;
    };
    render(React.createElement(Probe));
    expect(captured).toBeNull();
  });
});
