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

// shadcn-stijl tokens (hardcoded — identiek aan Radix Menubar voorbeeld:
// white popover, slate border, slate text, slate accent op hover.)
const SHADCN = {
  triggerBg:        '#FFFFFF',
  triggerBorder:    '#E2E8F0', // slate-200
  triggerBgOpen:    '#F1F5F9', // slate-100 (accent in shadcn)
  triggerText:      '#0F172A', // slate-900
  popoverBg:        '#FFFFFF',
  popoverBorder:    '#E2E8F0',
  itemText:         '#0F172A',
  itemTextMuted:    '#64748B', // slate-500
  itemHoverBg:      '#F1F5F9', // slate-100
  destructive:      '#DC2626',
  divider:          '#E2E8F0',
};

function createStyles(_theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    trigger: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: SHADCN.triggerBorder,
      backgroundColor: SHADCN.triggerBg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    triggerOpen: {
      backgroundColor: SHADCN.triggerBgOpen,
      borderColor: SHADCN.triggerBorder,
    },
    triggerPressed: {
      opacity: 0.85,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      marginTop: 8,
      backgroundColor: SHADCN.popoverBg,
      borderWidth: 1,
      borderColor: SHADCN.popoverBorder,
      borderRadius: 6,
      paddingVertical: 4,
      zIndex: 9999,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' } as unknown as ViewStyle)
        : {
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
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
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 2,
      marginHorizontal: 4,
      gap: 8,
    },
    itemPressed: {
      backgroundColor: SHADCN.itemHoverBg,
    },
    itemDisabled: {
      opacity: 0.45,
    },
    itemIcon: {
      fontSize: 14,
      width: 18,
      textAlign: 'center',
    },
    itemLabel: {
      flex: 1,
      color: SHADCN.itemText,
      fontSize: 14,
      fontWeight: '400',
    },
    itemLabelDisabled: {
      color: SHADCN.itemTextMuted,
    },
    itemDestructive: {
      color: SHADCN.destructive,
    },
    divider: {
      height: 1,
      backgroundColor: SHADCN.divider,
      marginVertical: 4,
    },
  });
}

export default DropdownMenu;
