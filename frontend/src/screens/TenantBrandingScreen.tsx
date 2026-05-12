/**
 * TenantBrandingScreen — admin/PL kunnen hier het klant-logo, de bedrijfsnaam
 * en de accentkleur instellen. Deze waarden vervangen het SpeeQ-logo in alle
 * in-app schermen en in geëxporteerde PDF's.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useTenantBranding } from '../hooks/useTenantBranding';
import {
  getBranding,
  uploadLogo,
  setCompanyName,
  setPrimaryColor,
  resetBranding,
} from '../services/TenantBrandingService';

interface Props {
  onBack?: () => void;
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export default function TenantBrandingScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const branding = useTenantBranding();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [busy, setBusy] = useState<'logo' | 'name' | 'color' | 'reset' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Sync velden zodra branding binnenkomt
  useEffect(() => {
    setName(branding.companyName ?? '');
    setColor(branding.primaryColor ?? '');
  }, [branding.companyName, branding.primaryColor]);

  useEffect(() => {
    void getBranding({ force: true });
  }, []);

  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setMessage({ tone, text });
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

  const handleLogoPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLogoFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('err', 'Kies een afbeelding (PNG, JPG of SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      flash('err', 'Logo te groot — maximaal 2 MB.');
      return;
    }
    setBusy('logo');
    try {
      await uploadLogo(file);
      flash('ok', 'Logo geüpload — verschijnt direct in de header.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Upload mislukt');
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [flash]);

  const handleSaveName = useCallback(async () => {
    setBusy('name');
    try {
      await setCompanyName(name);
      flash('ok', 'Bedrijfsnaam opgeslagen.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setBusy(null);
    }
  }, [name, flash]);

  const handleSaveColor = useCallback(async () => {
    const m = color.trim().match(HEX_RE);
    if (color.trim() && !m) {
      flash('err', 'Kleur moet een hex-code zijn (bv. #0ea5e9).');
      return;
    }
    setBusy('color');
    try {
      await setPrimaryColor(m ? `#${m[1]}` : null);
      flash('ok', 'Accentkleur opgeslagen.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Opslaan mislukt');
    } finally {
      setBusy(null);
    }
  }, [color, flash]);

  const handleReset = useCallback(async () => {
    if (!window.confirm('Weet je zeker dat je álle branding wilt resetten? Logo, naam en kleur verdwijnen.')) {
      return;
    }
    setBusy('reset');
    try {
      await resetBranding();
      flash('ok', 'Branding gereset.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Reset mislukt');
    } finally {
      setBusy(null);
    }
  }, [flash]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={s.content}
    >
      <View style={[s.header, { borderColor: theme.colors.border }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
            <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>← Terug</Text>
          </TouchableOpacity>
        )}
        <Text style={[s.title, { color: theme.colors.textPrimary }]}>🎨 Bedrijfsbranding</Text>
        <Text style={[s.subtitle, { color: theme.colors.textSecondary }]}>
          Pas het logo, de bedrijfsnaam en de accentkleur aan. Dit vervangt SpeeQ in de tool en in alle
          PDF-exports — zodat het er uitziet als jouw tool.
        </Text>
      </View>

      {message && (
        <View
          style={[
            s.toast,
            {
              backgroundColor: message.tone === 'ok' ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)',
              borderColor:     message.tone === 'ok' ? 'rgba(5,150,105,0.3)'  : 'rgba(239,68,68,0.3)',
            },
          ]}
        >
          <Text style={{ color: message.tone === 'ok' ? '#047857' : '#991b1b', fontWeight: '700' }}>
            {message.tone === 'ok' ? '✓ ' : '⚠ '}
            {message.text}
          </Text>
        </View>
      )}

      {/* ─── Logo ─────────────────────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[s.sectionTitle, { color: theme.colors.textPrimary }]}>Logo</Text>
        <Text style={[s.help, { color: theme.colors.textSecondary }]}>
          PNG, JPG of SVG. Vierkant werkt het beste. Max 2 MB.
        </Text>

        <View style={s.logoRow}>
          <View style={[s.logoPreview, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
            {branding.logoUrl ? (
              <Image source={{ uri: branding.logoUrl }} style={s.logoImg} resizeMode="contain" />
            ) : (
              <Text style={{ fontSize: 32 }}>🏗️</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: theme.colors.accent, opacity: busy === 'logo' ? 0.5 : 1 }]}
              disabled={busy === 'logo'}
              onPress={handleLogoPick}
              activeOpacity={0.85}
            >
              {busy === 'logo' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>{branding.logoUrl ? 'Vervang logo' : 'Upload logo'}</Text>
              )}
            </TouchableOpacity>
            {branding.logoUrl ? (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                {branding.logoUrl}
              </Text>
            ) : (
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                Nog geen logo geüpload.
              </Text>
            )}
          </View>
        </View>
        {/* @ts-ignore web file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          style={{ display: 'none' }}
          onChange={handleLogoFile}
        />
      </View>

      {/* ─── Bedrijfsnaam ─────────────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[s.sectionTitle, { color: theme.colors.textPrimary }]}>Bedrijfsnaam</Text>
        <Text style={[s.help, { color: theme.colors.textSecondary }]}>
          Verschijnt naast het logo en in de PDF-cover en -footer.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bijv. Bouwbedrijf Jansen BV"
          placeholderTextColor={theme.colors.textSecondary + '99'}
          style={[
            s.input,
            { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
          ]}
        />
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: theme.colors.accent, opacity: busy === 'name' ? 0.5 : 1 }]}
          disabled={busy === 'name'}
          onPress={handleSaveName}
          activeOpacity={0.85}
        >
          {busy === 'name' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Naam opslaan</Text>}
        </TouchableOpacity>
      </View>

      {/* ─── Accentkleur ─────────────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[s.sectionTitle, { color: theme.colors.textPrimary }]}>Accentkleur (optioneel)</Text>
        <Text style={[s.help, { color: theme.colors.textSecondary }]}>
          Hex-code, bv. <Text style={{ fontFamily: 'Menlo' }}>#0ea5e9</Text>. Wordt gebruikt voor CTA's en PDF-titels.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View
            style={[
              s.colorSwatch,
              {
                backgroundColor: HEX_RE.test(color.trim()) ? (color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`) : theme.colors.border,
                borderColor: theme.colors.border,
              },
            ]}
          />
          <TextInput
            value={color}
            onChangeText={setColor}
            placeholder="#0ea5e9"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholderTextColor={theme.colors.textSecondary + '99'}
            style={[
              s.input,
              { flex: 1, marginBottom: 0, color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
            ]}
          />
        </View>
        <TouchableOpacity
          style={[s.primaryBtn, { marginTop: 10, backgroundColor: theme.colors.accent, opacity: busy === 'color' ? 0.5 : 1 }]}
          disabled={busy === 'color'}
          onPress={handleSaveColor}
          activeOpacity={0.85}
        >
          {busy === 'color' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Kleur opslaan</Text>}
        </TouchableOpacity>
      </View>

      {/* ─── Reset ───────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.dangerBtn, { borderColor: '#ef4444', opacity: busy === 'reset' ? 0.5 : 1 }]}
        disabled={busy === 'reset'}
        onPress={handleReset}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#ef4444', fontWeight: '800' }}>Reset alle branding</Text>
      </TouchableOpacity>

      <Text style={[s.footnote, { color: theme.colors.textSecondary }]}>
        Tip: Hou het logo eenvoudig — een vierkante PNG met transparante achtergrond werkt het beste op zowel licht
        als donker thema.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, maxWidth: 720, alignSelf: 'center', width: '100%', gap: 14, paddingBottom: 60 },
  header: { paddingBottom: 16, borderBottomWidth: 1, marginBottom: 6 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  help: { fontSize: 12, lineHeight: 18 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10,
  },
  primaryBtn: {
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dangerBtn: {
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6,
  },
  logoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  logoPreview: {
    width: 84, height: 84, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 80, height: 80 },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1 },
  toast: { borderWidth: 1, borderRadius: 10, padding: 12 },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 14, lineHeight: 16 },
});
