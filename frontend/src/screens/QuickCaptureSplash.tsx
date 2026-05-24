/**
 * QuickCaptureSplash — 1-knop scherm voor mobiel in simple-modus.
 *
 * Doel: een vakman die op het Camera-tabblad tikt, ziet 1 grote knop
 * "Maak foto" en is binnen 2 seconden in de camera.
 *
 * Vervangt de StartFlow (Opdrachtgever → Project → Borgingspunt keuze-
 * keten) voor de simple-modus mobiel-flow.
 *
 * Onderdeel van docs/strategie/speeq-simple.md — feedback Johnny 23 mei:
 * "knop werk niet als hij in dit deel niet hoef te werken kun je de
 *  knop beter uit dit deel halen maar als hij hier wel moet wwrken
 *  maak het dan"
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { designTokens } from '../theme/designTokens';
import type { CaptureTask } from '../types/CaptureTask';

const theme = designTokens;

/**
 * Default-task die wordt gebruikt wanneer een vakman op "Maak foto" tikt
 * zonder eerst een borgingspunt te kiezen. Vrije controle-foto die later
 * door de werkvoorbereider kan worden gekoppeld aan een specifiek punt.
 */
export const QUICK_PHOTO_TASK: CaptureTask = {
  id: 'quick-photo',
  title: 'Vrije foto',
  description: 'Snelle vastlegging — werkvoorbereider koppelt later aan punt',
  inspectionPointId: 'vrije-foto',
  instruction: 'Maak een duidelijke foto van wat je wilt vastleggen op de bouwplaats.',
  selectionSource: 'WKB',
};

export interface QuickCaptureSplashProps {
  onMakeQuickPhoto: (task: CaptureTask) => void;
  onChooseInspectionPoint?: () => void;
  userFirstName?: string;
}

export const QuickCaptureSplash: React.FC<QuickCaptureSplashProps> = ({
  onMakeQuickPhoto,
  onChooseInspectionPoint,
  userFirstName,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.greeting}>
          {userFirstName ? `Hé ${userFirstName}` : 'Hé'} 👋
        </Text>
        <Text style={styles.subtitle}>Wat ga je vastleggen?</Text>
      </View>

      <Pressable
        onPress={() => onMakeQuickPhoto(QUICK_PHOTO_TASK)}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && styles.btnPressed,
        ]}
        accessibilityLabel="Direct een foto maken"
        accessibilityRole="button"
      >
        <Text style={styles.primaryIcon}>📷</Text>
        <Text style={styles.primaryText}>Maak foto</Text>
        <Text style={styles.primarySub}>Direct in de camera</Text>
      </Pressable>

      {onChooseInspectionPoint ? (
        <Pressable
          onPress={onChooseInspectionPoint}
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.secondaryText}>
            of: kies eerst een specifiek borgingspunt
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          De werkvoorbereider koppelt je foto's later aan het juiste project.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textPrimary,
    opacity: 0.72,
  },
  primaryBtn: {
    backgroundColor: theme.colors.statusSuccess,
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    minHeight: 140,
    justifyContent: 'center',
    gap: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(31, 77, 58, 0.25)' }
      : {
          shadowColor: '#1F4D3A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        }),
  },
  primaryIcon: {
    fontSize: 44,
    marginBottom: 6,
  },
  primaryText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primarySub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
    marginTop: 8,
  },
  secondaryText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    opacity: 0.75,
  },
  btnPressed: {
    opacity: 0.85,
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 12,
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    opacity: 0.45,
  },
});
