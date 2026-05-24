/**
 * AiSuggestionCard — toont AI's beste gok over wat op een foto staat,
 * met 1-tap bevestiging voor de vakman.
 *
 * Doel uit "Super Registratie"-voorstel (Johnny 24 mei):
 * vakman tikt 2 keer, AI vult alle metadata.
 *
 * Pure UI bovenop bestaande LocalMobileNetClassifier (#53).
 * Geen API-kosten, on-device inference, gratis.
 *
 * Gebruikt in CameraView mobile-confirm scherm — verschijnt boven
 * de bestaande velden. Bestaande flow blijft 100% intact.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { designTokens } from '../theme/designTokens';
import {
  classifyPhotoCategory,
  type CategoryPrediction,
  type WkbCategory,
} from '../services/LocalMobileNetClassifier';

const theme = designTokens;

export interface AiSuggestionCardProps {
  /** Photo URI to classify (blob: of file:) */
  photoUri: string | null;
  /** Aangeroepen bij 'klopt' — slaat direct op met AI's gok */
  onAccept: (prediction: CategoryPrediction) => void;
  /** Aangeroepen bij 'wijzig' — toont oude flow */
  onReject: () => void;
}

const CATEGORY_LABELS: Record<WkbCategory, string> = {
  fundering: 'Fundering',
  wapening: 'Wapening',
  beton: 'Beton',
  isolatie: 'Isolatie',
  metselwerk: 'Metselwerk',
  staal: 'Staal',
  hout: 'Hout / timmerwerk',
  kabels: 'Elektra / kabels',
  leidingen: 'Leidingen / sanitair',
  dak: 'Dak',
  gereedschap: 'Gereedschap',
  persoon: 'Persoon op foto',
  overig: 'Bouwwerk (overig)',
  unknown: 'Onbekend',
};

export const AiSuggestionCard: React.FC<AiSuggestionCardProps> = ({
  photoUri,
  onAccept,
  onReject,
}) => {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<CategoryPrediction | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoUri) {
      setLoading(false);
      setPrediction(null);
      return;
    }
    setLoading(true);
    void classifyPhotoCategory(photoUri).then((result) => {
      if (cancelled) return;
      setPrediction(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUri]);

  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color={theme.colors.statusSuccess} />
        <Text style={styles.loadingText}>🤖 AI analyseert de foto...</Text>
      </View>
    );
  }

  if (!prediction || prediction.category === 'unknown') {
    // AI weet 't niet zeker — verberg de card en val terug op oude flow
    return null;
  }

  const confidencePct = Math.round(prediction.confidence * 100);
  const label = CATEGORY_LABELS[prediction.category];

  return (
    <View style={styles.card}>
      <Text style={styles.aiLabel}>🤖 AI denkt</Text>
      <Text style={styles.categoryText}>{label}</Text>
      <Text style={styles.confidenceText}>
        {confidencePct}% zeker · gebaseerd op '{prediction.rawLabel}'
      </Text>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => onAccept(prediction)}
          style={({ pressed }) => [
            styles.btn,
            styles.btnAccept,
            pressed && styles.btnPressed,
          ]}
          accessibilityLabel="AI-suggestie accepteren en direct opslaan"
        >
          <Text style={styles.btnAcceptText}>👍 Klopt — opslaan</Text>
        </Pressable>
        <Pressable
          onPress={onReject}
          style={({ pressed }) => [
            styles.btn,
            styles.btnReject,
            pressed && styles.btnPressed,
          ]}
          accessibilityLabel="AI-suggestie afwijzen en zelf invullen"
        >
          <Text style={styles.btnRejectText}>✏️ Wijzig</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: theme.colors.statusSuccess,
  },
  cardLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: theme.colors.borderWarm,
  },
  loadingText: {
    color: theme.colors.textPrimary,
    opacity: 0.75,
    fontSize: 14,
  },
  aiLabel: {
    fontSize: 12,
    color: theme.colors.statusSuccess,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    opacity: 0.6,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnAccept: {
    backgroundColor: theme.colors.statusSuccess,
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnReject: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.borderWarm,
  },
  btnRejectText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
