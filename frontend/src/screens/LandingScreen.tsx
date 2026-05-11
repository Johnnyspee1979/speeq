import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Camera, ShieldCheck, FileCheck2, ArrowRight } from 'lucide-react-native';

const speeqLogo3D  = require('../assets/speeq-logo-3d.png');
const speeqQLogo   = require('../assets/speeq-q-logo.png');
const landingVideo = require('../assets/landing-hero.mp4');

/**
 * HeroMedia — toont op web de NanoBanana landing-video,
 * op native (iOS/Android) valt-ie terug op het statische 3D logo.
 *
 * React Native heeft geen ingebouwd <video>-element; we gebruiken
 * React.createElement('video', ...) zodat dit op web werkt zonder
 * extra deps. Op native rendert dit een gewone <Image>.
 */
function HeroMedia({ size }: { size: number }) {
  if (Platform.OS === 'web') {
    // require() voor mp4 levert op web een URL-string (Webpack/Metro web).
    const src = typeof landingVideo === 'string' ? landingVideo : (landingVideo as { uri?: string })?.uri ?? landingVideo;
    return React.createElement('video', {
      src,
      autoPlay: true,
      muted: true,
      loop: true,
      playsInline: true,
      'webkit-playsinline': 'true',
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        background: 'transparent',
        marginBottom: 24,
      },
    });
  }
  return (
    <Image
      source={speeqLogo3D}
      style={{ width: size, height: size, marginBottom: 24 }}
      resizeMode="contain"
    />
  );
}

interface LandingScreenProps {
  /** Klik op "Open de tool" → toont CodeGate */
  onEnterTool: () => void;
}

/**
 * LandingScreen — publieke marketingpagina voor SpeeQ WKB Tool.
 *
 * Structuur (Lovable redesign-target):
 *   - Hero: 3D logo + headline + sub + primary CTA
 *   - 3 feature cards (camera / AI-review / dossier)
 *   - Footer met code-gate hint
 *
 * Bewust minimalistisch gehouden — Johnny laat Lovable AI later
 * de visuele lagen toevoegen (illustraties, screenshots, animaties).
 */
export default function LandingScreen({ onEnterTool }: LandingScreenProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Subtiele Q-watermark rechtsboven (Govtech rust) */}
      <View style={s.watermark} pointerEvents="none">
        <Image source={speeqQLogo} style={s.watermarkImage} resizeMode="contain" />
      </View>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <View style={s.hero}>
        <HeroMedia size={Platform.OS === 'web' ? 280 : 180} />
        <Text style={s.eyebrow}>SPEEQ WKB TOOL</Text>
        <Text style={s.headline}>
          Wkb-dossier in {'\n'}één foto.
        </Text>
        <Text style={s.sub}>
          De vakman maakt een foto, SpeeQ doet de rest — AI-validatie,
          GPS-koppeling, dossier-opbouw. Geen Excel-lijstjes meer.
        </Text>

        <Pressable
          onPress={onEnterTool}
          style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        >
          <Text style={s.ctaText}>Open de tool</Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </Pressable>

        <Text style={s.ctaHint}>
          Je hebt een toegangscode nodig — vraag deze aan bij Spee Solutions.
        </Text>
      </View>

      {/* ─── Features ─────────────────────────────────────────── */}
      <View style={s.featuresWrap}>
        <FeatureCard
          Icon={Camera}
          title="Vakman maakt foto"
          body="In het veld, met je telefoon. SpeeQ herkent het borgingspunt automatisch."
          theme={theme}
        />
        <FeatureCard
          Icon={ShieldCheck}
          title="AI-validatie"
          body="Automatische controle of de foto aan de Wkb-eisen voldoet. Direct feedback."
          theme={theme}
        />
        <FeatureCard
          Icon={FileCheck2}
          title="Borgingsdossier"
          body="Compleet PDF-dossier voor de gemeente — met alle bewijzen, geo-tags en tijdstempels."
          theme={theme}
        />
      </View>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <View style={s.footer}>
        <View style={s.footerDot} />
        <Text style={s.footerText}>
          Spee Solutions 2026 · Kwaliteitsborging voor de bouw
        </Text>
      </View>
    </ScrollView>
  );
}

function FeatureCard({
  Icon,
  title,
  body,
  theme,
}: {
  Icon: typeof Camera;
  title: string;
  body: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const s = createStyles(theme);
  return (
    <View style={s.featureCard}>
      <View style={s.featureIconWrap}>
        <Icon size={20} color={theme.colors.accent} />
      </View>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.featureBody}>{body}</Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingVertical: 48,
      paddingHorizontal: 24,
      maxWidth: 1100,
      width: '100%',
      alignSelf: 'center',
    },
    watermark: {
      position: 'absolute',
      top: -80,
      right: -120,
      width: 420,
      height: 420,
      opacity: 0.04,
      transform: [{ rotate: '15deg' }],
    },
    watermarkImage: { width: '100%', height: '100%' },

    // Hero
    hero: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 64,
    },
    heroLogo: {
      width: Platform.OS === 'web' ? 220 : 160,
      height: Platform.OS === 'web' ? 220 : 160,
      marginBottom: 24,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2.2,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 16,
    },
    headline: {
      fontSize: Platform.OS === 'web' ? 56 : 38,
      lineHeight: Platform.OS === 'web' ? 60 : 44,
      fontWeight: '800',
      letterSpacing: -1.2,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 20,
    },
    sub: {
      fontSize: 17,
      lineHeight: 26,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 560,
      marginBottom: 32,
    },

    // CTA
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: 12,
      shadowColor: theme.colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 4,
    },
    ctaPressed: { opacity: 0.85 },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    ctaHint: {
      marginTop: 14,
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },

    // Features
    featuresWrap: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: 16,
      marginBottom: 48,
    },
    featureCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 24,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    featureIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    featureTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    featureBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    footerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
  });
