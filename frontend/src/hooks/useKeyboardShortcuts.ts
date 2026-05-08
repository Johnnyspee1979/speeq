/**
 * useKeyboardShortcuts — keyboard shortcut hook voor desktop
 *
 * Registreert globale keydown handlers. Negeert shortcuts
 * wanneer de focus in een input/textarea/select zit.
 *
 * Gebruik:
 *   useKeyboardShortcuts([
 *     { key: 'a', handler: handleApprove, description: 'Goedkeuren' },
 *     { key: 'r', handler: handleReject,  description: 'Afkeuren' },
 *   ], isActive)
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface Shortcut {
  key: string;           // bijv. 'a', 'Escape', 'ArrowDown'
  meta?: boolean;        // Cmd/Ctrl
  shift?: boolean;       // Shift
  alt?: boolean;         // Alt/Option
  handler: () => void;
  description: string;  // voor shortcut-help scherm
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Negeer wanneer gebruiker typt in een formulierveld
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (target?.isContentEditable) return;

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = !!shortcut.meta === (e.metaKey || e.ctrlKey);
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const altMatch = !!shortcut.alt === e.altKey;

        if (keyMatch && metaMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}
