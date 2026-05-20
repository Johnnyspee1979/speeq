// frontend/src/components/ui/AiMetadataBlock.tsx
//
// Laag 2 — Diagnose. Modulair blok met AI-oordeel + EXIF metadata.
// Standaard verborgen, alleen 'on demand' getoond in het DiagnoseSidePanel.
// Pure Flexbox. Alle kleuren via useTheme — geen wit/zwart, geen blauw.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { StatusPill } from './StatusPill';

interface AiMetadataBlockProps {
  aiStatus: 'success' | 'warning' | 'neutral';
  aiReason?: string | null;
  confidenceScore?: number | null;
  exifData?: {
    timestamp?: string | null;
    gps?: string | null;
  };
}

export const AiMetadataBlock = ({
  aiStatus,
  aiReason,
  confidenceScore,
  exifData,
}: AiMetadataBlockProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* AI Analyse Sectie */}
      <Text
        style={[
          styles.sectionTitle,
          {
            fontFamily: theme.typography.sectionTitle.fontFamily,
            color: theme.colors.textPrimary,
          },
        ]}
      >
        Systeemoordeel & AI-Check
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceAlt,
            borderColor: theme.colors.borderWarm,
          },
        ]}
      >
        <View style={styles.row}>
          <StatusPill
            status={aiStatus}
            label={aiStatus === 'success' ? 'AI Goedgekeurd' : 'AI Afgekeurd'}
          />
          {confidenceScore != null ? (
            <Text
              style={[
                styles.metaText,
                {
                  fontFamily: theme.typography.caption.fontFamily,
                  color: theme.colors.textMuted,
                },
              ]}
            >
              Zekerheid: {confidenceScore}%
            </Text>
          ) : null}
        </View>
        {aiReason ? (
          <Text
            style={[
              styles.bodyText,
              {
                fontFamily: theme.typography.bodyData.fontFamily,
                color: theme.colors.textPrimary,
              },
            ]}
          >
            Reden: {aiReason}
          </Text>
        ) : null}
      </View>

      {/* EXIF Metadata Sectie */}
      <Text
        style={[
          styles.sectionTitle,
          {
            fontFamily: theme.typography.sectionTitle.fontFamily,
            color: theme.colors.textPrimary,
            marginTop: 24,
          },
        ]}
      >
        Wettelijke EXIF Metadata
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.backgroundAlt,
            borderColor: theme.colors.borderWarm,
          },
        ]}
      >
        <Text
          style={[
            styles.metaText,
            {
              fontFamily: theme.typography.bodyData.fontFamily,
              color: theme.colors.textSecondary,
            },
          ]}
        >
          Tijdstip: {exifData?.timestamp || 'Geen betrouwbare data'}
        </Text>
        <Text
          style={[
            styles.metaText,
            {
              fontFamily: theme.typography.bodyData.fontFamily,
              color: theme.colors.textSecondary,
            },
          ]}
        >
          Locatie (GPS): {exifData?.gps || 'Geen betrouwbare data'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaText: {
    fontSize: 14,
  },
});
