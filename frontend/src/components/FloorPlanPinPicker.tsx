/**
 * FloorPlanPinPicker — vakman kiest een locatie op de bouwtekening na het maken van een foto.
 * Web/PWA only. Op native toont het een melding.
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import type { FloorPlan } from '../services/FloorPlanService';

interface PinResult {
  floorPlanId: string;
  pinX: number;
  pinY: number;
}

interface Props {
  floorPlans: FloorPlan[];
  onConfirm: (pin: PinResult) => void;
  onSkip: () => void;
  theme: {
    colors: {
      background: string;
      surface: string;
      border: string;
      textPrimary: string;
      textSecondary: string;
      accent: string;
    };
  };
}

export default function FloorPlanPinPicker({ floorPlans, onConfirm, onSkip, theme }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const selectedPlan = floorPlans[selectedIndex];

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPin({ x, y });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pin || !selectedPlan) return;
    onConfirm({ floorPlanId: selectedPlan.id, pinX: pin.x, pinY: pin.y });
  }, [pin, selectedPlan, onConfirm]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>📐 Tekening annotatie</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          Tekening annotatie is beschikbaar op web/desktop.
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

  if (!selectedPlan) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Geen tekeningen beschikbaar.</Text>
        <TouchableOpacity style={[styles.btnSkip, { borderColor: theme.colors.border }]} onPress={onSkip}>
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
              onPress={() => { setSelectedIndex(idx); setPin(null); }}
              style={[
                styles.tab,
                { borderColor: theme.colors.border },
                idx === selectedIndex && { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text style={[
                styles.tabText,
                { color: idx === selectedIndex ? '#fff' : theme.colors.textSecondary },
              ]}>
                {fp.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Tekening + pin overlay */}
      {/* @ts-ignore — web-only div */}
      <div style={{ position: 'relative', width: '100%', marginTop: 10, cursor: 'crosshair' }}>
        {/* @ts-ignore */}
        <img
          ref={imgRef}
          src={selectedPlan.fileUrl}
          onClick={handleImageClick}
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
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: '3px solid white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }} />
            {/* @ts-ignore */}
            <div style={{
              width: 2,
              height: 10,
              backgroundColor: '#ef4444',
              margin: '0 auto',
            }} />
          </div>
        )}
      </div>

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
});
