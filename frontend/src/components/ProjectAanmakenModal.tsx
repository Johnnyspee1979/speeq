/**
 * ProjectAanmakenModal — snel een nieuw WKB-project aanmaken.
 * Toont een bottom-sheet modal met de belangrijkste velden.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { createProject, type WkbProject } from '../services/ProjectService';

type Theme = {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (project: WkbProject) => void;
  theme: Theme;
}

export default function ProjectAanmakenModal({ visible, onClose, onCreated, theme }: Props) {
  const [name, setName]             = useState('');
  const [address, setAddress]       = useState('');
  const [initiator, setInitiator]   = useState('');
  const [kadastrale, setKadastrale] = useState('');
  const [saving, setSaving]         = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Vereist', 'Projectnaam is verplicht.');
      return;
    }
    setSaving(true);
    const result = await createProject({
      name: name.trim(),
      address: address.trim() || undefined,
      initiatorName: initiator.trim() || undefined,
      kadastrale: kadastrale.trim() || undefined,
    });
    setSaving(false);
    if (result) {
      onCreated(result);
      reset();
      onClose();
    } else {
      Alert.alert('Fout', 'Kon project niet aanmaken. Controleer de verbinding.');
    }
  }, [name, address, initiator, kadastrale, onCreated, onClose]);

  const reset = () => {
    setName(''); setAddress(''); setInitiator(''); setKadastrale('');
  };

  const s = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => { onClose(); reset(); }}
    >
      <View style={s.overlay}>
        <View style={[s.box, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: theme.colors.textPrimary }]}>
              🏗️ Nieuw project aanmaken
            </Text>
            <TouchableOpacity onPress={() => { onClose(); reset(); }}>
              <Text style={[s.closeBtn, { color: theme.colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>PROJECTNAAM *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="Bijv. Nieuwbouw Woning Amstelveen"
              placeholderTextColor={theme.colors.textSecondary + '88'}
            />

            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>ADRES</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Bijv. Koninginneweg 12, Amsterdam"
              placeholderTextColor={theme.colors.textSecondary + '88'}
            />

            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>OPDRACHTGEVER / INITIATIEFNEMER</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              value={initiator}
              onChangeText={setInitiator}
              placeholder="Naam opdrachtgever of BV"
              placeholderTextColor={theme.colors.textSecondary + '88'}
            />

            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>KADASTRALE AANDUIDING</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
              value={kadastrale}
              onChangeText={setKadastrale}
              placeholder="Bijv. AMS01 A 1234"
              placeholderTextColor={theme.colors.textSecondary + '88'}
            />

            <View style={[s.infoBanner, { backgroundColor: theme.colors.accent + '10', borderColor: theme.colors.accent + '30' }]}>
              <Text style={[s.infoText, { color: theme.colors.textSecondary }]}>
                💡 Na aanmaken kunt u in Team Beheer vakmansen toevoegen en borgingspunten toewijzen.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: name.trim() ? theme.colors.accent : '#ccc' }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>✓ Project aanmaken</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  box: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, maxHeight: '88%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  title: { fontSize: 17, fontWeight: '800' },
  closeBtn: { fontSize: 22, padding: 4 },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4,
    textTransform: 'uppercase', marginBottom: 6, marginTop: 14,
  },
  input: {
    height: 44, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 14, marginBottom: 2,
  },
  infoBanner: {
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 16,
  },
  infoText: { fontSize: 12, lineHeight: 18 },
  saveBtn: {
    height: 48, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', marginTop: 18, marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
