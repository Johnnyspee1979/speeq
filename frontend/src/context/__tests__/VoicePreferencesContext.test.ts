/**
 * Unit-tests voor VoicePreferencesContext.
 *
 * Gesproken feedback is op 25 juli 2026 uit het product gehaald. De context
 * bestaat nog wél — consumers (`useVoicePlayback`, `CameraView`,
 * `RejectionBanner`) vragen `voiceEnabled` op en moeten altijd `false` krijgen.
 * Deze tests bewaken precies dat: uit blijft uit, ook als iemand vroeger een
 * voorkeur had opgeslagen en ook als er nog ergens een toggle wordt aangeroepen.
 *
 * Geen JSX (de jest-config heeft geen .tsx transform op dit moment),
 * dus we gebruiken React.createElement direct.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

// localforage in-memory mock — de provider hoort hem niet meer te gebruiken.
const lfStore = new Map<string, string>();
const getItem = jest.fn((key: string) =>
  Promise.resolve(lfStore.has(key) ? lfStore.get(key) : null),
);
const setItem = jest.fn((key: string, val: string) => {
  lfStore.set(key, val);
  return Promise.resolve(val);
});
jest.mock('localforage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => getItem(key),
    setItem: (key: string, val: string) => setItem(key, val),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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
  getItem.mockClear();
  setItem.mockClear();
  lastCtx = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Platform-default ────────────────────────────────────────────────────────

describe('getPlatformVoiceDefault', () => {
  it('is uit, ook op native (was daar vroeger aan)', () => {
    expect(getPlatformVoiceDefault()).toBe(false);
  });
});

// ─── Provider ────────────────────────────────────────────────────────────────

describe('VoicePreferencesProvider', () => {
  it('staat direct uit en is meteen geladen', () => {
    renderWithProvider();
    expect(lastCtx?.voiceEnabled).toBe(false);
    expect(lastCtx?.isLoaded).toBe(true);
  });

  it('negeert een eerder opgeslagen voorkeur', async () => {
    lfStore.set('speeq_voice_enabled', 'true');
    renderWithProvider();
    await act(async () => {});
    expect(lastCtx?.voiceEnabled).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('setVoiceEnabled(true) zet niets aan en schrijft niets weg', async () => {
    renderWithProvider();
    await act(async () => {
      await lastCtx!.setVoiceEnabled(true);
    });
    expect(lastCtx?.voiceEnabled).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('toggleVoice doet niets', async () => {
    renderWithProvider();
    await act(async () => {
      await lastCtx!.toggleVoice();
    });
    expect(lastCtx?.voiceEnabled).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
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
