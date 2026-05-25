/**
 * DropdownMenu — React Native versie van shadcn/Radix Menubar-pattern.
 *
 * Per Johnny 25 mei: header met 7+ losse knoppen wordt rommelig. Een
 * dropdown-menu (zoals macOS Finder of Figma top-bar) groepeert acties
 * onder 1 trigger. Veel rustiger visueel.
 *
 * Geen Radix, geen portals — pure RN Pressable + absolute positionering
 * + click-outside via web's document listener. Werkt op RN-Web en native
 * (op native renderen we de items als Modal-sheet).
 *
 * Gebruik:
 *
 *   <DropdownMenu
 *     trigger={<Text>📥 Exporteer ▾</Text>}
 *     items={[
 *       { label: '📄 PDF rapport', onPress: () => ... },
 *       { label: '📦 ZIP archief',  onPress: () => ... },
 *       'divider',
 *       { label: '☁ OneDrive',     onPress: () => ..., disabled: !isReady },
 *     ]}
 *   />
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type DropdownMenuItem =
  | 'divider'
  | {
      label: string;
      onPress: () => void;
      icon?: string;
      disabled?: boolean;
      destructive?: boolean;
    };

export interface DropdownMenuProps {
  /** Wat de gebruiker ziet als knop. Bv. <Text>📥 Exporteer ▾</Text>. */
  trigger: React.ReactNode;
  /** Items in de dropdown. Pass 'divider' voor een separator-lijn. */
  items: DropdownMenuItem[];
  /** Extra style voor de trigger-wrapper. */
  triggerStyle?: StyleProp<ViewStyle>;
  /** Optioneel: meet de breedte van de dropdown. Default 220. */
  width?: number;
  /** Welke rand van de trigger uitlijnen. Default 'right'. */
  align?: 'left' | 'right';
  /** Accessibility-label voor de trigger. */
  accessibilityLabel?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  triggerStyle,
  width = 220,
  align = 'right',
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View | null>(null);

  // Click-outside detection (web only).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const handler = (e: MouseEvent) => {
      // We sluiten bij elke klik buiten — dropdown-items eigen onPress
      // wordt al door React vóór dit handler-pad afgehandeld
      const node = triggerRef.current as unknown as HTMLElement | null;
      if (node && e.target instanceof Node && node.contains(e.target)) return;
      setOpen(false);
    };
    // Klein delayed-add zodat de openings-klik 'em niet meteen sluit
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const renderItems = () => (
    <View style={[styles.dropdown, { width, [align]: 0 }]}>
      {items.map((item, idx) => {
        if (item === 'divider') {
          return <View key={`d-${idx}`} style={styles.divider} />;
        }
        return (
          <Pressable
            key={`${idx}-${item.label}`}
            onPress={() => {
              if (item.disabled) return;
              close();
              item.onPress();
            }}
            disabled={item.disabled}
            style={({ pressed }) => [
              styles.item,
              pressed ? styles.itemPressed : null,
              item.disabled ? styles.itemDisabled : null,
            ]}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
          >
            {item.icon ? <Text style={styles.itemIcon}>{item.icon}</Text> : null}
            <Text
              style={[
                styles.itemLabel,
                item.destructive ? styles.itemDestructive : null,
                item.disabled ? styles.itemLabelDisabled : null,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View ref={triggerRef} style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.trigger,
          open ? styles.triggerOpen : null,
          pressed ? styles.triggerPressed : null,
          triggerStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
      >
        {trigger}
      </Pressable>

      {/* Web: inline absolute dropdown */}
      {open && Platform.OS === 'web' ? renderItems() : null}

      {/* Native: Modal-sheet (bottomsheet vibe) */}
      {Platform.OS !== 'web' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={close}
        >
          <TouchableWithoutFeedback onPress={close}>
            <View style={styles.backdrop}>
              <TouchableWithoutFeedback>{renderItems()}</TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}
    </View>
  );
};

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    trigger: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderWarm,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    triggerOpen: {
      backgroundColor: theme.colors.borderWarm,
      borderColor: theme.colors.borderWarm,
    },
    triggerPressed: {
      opacity: 0.85,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      marginTop: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderWarm,
      borderRadius: 12,
      paddingVertical: 6,
      zIndex: 9999,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 32px rgba(0,0,0,0.12)' } as unknown as ViewStyle)
        : {
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }),
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 10,
    },
    itemPressed: {
      backgroundColor:
        theme.name === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    itemDisabled: {
      opacity: 0.45,
    },
    itemIcon: {
      fontSize: 16,
      width: 22,
      textAlign: 'center',
    },
    itemLabel: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    itemLabelDisabled: {
      color: theme.colors.textSecondary,
    },
    itemDestructive: {
      color: '#dc2626',
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.borderWarm,
      marginVertical: 4,
    },
  });
}

export default DropdownMenu;
