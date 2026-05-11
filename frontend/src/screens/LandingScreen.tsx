import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Camera, ShieldCheck, FileCheck2, ArrowRight } from 'lucide-react-native';

const speeqLogo3D       = require('../assets/speeq-logo-3d.png');
const speeqQLogo        = require('../assets/speeq-q-logo.png');
const landingVideoSmall = require('../assets/landing-hero.mp4');
const landingVideoDesk  = require('../assets/landing-hero-desktop.mp4');

const DESKTOP_BREAKPOINT = 1024;

/**
 * Resolve een require()'d asset naar een src-string voor <video>.
 * Op web levert require(mp4) een URL-string; op native een module-id (die we hier niet gebruiken).
 */
function videoSrc(asset: unknown): string {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object' && 'uri' in (asset as Record<string, unknown>)) {
    return String((asset as { uri?: string }).uri ?? '');
  }
  return String(asset ?? '');
}

interface LandingScreenProps {
  /** Klik op "Open de tool" → toont CodeGate */
  onEnterTool: () => void;
}

/**
 * LandingScreen — publieke marketingpagina voor SpeeQ WKB Tool.
 *
 * Twee varianten:
 *   - DESKTOP (≥ 1024px web): cinematic fullscreen video-hero + tekst overlay.
 *   - MOBILE / NATIVE: compacte hero met video of statisch logo (oude flow).
 *
 * De flow erna is op beide hetzelfde:
 *   Landing → Code-Gate → Login → Tool
 */
export default function LandingScreen({ onEnterTool }: LandingScreenProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  if (isDesktop) {
    return <DesktopLanding onEnterTool={onEnterTool} theme={theme} />;
  }
  return <MobileLanding onEnterTool={onEnterTool} theme={theme} />;
}

/* ─────────────────────────────────────────────────────────────────────────
 *  DESKTOP — cinematic fullscreen video hero met tekst-overlay
 *  ───────────────────────────────────────────────────────────────────── */

function DesktopLanding({
  onEnterTool,
  theme,
}: {
  onEnterTool: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const { height } = useWindowDimensions();
  const s = createDesktopStyles(theme);

  // Hero blok = 90vh, met min/max guard zodat het op kleine laptops nog mooi blijft.
  const heroHeight = Math.min(Math.max(Math.round(height * 0.9), 640), 1080);

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      // Geen horizontale padding op hero — video is full-bleed.
    >
      {/* ─── Hero (video + overlay) ────────────────────────────── */}
      <View style={[s.heroWrap, { height: heroHeight }]}>
        {/* Laag 0: video achtergrond */}
        {React.createElement('video', {
          src: videoSrc(landingVideoDesk),
          autoPlay: true,
          muted: true,
          loop: true,
          playsInline: true,
          'webkit-playsinline': 'true',
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            background: '#F8FAFC',
            zIndex: 0,
          },
        })}

        {/* Laag 1: subtiele leesbaarheidsgradient LINKERZIJDE — net genoeg contrast voor de tekst,
            niet zo donker dat 't een blok wordt. Logo midden/rechts blijft vrij. */}
        {React.createElement('div', {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '45%',
            background:
              'linear-gradient(to right, rgba(11,22,40,0.27) 0%, rgba(11,22,40,0.15) 35%, rgba(11,22,40,0.04) 75%, rgba(11,22,40,0) 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          },
        })}

        {/* Laag 2: tekst + CTA — links uitgelijnd, verticaal gecentreerd, smalle kolom (blijft weg van logo) */}
        <View style={s.heroContent} pointerEvents="box-none">
          <View style={s.heroTextBlock}>
            <Text style={s.eyebrow}>SPEEQ WKB TOOL</Text>
            <Text style={s.headline}>Wkb-dossier in één foto.</Text>
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
        </View>

        {/* Laag 3: zachte fade naar #F8FAFC zodat de overgang naar de pagina naadloos voelt */}
        {React.createElement('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 24,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0) 0%, #F8FAFC 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          },
        })}
      </View>

      {/* ─── Below the fold ────────────────────────────────────── */}
      <View style={s.belowFold}>
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

        <View style={s.footer}>
          <View style={s.footerDot} />
          <Text style={s.footerText}>
            Spee Solutions 2026 · Kwaliteitsborging voor de bouw
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  MOBILE / NATIVE — compacte hero
 *  ───────────────────────────────────────────────────────────────────── */

function MobileLanding({
  onEnterTool,
  theme,
}: {
  onEnterTool: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const s = createMobileStyles(theme);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.watermark} pointerEvents="none">
        <Image source={speeqQLogo} style={s.watermarkImage} resizeMode="contain" />
      </View>

      <View style={s.hero}>
        <HeroMediaCompact size={Platform.OS === 'web' ? 240 : 180} />
        <Text style={s.eyebrow}>SPEEQ WKB TOOL</Text>
        <Text style={s.headline}>Wkb-dossier in {'\n'}één foto.</Text>
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

      <View style={s.footer}>
        <View style={s.footerDot} />
        <Text style={s.footerText}>
          Spee Solutions 2026 · Kwaliteitsborging voor de bouw
        </Text>
      </View>
    </ScrollView>
  );
}

/** Compacte hero-media voor mobiel / native (klein vierkant blok). */
function HeroMediaCompact({ size }: { size: number }) {
  if (Platform.OS === 'web') {
    return React.createElement('video', {
      src: videoSrc(landingVideoSmall),
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

/* ─────────────────────────────────────────────────────────────────────────
 *  Shared
 *  ───────────────────────────────────────────────────────────────────── */

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
  const s = createMobileStyles(theme); // styling is gedeeld via mobile-style block
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

/* ─────────────────────────────────────────────────────────────────────────
 *  Styles — Desktop
 *  ───────────────────────────────────────────────────────────────────── */

const createDesktopStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    heroWrap: {
      position: 'relative',
      width: '100%',
      backgroundColor: '#F8FAFC',
      overflow: 'hidden',
    },
    heroContent: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: '52%',
      justifyContent: 'center',
      paddingLeft: 72,
      paddingRight: 32,
      paddingVertical: 80,
      zIndex: 3,
    },
    heroTextBlock: {
      maxWidth: 440,
      alignItems: 'flex-start',
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2.6,
      color: '#FFFFFF',
      textTransform: 'uppercase',
      marginBottom: 18,
      opacity: 0.92,
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    headline: {
      fontSize: 54,
      lineHeight: 60,
      fontWeight: '800',
      letterSpacing: -1.2,
      color: '#FFFFFF',
      marginBottom: 20,
      // Iets sterkere textshadow nu de gradient subtieler is — leesbaarheid blijft top.
      textShadowColor: 'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 28,
    },
    sub: {
      fontSize: 17,
      lineHeight: 26,
      color: 'rgba(255,255,255,0.95)',
      marginBottom: 28,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 14,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 18,
      borderRadius: 12,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 6,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    ctaHint: {
      marginTop: 16,
      fontSize: 13,
      color: 'rgba(255,255,255,0.78)',
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    belowFold: {
      maxWidth: 1100,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 24,
      paddingTop: 64,
      paddingBottom: 48,
    },
    featuresWrap: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 48,
    },
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

/* ─────────────────────────────────────────────────────────────────────────
 *  Styles — Mobile / Native (oude flow)
 *  ───────────────────────────────────────────────────────────────────── */

const createMobileStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
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
    hero: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 64,
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
      fontSize: 38,
      lineHeight: 44,
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
