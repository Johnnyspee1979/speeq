/**
 * @jest-environment jsdom
 *
 * Unit-tests voor useKeyboardShortcuts — registreert globale keydown-handlers op
 * web, met modifier-matching (meta/ctrl, shift, alt) en het negeren van events
 * uit formuliervelden (input/textarea/select/contentEditable).
 *
 * We draaien bewust onder jsdom voor een echte `window` + `KeyboardEvent`, en
 * mocken `react-native` zodat we Platform.OS kunnen variëren (web vs. native).
 * We borgen: handler bij matchende key, negeren in een input-veld, modifier-
 * mismatch, geen registratie op native, enabled=false, en listener-cleanup bij
 * unmount.
 */

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

import { renderHook } from '@testing-library/react-native';
import { useKeyboardShortcuts, type Shortcut } from '../useKeyboardShortcuts';

const press = (init: KeyboardEventInit, target?: HTMLElement) => {
  const ev = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
  (target ?? window).dispatchEvent(ev);
  return ev;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('roept de handler aan bij een matchende key', () => {
    const handler = jest.fn();
    const shortcuts: Shortcut[] = [{ key: 'a', handler, description: 'Goedkeuren' }];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    press({ key: 'a' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('negeert shortcuts wanneer de focus in een input-veld zit', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler, description: '' }]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press({ key: 'a' }, input);
    expect(handler).not.toHaveBeenCalled();
  });

  it('matcht alleen met de juiste modifier (meta/ctrl)', () => {
    const handler = jest.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 's', meta: true, handler, description: '' }]),
    );
    press({ key: 's' }); // zonder modifier → geen match
    expect(handler).not.toHaveBeenCalled();
    press({ key: 's', ctrlKey: true }); // ctrl telt als meta
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('registreert niets op native (Platform.OS !== web)', () => {
    mockPlatform.OS = 'ios';
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler, description: '' }]));
    press({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('registreert niets wanneer enabled = false', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'a', handler, description: '' }], false));
    press({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('verwijdert de listener bij unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 'a', handler, description: '' }]),
    );
    unmount();
    press({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });
});
