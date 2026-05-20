// frontend/src/components/ui/DiagnoseSidePanel.tsx
//
// Laag 2 van Progressive Disclosure — diepgaande analyse.
// Standaard onzichtbaar. Schuift in als absolute overlay nadat de gebruiker
// bewust op een evidence-card klikt. Behoudt context van de lijst.
//
// Puur Flexbox, geen CSS Grid. Alle kleuren via useTheme.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { SecondaryButton } from './SecondaryButton';
import { AiMetadataBlock } from './AiMetadataBlock';

interface DiagnoseEvidence {
  status?: 'success' | 'warning' | 'neutral';
  statusLabel?: string;
  aiReason?: string | null;
  timestamp?: string | null;
  gps?: string | null;
  uploadedBy?: string | null;
}

interface DiagnoseSidePanelProps {
  evidenceItem: DiagnoseEvidence | null;
  onClose: () => void;
}

export const DiagnoseSidePanel = ({ evidenceItem, onClose }: DiagnoseSidePanelProps) => {
  const { theme } = useTheme();

  // Conditionele rendering: toon niets als er geen item is geselecteerd
  if (!evidenceItem) return null;

  return (
    <View
      style={[
        styles.panelContainer,
        {
          backgroundColor: theme.colors.surface, // Zacht beige oppervlak ipv hard wit
          borderLeftColor: theme.colors.borderWarm, // Warme border afscheiding links
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.borderWarm }]}>
        <Text
          style={[
            styles.title,
            {
              fontFamily: theme.typography.headline.fontFamily,
              fontSize: 24,
              color: theme.colors.textPrimary,
            },
          ]}
        >
          Dossier Diagnose
        </Text>
        {/* Sluitknop die visuele rust bewaart */}
        <SecondaryButton title="Sluiten" onPress={onClose} />
      </View>

      <ScrollView style={styles.content}>
        {/* Laag 2 — Modulair AI + EXIF blok. Schoon & herbruikbaar. */}
        <AiMetadataBlock
          aiStatus={evidenceItem.status || 'warning'}
          aiReason={evidenceItem.aiReason}
          exifData={{
            timestamp: evidenceItem.timestamp,
            gps: evidenceItem.gps,
          }}
        />

        {/* Uploader-info onder de AiMetadataBlock */}
        {evidenceItem.uploadedBy ? (
          <Text
            style={[
              styles.metaText,
              {
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.textMuted,
                marginTop: 16,
              },
            ]}
          >
            Uploader: {evidenceItem.uploadedBy}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panelContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 400,
    borderLeftWidth: 1,
    flexDirection: 'column',
    shadowColor: '#2B2B2B',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 90,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dataBox: {
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'column',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
  },
});
