import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import { Box, QrCode, ScanLine, XCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

interface WkbBimScannerProps {
  onGuidScanned: (ifcGuid: string) => void;
  onCancel: () => void;
}

const isLikelyIfcGuid = (value: string) => {
  const trimmed = value.trim();
  return /^[0-9A-Za-z_$-]{20,32}$/.test(trimmed);
};

export default function WkbBimScanner({
  onGuidScanned,
  onCancel,
}: WkbBimScannerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScanned) {
      return;
    }

    const scannedValue = data.trim();
    setHasScanned(true);

    if (!isLikelyIfcGuid(scannedValue)) {
      Alert.alert('Geen geldige BIM-code', 'Dit lijkt geen bruikbare IFC/BCF QR-code.', [
        { text: 'Probeer opnieuw', onPress: () => setHasScanned(false) },
        { text: 'Annuleren', style: 'cancel', onPress: onCancel },
      ]);
      return;
    }

    Alert.alert(
      'BIM element gekoppeld',
      `IFC GUID: ${scannedValue}\n\nLeg nu het bewijs vast voor dit 3D-element.`,
      [
        {
          text: 'Verder',
          onPress: () => onGuidScanned(scannedValue),
        },
      ]
    );
  };

  if (!permission) {
    return <View style={styles.loadingState} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionState}>
        <Box color="#F5D642" size={34} />
        <Text style={styles.permissionTitle}>Camera nodig voor BIM-scan</Text>
        <Text style={styles.permissionText}>
          Scan de QR-sticker van het IFC-element zodat de foto later precies aan het
          juiste 3D-object gekoppeld kan worden.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Geef cameratoegang</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Annuleren</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>BCF SMART LINK</Text>
              <Text style={styles.headerTitle}>Scan BIM/IFC element</Text>
              <Text style={styles.headerText}>
                Richt op de QR-sticker van de werkvoorbereider. We lezen alleen QR-codes
                en slaan de `ifcGuid` lokaal op.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
              <XCircle color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.scanStage}>
            <View style={styles.scanTarget}>
              <QrCode color="rgba(255,255,255,0.35)" size={124} />
              <ScanLine color="#F5D642" size={34} />
            </View>
            <Text style={styles.scanHint}>
              Scan het elementlabel op kolom, funderingsbalk of sparing.
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={onCancel}>
              <Text style={styles.footerButtonText}>Annuleren</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ExpoCameraView>
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useTheme>['theme']
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    overlay: {
      flex: 1,
      justifyContent: 'space-between',
      backgroundColor: 'rgba(0, 0, 0, 0.36)',
      paddingHorizontal: 18,
      paddingBottom: 24,
    },
    loadingState: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    permissionState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      backgroundColor: theme.colors.background,
    },
    permissionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      marginTop: 16,
      marginBottom: 10,
      textAlign: 'center',
    },
    permissionText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 20,
    },
    permissionButton: {
      minHeight: 56,
      borderRadius: 14,
      backgroundColor: '#FF6600',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    cancelLink: {
      marginTop: 16,
      padding: 8,
    },
    cancelLinkText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 14,
      paddingTop: 10,
    },
    headerCopy: {
      flex: 1,
      backgroundColor: 'rgba(8, 11, 18, 0.82)',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(245, 214, 66, 0.22)',
    },
    headerEyebrow: {
      color: '#F5D642',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      marginBottom: 8,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 6,
    },
    headerText: {
      color: '#D7E2F0',
      fontSize: 13,
      lineHeight: 19,
    },
    closeButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(8, 11, 18, 0.82)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    scanStage: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      paddingHorizontal: 12,
    },
    scanTarget: {
      width: '100%',
      maxWidth: 320,
      aspectRatio: 1,
      borderRadius: 28,
      borderWidth: 3,
      borderColor: '#F5D642',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    scanHint: {
      color: '#F8FAFC',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    footer: {
      alignItems: 'center',
    },
    footerButton: {
      minWidth: 180,
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    footerButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });
