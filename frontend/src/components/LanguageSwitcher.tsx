/**
 * LanguageSwitcher — compacte taalwisselaar met vlaggen
 *
 * Gebruik in header:
 *   <LanguageSwitcher theme={theme} />
 *
 * Toont de actieve taal als "🇳🇱 NL" knop.
 * Klik opent een dropdownmenu met alle 4 talen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation, LOCALE_META, type Locale } from '../i18n';

interface Props {
  theme: { colors: Record<string, string> };
  compact?: boolean; // toon alleen vlag+code, geen label
}

export default function LanguageSwitcher({ theme, compact = true }: Props) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);

  // Sluit dropdown bij klik buiten het component (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const handler = (e: MouseEvent) => {
      // @ts-ignore
      if (ref.current && !(ref.current as unknown as HTMLElement).contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback((l: Locale) => {
    setLocale(l);
    setOpen(false);
  }, [setLocale]);

  const current = LOCALE_META[locale];

  return (
    // @ts-ignore web style
    <View ref={ref} style={{ position: 'relative', zIndex: 200 }}>
      {/* Trigger knop */}
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: open ? theme.colors.accent + '60' : theme.colors.border,
          backgroundColor: open ? theme.colors.accent + '10' : theme.colors.surface,
        }}
      >
        <Text style={{ fontSize: 16 }}>{current.flag}</Text>
        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.textPrimary }}>
          {current.short}
        </Text>
        <Text style={{ fontSize: 9, color: theme.colors.textSecondary }}>▼</Text>
      </TouchableOpacity>

      {/* Dropdown */}
      {open && (
        // @ts-ignore web style
        <View style={{
          position: 'absolute' as 'absolute',
          top: '110%',
          right: 0,
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
          // @ts-ignore web
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
          minWidth: 160,
          zIndex: 999,
        }}>
          {(Object.entries(LOCALE_META) as [Locale, typeof LOCALE_META[Locale]][]).map(([code, meta]) => (
            <TouchableOpacity
              key={code}
              onPress={() => handleSelect(code)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 11,
                backgroundColor: locale === code ? theme.colors.accent + '12' : 'transparent',
                borderBottomWidth: code === 'pl' ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>{meta.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: locale === code ? '800' : '600',
                  color: locale === code ? theme.colors.accent : theme.colors.textPrimary,
                }}>
                  {meta.label}
                </Text>
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 1 }}>
                  {meta.short}
                </Text>
              </View>
              {locale === code && (
                <Text style={{ color: theme.colors.accent, fontWeight: '900', fontSize: 14 }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
