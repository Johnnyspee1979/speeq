/**
 * EmptyProjectWizard — vriendelijke onboarding voor lege projecten.
 *
 * Vervangt de saaie "Nog geen bewijsstukken"-tekst door een
 * actionable wizard die per platform anders renderert:
 *
 *  Desktop / tablet (width >= 768):
 *    👋 + uitleg + QR-code naar productie-URL met project-deeplink
 *    "Scan met je telefoon om te beginnen"
 *
 *  Mobiel (width < 768):
 *    👋 + groene primary-button "Open Punchlist"
 *    + optionele tweede knop "Bekijk demo-foto's"
 *
 * Self-contained — geen externe state nodig. Optionele callbacks:
 *  - onOpenPunchlist: roept aan bij mobiele primary-knop
 *  - onAddDemo:       optionele demo-data knop (toekomst)
 *
 * QR-code gegenereerd via `qrcode` lib (pure JS, geen native deps).
 * Genereert dataURL bij mount, hergebruikt bij re-renders.
 *
 * Onderdeel van docs/sessies/2026-05-23-ux-ultraplan.md — quick win #1.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'qrcode';
import { designTokens } from '../../theme/designTokens';

const theme = designTokens;

export interface EmptyProjectWizardProps {
  /** Project-id om deep-link te bouwen. Optional. */
  projectId?: string;
  /** Wat te doen bij klik "Open Punchlist" op mobiel. */
  onOpenPunchlist?: () => void;
  /** Toon ook secundaire "Demo-foto's"-knop (toekomst). */
  showDemoOption?: boolean;
  onAddDemo?: () => void;
}

const MOBILE_BREAKPOINT = 768;

function buildDeepLink(projectId?: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    // Native fallback — productie-URL hard-coded
    const base = 'https://speeq-wkb.vercel.app';
    return projectId ? `${base}?project=${encodeURIComponent(projectId)}` : base;
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  return projectId ? `${base}?project=${encodeURIComponent(projectId)}` : base;
}

async function generateQrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: theme.colors.statusSuccess, // forest groen
        light: theme.colors.background, // cream — fits warm minimal
      },
    });
  } catch (err) {
    console.warn('[EmptyProjectWizard] QR generation failed:', err);
    return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const EmptyProjectWizard: React.FC<EmptyProjectWizardProps> = ({
  projectId,
  onOpenPunchlist,
  showDemoOption = false,
  onAddDemo,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const deepLink = buildDeepLink(projectId);

  // Genereer QR-code alleen op desktop (mobiel heeft het niet nodig)
  useEffect(() => {
    if (isMobile) return;
    let cancelled = false;
    setQrLoading(true);
    void (async () => {
      const url = await generateQrDataUrl(deepLink);
      if (!cancelled) {
        setQrDataUrl(url);
        setQrLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLink, isMobile]);

  const handleCopyLink = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(deepLink);
    }
  }, [deepLink]);

  // ─── Mobiele variant ─────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Klaar voor je eerste foto?</Text>
        <Text style={styles.body}>
          Open de Borgingslijst, kies een controlepunt en tik op het camera-icoon.
        </Text>

        {onOpenPunchlist ? (
          <Pressable
            onPress={onOpenPunchlist}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>Open Borgingslijst</Text>
          </Pressable>
        ) : null}

        {showDemoOption && onAddDemo ? (
          <Pressable
            onPress={onAddDemo}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.secondaryBtnText}>Of: bekijk met demo-foto's</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // ─── Desktop / tablet variant ────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.title}>Maak je eerste foto op de bouwplaats</Text>
      <Text style={styles.body}>
        Scan deze QR-code met je telefoon — daar maak je foto's. Zodra je upload
        verschijnt 'ie hier in het dashboard.
      </Text>

      <View style={styles.qrBox}>
        {qrLoading ? (
          <ActivityIndicator color={theme.colors.statusSuccess} />
        ) : qrDataUrl ? (
          <Image
            source={{ uri: qrDataUrl }}
            style={styles.qrImage}
            accessibilityLabel="QR-code naar mobiele app"
          />
        ) : (
          <Text style={styles.body}>QR-code niet beschikbaar.</Text>
        )}
      </View>

      <Pressable
        onPress={handleCopyLink}
        style={({ pressed }) => [
          styles.secondaryBtn,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.secondaryBtnText}>📋 Link kopiëren in plaats van scannen</Text>
      </Pressable>

      {showDemoOption && onAddDemo ? (
        <Pressable
          onPress={onAddDemo}
          style={({ pressed }) => [
            styles.tertiaryBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.tertiaryBtnText}>
            Of: laad demo-foto's om het dashboard te bekijken
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Styles (Warm Minimal) ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
    maxWidth: 480,
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    opacity: 0.72,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  qrBox: {
    width: 240,
    height: 240,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  primaryBtn: {
    backgroundColor: theme.colors.statusSuccess,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderWarm,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  secondaryBtnText: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
    fontSize: 13,
  },
  tertiaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  tertiaryBtnText: {
    color: theme.colors.textPrimary,
    opacity: 0.55,
    fontSize: 12,
    textAlign: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
});
