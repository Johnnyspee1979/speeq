/**
 * VoiceQuickToggle — floating microfoon-knop voor voice-aan/uit.
 *
 * Volgens design-doc §2.3: prominent, één tik dempt of activeert.
 * Wordt rechtsonder gepositioneerd, links van de OfflineSyncFloatingBadge
 * zodat ze elkaar niet overlappen.
 *
 * Self-hide bij isLoaded=false (initial localforage-read nog bezig).
 *
 * Warm Minimal tokens: forest (groen) bij aan, beige bij uit.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { designTokens } from '../../theme/designTokens';
import { useVoicePreferencesOptional } from '../../context/VoicePreferencesContext';

const theme = designTokens;

export const VoiceQuickToggle: React.FC = () => {
  const prefs = useVoicePreferencesOptional();
  if (!prefs || !prefs.isLoaded) return null;

  const { voiceEnabled, toggleVoice } = prefs;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floating, styles.position]}
    >
      <Pressable
        onPress={() => {
          void toggleVoice();
        }}
        style={({ pressed }) => [
          styles.btn,
          voiceEnabled ? styles.btnOn : styles.btnOff,
          pressed && styles.btnPressed,
        ]}
        accessibilityLabel={voiceEnabled ? 'Spraak uitschakelen' : 'Spraak inschakelen'}
        accessibilityRole="switch"
        accessibilityState={{ checked: voiceEnabled }}
      >
        <Text
          style={[
            styles.icon,
            { color: voiceEnabled ? '#FFFFFF' : theme.colors.textPrimary },
          ]}
        >
          {voiceEnabled ? '🔊' : '🔇'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  floating: {
    // @ts-ignore — 'fixed' is web-only voor RN-web; native negeert.
    position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
    zIndex: 9997,
  },
  position: {
    right: 80, // links van OfflineSyncFloatingBadge (rechts: 20, breedte ~50)
    bottom: 20,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2B2B2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  btnOn: {
    backgroundColor: theme.colors.statusSuccess, // forest
  },
  btnOff: {
    backgroundColor: theme.colors.borderWarmAlt, // beige
  },
  btnPressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 22,
  },
});
