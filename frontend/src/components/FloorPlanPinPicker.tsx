/**
 * FloorPlanPinPicker — vakman kiest een locatie op de bouwtekening na het maken van een foto.
 * Werkt op ZOWEL web/desktop als React Native (iOS/Android).
 *
 * Web:    onClick met e.clientX / getBoundingClientRect()
 * Native: Pressable met onPress + e.nativeEvent.locationX/Y + onLayout voor schaling
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Image,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import type { FloorPlan } from '../services/FloorPlanService';

interface PinResult {
  floorPlanId: string;
  pinX: number; // 0.0–1.0
  pinY: number; // 0.0–1.0
}

interface Theme {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
}

interface Props {
  floorPlans: FloorPlan[];
  onConfirm: (pin: PinResult) => void;
  onSkip: () => void;
  theme: Theme;
}

export default function FloorPlanPinPicker({ floorPlans, onConfirm, onSkip, theme }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);

  // Native: sla de gerenderde afmetingen op voor normalisatie
  const [imgLayout, setImgLayout] = useState<{ width: number; height: number } | null>(null);

  const selectedPlan = floorPlans[selectedIndex];

  // ── Web: klik op <img> ──────────────────────────────────────────────────────
  const handleWebClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPin({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  }, []);

  // ── Native: tik op Image (Pressable) ────────────────────────────────────────
  const handleNativePress = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (!imgLayout) return;
      const x = e.nativeEvent.locationX / imgLayout.width;
      const y = e.nativeEvent.locationY / imgLayout.height;
      setPin({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    },
    [imgLayout]
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgLayout({ width, height });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pin || !selectedPlan) return;
    onConfirm({ floorPlanId: selectedPlan.id, pinX: pin.x, pinY: pin.y });
  }, [pin, selectedPlan, onConfirm]);

  const handleSelectTab = useCallback((idx: number) => {
    setSelectedIndex(idx);
    setPin(null);
    setImgLayout(null);
  }, []);

  // ── Geen tekeningen ─────────────────────────────────────────────────────────
  if (!selectedPlan) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          Geen tekeningen beschikbaar.
        </Text>
        <TouchableOpacity
          style={[styles.btnSkip, { borderColor: theme.colors.border }]}
          onPress={onSkip}
        >
          <Text style={[styles.btnSkipText, { color: theme.colors.textSecondary }]}>Overslaan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>📐 Locatie op tekening</Text>
      <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
        Tik op de tekening om de locatie van deze foto te markeren.
      </Text>

      {/* Tekening tabs */}
      {floorPlans.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {floorPlans.map((fp, idx) => (
            <TouchableOpacity
              key={fp.id}
              onPress={() => handleSelectTab(idx)}
              style={[
                styles.tab,
                { borderColor: theme.colors.border },
                idx === selectedIndex && { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: idx === selectedIndex ? '#fff' : theme.colors.textSecondary },
                ]}
              >
                {fp.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Web renderer ─────────────────────────────────────────────────────── */}
      {Platform.OS === 'web' ? (
        // @ts-ignore — web-only div
        <div style={{ position: 'relative', width: '100%', marginTop: 10, cursor: 'crosshair' }}>
          {/* @ts-ignore */}
          <img
            src={selectedPlan.fileUrl}
            onClick={handleWebClick}
            style={{ width: '100%', display: 'block', borderRadius: 8, userSelect: 'none' }}
            draggable={false}
            alt={selectedPlan.name}
          />
          {pin && (
            // @ts-ignore
            <div
              style={{
                position: 'absolute',
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
              }}
            >
              {/* @ts-ignore */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: '3px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }}
              />
              {/* @ts-ignore */}
              <div style={{ width: 2, height: 10, backgroundColor: '#ef4444', margin: '0 auto' }} />
            </div>
          )}
        </div>
      ) : (
        /* ── Native renderer (iOS / Android) ─────────────────────────────────── */
        <View style={styles.nativeImageWrapper} onLayout={handleLayout}>
          <Pressable onPress={handleNativePress} style={styles.nativePressable}>
            <Image
              source={{ uri: selectedPlan.fileUrl }}
              style={styles.nativeImage}
              resizeMode="contain"
            />
            {/* Pin overlay */}
            {pin && imgLayout && (
              <View
                style={[
                  styles.nativePin,
                  {
                    left: pin.x * imgLayout.width - 11,
                    top: pin.y * imgLayout.height - 22,
                  },
                ]}
              >
                <View style={styles.nativePinDot} />
                <View style={styles.nativePinTail} />
              </View>
            )}
          </Pressable>
        </View>
      )}

      {pin && (
        <Text style={[styles.pinInfo, { color: theme.colors.textSecondary }]}>
          📍 Positie: {Math.round(pin.x * 100)}% / {Math.round(pin.y * 100)}%
        </Text>
      )}

      {/* Knoppen */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btnSkip, { borderColor: theme.colors.border }]}
          onPress={onSkip}
        >
          <Text style={[styles.btnSkipText, { color: theme.colors.textSecondary }]}>Overslaan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnConfirm, { backgroundColor: pin ? theme.colors.accent : '#ccc' }]}
          onPress={handleConfirm}
          disabled={!pin}
        >
          <Text style={styles.btnConfirmText}>Locatie bevestigen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinInfo: {
    fontSize: 11,
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  btnSkip: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSkipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 2,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Native-only styles
  nativeImageWrapper: {
    width: '100%',
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111',
    minHeight: 200,
  },
  nativePressable: {
    width: '100%',
    position: 'relative',
  },
  nativeImage: {
    width: '100%',
    height: 280,
  },
  nativePin: {
    position: 'absolute',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  nativePinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  nativePinTail: {
    width: 2,
    height: 10,
    backgroundColor: '#ef4444',
  },
});
