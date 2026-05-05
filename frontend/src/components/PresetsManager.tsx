import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {
  addPreset,
  getInspectionPresets,
  getProjectPresets,
  removePreset,
} from '../database/database';
import { getDeviceType } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';

export default function PresetsManager() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [projectInput, setProjectInput] = useState('');
  const [inspectionInput, setInspectionInput] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [inspections, setInspections] = useState<string[]>([]);
  const deviceType = getDeviceType(width);
  const isWide = deviceType === 'DESKTOP';
  const isCompact = deviceType === 'MOBILE';
  const styles = useMemo(
    () => createStyles(theme, isWide, isCompact),
    [theme, isWide, isCompact]
  );

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const [projectData, inspectionData] = await Promise.all([
      getProjectPresets(),
      getInspectionPresets(),
    ]);
    setProjects(projectData);
    setInspections(inspectionData);
  };

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.localeCompare(b)),
    [projects]
  );
  const sortedInspections = useMemo(
    () => [...inspections].sort((a, b) => a.localeCompare(b)),
    [inspections]
  );

  const addProject = () => {
    const value = projectInput.trim();
    if (!value) return;
    addPreset('project', value);
    setProjectInput('');
    loadPresets();
  };

  const addInspection = () => {
    const value = inspectionInput.trim();
    if (!value) return;
    addPreset('inspection', value);
    setInspectionInput('');
    loadPresets();
  };

  const removeProject = (value: string) => {
    removePreset('project', value);
    loadPresets();
  };

  const removeInspection = (value: string) => {
    removePreset('inspection', value);
    loadPresets();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Presetbeheer</Text>

      <View style={styles.sectionGrid}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projecten</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={projectInput}
              onChangeText={setProjectInput}
              placeholder="Project ID"
              placeholderTextColor="#8B96A8"
            />
            <TouchableOpacity style={styles.addButton} onPress={addProject}>
              <Text style={styles.addButtonText}>Toevoegen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.list}>
            {sortedProjects.map((item) => (
              <View key={item} style={styles.listItem}>
                <Text style={styles.listText}>{item}</Text>
                <TouchableOpacity onPress={() => removeProject(item)}>
                  <Text style={styles.removeText}>Verwijder</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspectiepunten</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inspectionInput}
              onChangeText={setInspectionInput}
              placeholder="Inspectiepunt ID"
              placeholderTextColor="#8B96A8"
            />
            <TouchableOpacity style={styles.addButton} onPress={addInspection}>
              <Text style={styles.addButtonText}>Toevoegen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.list}>
            {sortedInspections.map((item) => (
              <View key={item} style={styles.listItem}>
                <Text style={styles.listText}>{item}</Text>
                <TouchableOpacity onPress={() => removeInspection(item)}>
                  <Text style={styles.removeText}>Verwijder</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.note}>
        Presets worden lokaal opgeslagen en automatisch naar Supabase gestuurd
        zodra cloudconfiguratie beschikbaar is.
      </Text>
    </ScrollView>
  );
}

const createStyles = (
  theme: { colors: Record<string, string> },
  isWide: boolean,
  isCompact: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    content: {
      width: '100%',
      maxWidth: 1280,
      alignSelf: 'center',
      padding: 20,
      gap: 20,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '700',
    },
    sectionGrid: {
      flexDirection: isWide ? 'row' : 'column',
      gap: 20,
      alignItems: 'stretch',
    },
    section: {
      flex: isWide ? 1 : undefined,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    inputRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      color: theme.colors.textPrimary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    addButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 16,
      minHeight: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonText: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    list: {
      gap: 8,
    },
    listItem: {
      flexDirection: isCompact ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isCompact ? 'flex-start' : 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 8,
    },
    listText: {
      color: theme.colors.textPrimary,
    },
    removeText: {
      color: theme.colors.danger,
      fontSize: 12,
    },
    note: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
