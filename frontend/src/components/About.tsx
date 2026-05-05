import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getStorageEngineInfo, getStorageEngineLabel } from '../database/storageEngine';
import { getDeviceType } from '../lib/platform';
import { useTheme } from '../theme/ThemeProvider';

export default function About() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = getDeviceType(width) === 'DESKTOP';
  const storageEngine = getStorageEngineInfo();
  const styles = useMemo(() => createStyles(theme, isWide), [theme, isWide]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Wkb Snap & Sync</Text>
      <Text style={styles.subtitle}>Elevator pitch</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏗️ Het concept</Text>
          <Text style={styles.text}>
            Offline‑first Wkb‑app voor Gevolgklasse 1. Bewijslast wordt juridisch
            houdbaar vastgelegd met GPS, EXIF, SHA-256 hashing en tijdstempels,
            zodat de aannemer aantoonbaar voldoet aan de omgekeerde bewijslast
            (art. 7:758 BW).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ De 5 architectonische pijlers</Text>
          <Text style={styles.text}>1. Veld‑camera: onweerlegbaar bewijs.</Text>
          <Text style={styles.text}>
            2. Offline‑first kluis ({getStorageEngineLabel()} + SHA-256).
          </Text>
          <Text style={styles.text}>3. Asynchrone sync‑engine (Supabase).</Text>
          <Text style={styles.text}>4. AI‑poortwachter met live feedback.</Text>
          <Text style={styles.text}>
            5. PDF‑dossier generator (Bevoegd Gezag + Consumentendossier).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ Status</Text>
          <Text style={styles.text}>
            Offline camera, lokale database met bewijs-hashes, cloud‑sync,
            realtime AI‑updates en PDF‑export zijn operationeel.
          </Text>
          {storageEngine.fallbackReason ? (
            <Text style={styles.text}>{storageEngine.fallbackReason}</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: { colors: Record<string, string> }, isWide: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      overflow: 'auto' as any,
    },
    content: {
      width: '100%',
      maxWidth: 1180,
      alignSelf: 'center',
      padding: 20,
      gap: 16,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '700',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      marginTop: -6,
      marginBottom: 8,
    },
    grid: {
      flexDirection: isWide ? 'row' : 'column',
      flexWrap: 'wrap',
      gap: 16,
    },
    card: {
      flex: isWide ? 1 : undefined,
      minWidth: isWide ? 320 : undefined,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    text: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
