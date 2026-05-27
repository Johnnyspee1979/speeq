/**
 * MakerNewTenantScreen — Maker-only wizard om een nieuwe SpeeQ-klant
 * (tenant = heel bouwbedrijf) aan te maken in een paar klikken.
 *
 * Wie ziet dit: alleen `johnny@speesolutions.com` (zie App.tsx gate).
 *
 * Wat gebeurt onder de motor bij submit:
 *  1. INSERT in `tenants` (slug, company_name, admin_email, provisioning_status='active')
 *  2. INSERT default rij in `tenant_branding` (display_name, primary_color, logo_url)
 *  3. INSERT default `tenant_features` rows (alleen pdf_export + gps_tracking aan)
 *  4. Toon SQL-snippet om in Supabase MCP/SQL Editor een eerste KEYUSER
 *     auth.user + profile aan te maken (vereist service-role, dus niet
 *     client-side haalbaar zonder Edge Function — pragmatisch via copy/paste).
 *
 * Per Johnny 25 mei: "hoe maak ik als developer nieuwe klanten aan?"
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Building2, KeyRound, ExternalLink, Copy, CheckCircle2, Upload, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import { FEATURE_KEYS } from '../services/TenantFeaturesService';
import { uploadLogoToStorage } from '../services/TenantBrandingService';

// Welke features default aan bij nieuwe klant — minimale set
const DEFAULT_ON_FEATURES = new Set(['pdf_export', 'gps_tracking', 'ai_review', 'qr_stickers']);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function randomPassword(len = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface Props {
  onBack: () => void;
}

export default function MakerNewTenantScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [bedrijfsnaam, setBedrijfsnaam] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [keyuserEmail, setKeyuserEmail] = useState('');
  const [keyuserNaam, setKeyuserNaam] = useState('');
  const [accentKleur, setAccentKleur] = useState('#1B3A5C');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ slug: string; password: string; sql: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /** Open native bestandskiezer. */
  const handlePickLogo = () => fileInputRef.current?.click();

  /** Upload gekozen bestand naar Supabase storage en zet de public URL. */
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset zodat zelfde bestand opnieuw kan
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Kies een afbeelding (PNG, JPG of SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo te groot — max 2 MB.');
      return;
    }
    setLogoUploading(true);
    try {
      // Prefix met slug zodat 't pad herkenbaar is in storage-bucket.
      const url = await uploadLogoToStorage(file, `tenant-${effectiveSlug || 'new'}`);
      setLogoUrl(url);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload mislukt');
    } finally {
      setLogoUploading(false);
    }
  };

  // Auto-slug uit bedrijfsnaam, tenzij user al iets typte
  const effectiveSlug = slugInput.trim() || slugify(bedrijfsnaam);

  const canSubmit = useMemo(() => {
    return (
      bedrijfsnaam.trim().length >= 2 &&
      effectiveSlug.length >= 2 &&
      /^[a-z0-9-]+$/.test(effectiveSlug) &&
      keyuserEmail.trim().length > 3 &&
      keyuserNaam.trim().length >= 2 &&
      !busy
    );
  }, [bedrijfsnaam, effectiveSlug, keyuserEmail, keyuserNaam, busy]);

  const handleSubmit = async () => {
    setBusy(true);
    setResult(null);
    try {
      // 1. Bestaande slug check
      const { data: existing } = await supabase
        .from('tenants')
        .select('slug')
        .eq('slug', effectiveSlug)
        .maybeSingle();
      if (existing) {
        Alert.alert('Slug bestaat al', `Tenant '${effectiveSlug}' bestaat al. Kies een andere slug.`);
        setBusy(false);
        return;
      }

      // 2. INSERT tenants rij
      const { error: tErr } = await supabase.from('tenants').insert({
        slug: effectiveSlug,
        company_name: bedrijfsnaam.trim(),
        admin_email: keyuserEmail.trim().toLowerCase(),
        provisioning_status: 'active',
        users: 1,
      });
      if (tErr) throw new Error(`tenants insert: ${tErr.message}`);

      // 3. tenant_branding (zelfde slug als koppeling)
      const { error: bErr } = await supabase.from('tenant_branding').insert({
        company_id: effectiveSlug,
        slug: effectiveSlug,
        display_name: bedrijfsnaam.trim(),
        primary_color: accentKleur,
        logo_url: logoUrl.trim() || null,
      });
      if (bErr) console.warn('tenant_branding insert mislukt (niet fataal):', bErr.message);

      // 4. tenant_features defaults
      const featureRows = FEATURE_KEYS.map((k) => ({
        tenant_id: effectiveSlug,
        project_id: null,
        feature_key: k,
        enabled: DEFAULT_ON_FEATURES.has(k),
        set_by_role: 'SPEE',
      }));
      const { error: fErr } = await supabase.from('tenant_features').insert(featureRows);
      if (fErr) console.warn('tenant_features insert mislukt (niet fataal):', fErr.message);

      // 5. Genereer SQL voor keyuser auth.user (service role nodig, copy/paste)
      const pw = randomPassword();
      const sql = `-- Run dit in Supabase SQL Editor om de keyuser-account te activeren:
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated', 'authenticated',
  '${keyuserEmail.trim().toLowerCase()}',
  crypt('${pw}', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"KEYUSER","tenant_id":"${effectiveSlug}","display_name":"${keyuserNaam.trim()}"}',
  now(), now(), '', '', '', ''
RETURNING id, email;

-- Plak het uitgekomen UUID hieronder:
INSERT INTO public.profiles (id, email, role, display_name, company_name, tenant_id)
VALUES (
  '<plak-uuid-hier>',
  '${keyuserEmail.trim().toLowerCase()}',
  'KEYUSER',
  '${keyuserNaam.trim()}',
  '${bedrijfsnaam.trim()}',
  '${effectiveSlug}'
);`;

      setResult({ slug: effectiveSlug, password: pw, sql });
    } catch (err) {
      Alert.alert('Aanmaken mislukt', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopySql = () => {
    if (!result) return;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        void navigator.clipboard.writeText(result.sql);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* ignore */ }
  };

  // ─── Render: succes-scherm ─────────────────────────────────────────────
  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successCard}>
          <CheckCircle2 size={48} color="#16A34A" />
          <Text style={styles.successTitle}>Klant aangemaakt</Text>
          <Text style={styles.successSub}>
            Tenant <Text style={styles.code}>{result.slug}</Text> staat in de DB
            met branding + default features. Eén stap te gaan: keyuser-account.
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Slug</Text>
            <Text style={styles.code}>{result.slug}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Keyuser email</Text>
            <Text style={styles.code}>{keyuserEmail}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tijdelijk wachtwoord</Text>
            <Text style={styles.code}>{result.password}</Text>
          </View>

          <Text style={styles.sectionTitle}>Activeer keyuser via Supabase SQL Editor</Text>
          <View style={styles.sqlBox}>
            <Text style={styles.sqlText}>{result.sql}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCopySql}
              style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
            >
              <Copy size={16} color="#FFFFFF" />
              <Text style={styles.copyBtnText}>{copied ? '✓ Gekopieerd' : 'Kopieer SQL'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open('https://supabase.com/dashboard/project/kgiuavfvhtdgwuygbyzo/sql/new', '_blank');
                }
              }}
              style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.7 }]}
            >
              <ExternalLink size={16} color={theme.colors.textPrimary} />
              <Text style={styles.openBtnText}>Open Supabase SQL</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.backBtnText}>← Terug naar Maker tools</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ─── Render: form ─────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Building2 size={22} color="#1B3A5C" />
        </View>
        <Text style={styles.eyebrow}>MAKER TOOLS</Text>
        <Text style={styles.title}>Nieuwe klant aanmaken</Text>
        <Text style={styles.subtitle}>
          Eén klik = nieuwe SpeeQ-tenant (heel bouwbedrijf) met branding,
          default features en uitnodiging voor de keyuser.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Bedrijfsnaam"
          placeholder="bv. Bouwbedrijf Jansen BV"
          value={bedrijfsnaam}
          onChangeText={setBedrijfsnaam}
          theme={theme}
        />
        <Field
          label="URL-slug (auto)"
          placeholder={slugify(bedrijfsnaam) || 'bv. bouwbedrijf-jansen'}
          value={slugInput}
          onChangeText={setSlugInput}
          hint={`Wordt: ${effectiveSlug || '(typ bedrijfsnaam)'}`}
          theme={theme}
        />
        <Field
          label="Keyuser email"
          placeholder="hoofd@bouwbedrijf-jansen.nl"
          value={keyuserEmail}
          onChangeText={setKeyuserEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          theme={theme}
        />
        <Field
          label="Keyuser naam"
          placeholder="Piet Jansen"
          value={keyuserNaam}
          onChangeText={setKeyuserNaam}
          theme={theme}
        />
        {/* Accent-kleur — paletje voor wie geen kleur-expert is, hex voor wie wel.
            Klik op een swatch → vult hex in. Selectie krijgt witte ring. */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 2 }}>
            Accent-kleur
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginBottom: 10 }}>
            Kies een kleur uit het palet, of plak je eigen hex hieronder.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {[
              { hex: '#1B3A5C', name: 'Navy (default)' },
              { hex: '#0EA5E9', name: 'Hemelsblauw' },
              { hex: '#15803D', name: 'Bos-groen' },
              { hex: '#16A34A', name: 'Stevig groen' },
              { hex: '#CA8A04', name: 'Mosterd-geel' },
              { hex: '#EA580C', name: 'Bouw-oranje' },
              { hex: '#DC2626', name: 'Klassiek rood' },
              { hex: '#9F1239', name: 'Bordeaux' },
              { hex: '#7C3AED', name: 'Paars' },
              { hex: '#A16207', name: 'Roest-bruin' },
              { hex: '#374151', name: 'Donker grijs' },
              { hex: '#1F2937', name: 'Antraciet' },
            ].map(({ hex, name }) => {
              const active = accentKleur.toLowerCase() === hex.toLowerCase();
              return (
                <Pressable
                  key={hex}
                  onPress={() => setAccentKleur(hex)}
                  accessibilityLabel={`Kies ${name}`}
                  {...(Platform.OS === 'web' ? ({ title: `${name} (${hex})` } as object) : {})}
                  style={({ pressed }) => [
                    {
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: hex,
                      borderWidth: active ? 3 : 1,
                      borderColor: active ? '#FFFFFF' : 'rgba(0,0,0,0.10)',
                    },
                    Platform.OS === 'web' && active
                      ? ({ boxShadow: `0 0 0 2px ${hex}` } as object)
                      : null,
                    pressed && { opacity: 0.7 },
                  ]}
                />
              );
            })}
          </View>

          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surface,
              fontFamily: 'Menlo, monospace',
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
            }}
            value={accentKleur}
            onChangeText={setAccentKleur}
            placeholder="#1B3A5C"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        {/* Klant-logo — upload van PC of plak URL (twee paden, kies wat handig is).
            Onderscheid t.o.v. Bedrijfsbranding-scherm: dáár wijzigt de klant zelf,
            hier geef jij als maker het startlogo mee. */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 2 }}>
            Klant-logo (optioneel)
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginBottom: 8 }}>
            Initial logo voor de nieuwe klant — ze kunnen 't zelf later wijzigen via Bedrijfsbranding.
          </Text>

          {/* Verborgen file input — opent native dialog op web */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: 'none' } as React.CSSProperties}
            onChange={handleLogoFile}
          />

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {/* Preview */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {logoUrl ? (
                // @ts-ignore web img is fine
                <img src={logoUrl} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <ImageIcon size={22} color={theme.colors.textMuted} />
              )}
            </View>

            {/* Upload-knop */}
            <Pressable
              onPress={handlePickLogo}
              disabled={logoUploading}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
                pressed && { opacity: 0.7 },
                logoUploading && { opacity: 0.5 },
              ]}
            >
              {logoUploading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Upload size={16} color={theme.colors.textPrimary} />
              )}
              <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                {logoUploading ? 'Uploaden…' : logoUrl ? 'Vervang logo' : 'Upload logo van PC'}
              </Text>
            </Pressable>
          </View>

          {logoError ? (
            <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 6 }}>{logoError}</Text>
          ) : null}

          {/* Fallback: plak URL */}
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 13,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surface,
              marginTop: 8,
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
            }}
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="Of plak hier een logo-URL: https://…/logo.png"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          !canSubmit && styles.submitBtnDisabled,
          pressed && canSubmit && { opacity: 0.85 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <KeyRound size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Klant aanmaken</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backBtnText}>← Terug</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Field component ─────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  theme: ReturnType<typeof useTheme>['theme'];
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
}
const Field: React.FC<FieldProps> = ({ label, placeholder, value, onChangeText, hint, theme, keyboardType, autoCapitalize }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 }}>
      {label}
    </Text>
    <TextInput
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.colors.textPrimary,
        backgroundColor: theme.colors.surface,
        ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
      }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
    />
    {hint ? (
      <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4, fontFamily: 'Menlo, monospace' }}>
        {hint}
      </Text>
    ) : null}
  </View>
);

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      padding: 32,
      maxWidth: 640,
      width: '100%',
      alignSelf: 'center',
      paddingBottom: 60,
    },
    header: {
      alignItems: 'flex-start',
      marginBottom: 28,
    },
    iconBadge: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(27,58,92,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    form: {
      marginBottom: 18,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#1B3A5C',
      paddingVertical: 14,
      borderRadius: 10,
      marginTop: 8,
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    backBtn: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    backBtnText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    successCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 32,
      alignItems: 'flex-start',
      gap: 8,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
      marginTop: 12,
    },
    successSub: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    code: {
      fontFamily: 'Menlo, monospace',
      fontSize: 13,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: 20,
      marginBottom: 8,
    },
    sqlBox: {
      width: '100%',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sqlText: {
      fontFamily: 'Menlo, monospace',
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.textPrimary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      width: '100%',
    },
    copyBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#1B3A5C',
      paddingVertical: 12,
      borderRadius: 10,
    },
    copyBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    openBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      borderRadius: 10,
    },
    openBtnText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
