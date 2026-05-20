// frontend/src/components/ui/DossierActionModal.tsx
//
// Laag 3 van Progressive Disclosure — taakgerichte afhandeling.
// Geïsoleerd in een modal over het dashboard zodat de werkvoorbereider z'n
// context in de lijst niet verliest. Max 1 PrimaryButton, SecondaryButtons
// voor annuleer + afkeuren met warme border.
//
// Pure Flexbox, geen CSS Grid. Alle kleuren via useTheme.

import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface DossierActionEvidence {
  id: string;
  title?: string | null;
}

interface DossierActionModalProps {
  visible: boolean;
  evidenceItem: DossierActionEvidence | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const DossierActionModal = ({
  visible,
  evidenceItem,
  onClose,
  onApprove,
  onReject,
}: DossierActionModalProps) => {
  const { theme } = useTheme();

  if (!evidenceItem) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Donkere semi-transparante backdrop voor visuele focus op de modal */}
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surface, // Zacht beige, GEEN puur wit
              borderColor: theme.colors.borderWarm,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                // Verplicht Bold + Italic serif font voor de hoofdtitel
                fontFamily: theme.typography.headline.fontFamily,
                fontSize: 24,
                color: theme.colors.textPrimary,
              },
            ]}
          >
            Dossieritem Beoordelen
          </Text>

          <Text
            style={[
              styles.description,
              {
                fontFamily: theme.typography.bodyData.fontFamily,
                color: theme.colors.textSecondary,
              },
            ]}
          >
            Weet u zeker dat u de status van "{evidenceItem.title || 'dit bewijsstuk'}" wilt wijzigen?
            Deze actie wordt gelogd in het wettelijke Wkb-dossier.
          </Text>

          <View style={styles.buttonRow}>
            {/* Secundaire actie om cognitieve belasting laag te houden */}
            <SecondaryButton title="Annuleren" onPress={onClose} style={styles.cancelButton} />

            {/* Primaire focus knoppen voor de taakafhandeling */}
            <View style={styles.actionGroup}>
              <SecondaryButton title="Afkeuren" onPress={() => onReject(evidenceItem.id)} />
              <PrimaryButton label="Goedkeuren" onPress={() => onApprove(evidenceItem.id)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 43, 43, 0.4)', // Diep antraciet transparantie
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderWidth: 1,
    borderRadius: 8,
    padding: 32,
    flexDirection: 'column',
    shadowColor: '#2B2B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontWeight: '700',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    marginRight: 'auto',
  },
});
