/**
 * MakerDashboard — Johnny's persoonlijke maker-paneel.
 *
 * Wat kan ik hier:
 *   - Inloggen met mijn maker-account (johnny@speesolutions.nl)
 *   - Mijn 40 klanten zien als kaarten (logo + naam + status)
 *   - ➕ Klant toevoegen → modaal met Supabase-credentials
 *   - 🔧 Tool openen ALS deze klant → setTenantConfig + reload
 *   - ✏️ Klant bewerken
 *   - 🗑️ Klant verwijderen (alleen registry, NIET hun Supabase-data)
 *
 * Toegang: alleen `johnny@speesolutions.nl` (RLS in master DB).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// SpeeQ Q-logo asset — gebruikt in de header van het maker-paneel.
// require() is bewust gekozen: werkt op zowel web als native zonder URL-gepriegel.
const SPEEQ_Q_LOGO = require('../assets/speeq-q-logo.png');

// Hulp: bouw de deel-link voor een klant.
// Resultaat: https://speeq-wkb.vercel.app/?t=bouwbedrijf-janssen
function buildTenantLink(slugOrId: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return `/?t=${encodeURIComponent(slugOrId)}`;
  }
  const origin = window.location.origin;
  return `${origin}/?t=${encodeURIComponent(slugOrId)}`;
}
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SecondaryButton } from '../components/ui/SecondaryButton';
import {
  signInMaker,
  signOutMaker,
  getMakerSessionEmail,
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  type Tenant,
  type NewTenantInput,
} from '../services/MakerService';
import { setTenantConfig } from '../config/tenant';
import { setBrandingFromMaster } from '../services/TenantBrandingService';

type ViewState = 'loading' | 'login' | 'list' | 'add' | 'edit';

const TENANT_LIMIT = 40;

export default function MakerDashboard() {
  const { theme } = useTheme();
  const [view, setView] = useState<ViewState>('loading');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setMsg({ tone, text });
    setTimeout(() => setMsg(null), 4500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await listTenants();
      setTenants(list);
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Laden mislukt');
    }
  }, [flash]);

  // ── Mount: check sessie ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const email = await getMakerSessionEmail();
      if (email) {
        await reload();
        setView('list');
      } else {
        setView('login');
      }
    })();
  }, [reload]);

  // ── Sub-views ───────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <View style={[s.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (view === 'login') {
    return (
      <LoginView
        theme={theme}
        busy={busy}
        msg={msg}
        onLogin={async (email, password) => {
          setBusy(true);
          try {
            await signInMaker(email, password);
            await reload();
            setView('list');
          } catch (err) {
            flash('err', err instanceof Error ? err.message : 'Login mislukt');
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  if (view === 'add' || (view === 'edit' && editing)) {
    return (
      <TenantForm
        theme={theme}
        existing={view === 'edit' ? editing : null}
        busy={busy}
        msg={msg}
        onCancel={() => { setEditing(null); setView('list'); }}
        onSave={async (input) => {
          setBusy(true);
          try {
            if (view === 'edit' && editing) {
              await updateTenant(editing.companyId, input);
              flash('ok', 'Klant bijgewerkt.');
            } else {
              await createTenant(input);
              flash('ok', 'Klant toegevoegd.');
            }
            await reload();
            setEditing(null);
            setView('list');
          } catch (err) {
            flash('err', err instanceof Error ? err.message : 'Opslaan mislukt');
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  // ── Hoofdlijst ──────────────────────────────────────────────────────────
  const slotsLeft = Math.max(0, TENANT_LIMIT - tenants.length);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={s.listContent}
    >
      <View style={s.headerTopRow}>
        <Image
          source={SPEEQ_Q_LOGO}
          style={{ width: 40, height: 40, marginRight: 12 }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }} />
        <SecondaryButton
          title="Uitloggen"
          onPress={async () => { await signOutMaker(); setView('login'); }}
        />
      </View>

      <PageHeader
        title="Maker-paneel"
        rightAction={
          <PrimaryButton
            label="➕ Klant toevoegen"
            onPress={() => slotsLeft > 0 && setView('add')}
            disabled={slotsLeft === 0}
          />
        }
      />

      <View style={[s.headerMeta, { borderBottomColor: theme.colors.borderWarm }]}>
        <Text style={[s.eyebrow, { color: theme.colors.textMuted }]}>MULTI-TENANT BEHEER</Text>
        <Text style={[s.subtitle, { color: theme.colors.textSecondary }]}>
          {tenants.length} van {TENANT_LIMIT} klanten · nog {slotsLeft} plek{slotsLeft !== 1 ? 'ken' : ''} vrij
        </Text>
      </View>

      {msg && (
        <View
          style={[s.toast, {
            backgroundColor: msg.tone === 'ok' ? theme.colors.statusSuccess : theme.colors.statusWarning,
            borderColor:     theme.colors.borderWarm,
          }]}
        >
          <Text style={{
            color: msg.tone === 'ok' ? theme.colors.background : theme.colors.textPrimary,
            fontWeight: '700',
          }}>
            {msg.tone === 'ok' ? '✓ ' : '⚠ '}{msg.text}
          </Text>
        </View>
      )}

      {tenants.length === 0 ? (
        <View style={[s.empty, { borderColor: theme.colors.borderWarm }]}>
          <Text style={{ fontSize: 32 }}>🏗️</Text>
          <Text style={[s.emptyTitle, { color: theme.colors.textPrimary }]}>Nog geen klanten</Text>
          <Text style={[s.emptyText, { color: theme.colors.textSecondary }]}>
            Voeg je eerste klant toe. Je hebt hun Supabase URL + anon key nodig.
          </Text>
        </View>
      ) : (
        <View style={s.grid}>
          {tenants.map(t => (
            <TenantCard
              key={t.companyId}
              tenant={t}
              theme={theme}
              onOpen={async () => {
                await setTenantConfig({
                  companyId:        t.companyId,
                  supabaseUrl:      t.supabaseUrl,
                  supabaseAnonKey:  t.supabaseAnonKey,
                });
                // Push branding uit master-tenants direct in de cache → header
                // toont meteen de juiste naam/kleur/logo na reload (geen flash).
                setBrandingFromMaster({
                  companyName:  t.displayName ?? t.name ?? null,
                  logoUrl:      t.logoUrl ?? null,
                  primaryColor: t.primaryColor ?? null,
                });
                // Sla ook tenant_id op voor data-isolatie (ProjectService leest dit)
                if (typeof window !== 'undefined') {
                  try {
                    window.localStorage.setItem('wkb_active_tenant_id', t.companyId);
                  } catch { /* ignore */ }
                  window.location.href = '/';
                }
              }}
              onEdit={() => { setEditing(t); setView('edit'); }}
              onCopyLink={async () => {
                const link = buildTenantLink(t.slug ?? t.companyId);
                try {
                  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(link);
                    flash('ok', `Link gekopieerd: ${link}`);
                  } else {
                    flash('ok', link);
                  }
                } catch {
                  flash('err', 'Kopiëren mislukt — link: ' + link);
                }
              }}
              onDelete={async () => {
                if (typeof window !== 'undefined' &&
                    !window.confirm(`Klant "${t.name}" uit het maker-overzicht verwijderen?\n\nLet op: dit verwijdert alleen de registry-entry — hun eigen Supabase-data blijft bestaan.`)) {
                  return;
                }
                try {
                  await deleteTenant(t.companyId);
                  flash('ok', `${t.name} verwijderd.`);
                  await reload();
                } catch (err) {
                  flash('err', err instanceof Error ? err.message : 'Verwijderen mislukt');
                }
              }}
            />
          ))}
        </View>
      )}

      <Text style={[s.footnote, { color: theme.colors.textSecondary }]}>
        Tip: zet de eerste klant op met een test-Supabase project. Zodra dat goed werkt,
        is het verschil tussen 1 en 40 klanten alleen nog data — geen code.
      </Text>
    </ScrollView>
  );
}

// ───────────────────────── Login ──────────────────────────────────────────

function LoginView({
  theme, busy, msg, onLogin,
}: {
  theme: any;
  busy: boolean;
  msg: { tone: 'ok' | 'err'; text: string } | null;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('johnny@speesolutions.com');
  const [password, setPassword] = useState('');

  return (
    <View style={[s.center, { backgroundColor: theme.colors.background }]}>
      <View style={[s.loginCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Image
          source={SPEEQ_Q_LOGO}
          style={{ width: 72, height: 72, alignSelf: 'center', marginBottom: 12 }}
          resizeMode="contain"
        />
        <Text style={[s.title, { color: theme.colors.textPrimary, marginBottom: 4, textAlign: 'center' }]}>Maker-paneel</Text>
        <Text style={[s.subtitle, { color: theme.colors.textSecondary, marginBottom: 18, textAlign: 'center' }]}>
          Toegang alleen voor Johnny (eigenaar).
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholderTextColor={theme.colors.textSecondary + '99'}
          style={[s.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Wachtwoord"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.colors.textSecondary + '99'}
          style={[s.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
        />
        {msg && (
          <Text style={{ color: msg.tone === 'ok' ? '#047857' : '#991b1b', marginBottom: 10, fontWeight: '700' }}>
            {msg.tone === 'ok' ? '✓ ' : '⚠ '}{msg.text}
          </Text>
        )}
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: theme.colors.accent, opacity: busy ? 0.6 : 1 }]}
          onPress={() => onLogin(email, password)}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Inloggen</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ───────────────────────── Tenant Card ────────────────────────────────────

function TenantCard({ tenant, theme, onOpen, onEdit, onCopyLink, onDelete }: {
  tenant: Tenant;
  theme: any;
  onOpen: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const initials = (tenant.displayName ?? tenant.name)
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={s.cardHead}>
        <View
          style={[s.avatar, {
            backgroundColor: tenant.primaryColor ?? theme.colors.accent + '22',
            borderColor: theme.colors.border,
          }]}
        >
          <Text style={[s.avatarText, { color: tenant.primaryColor ? '#fff' : theme.colors.accent }]}>
            {initials || '🏢'}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.cardName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {tenant.displayName ?? tenant.name}
          </Text>
          <Text style={[s.cardSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {tenant.slug ?? tenant.companyId}
          </Text>
        </View>
        <View
          style={[s.statusPill, {
            backgroundColor: tenant.status === 'active' ? 'rgba(5,150,105,0.15)' : 'rgba(245,158,11,0.15)',
          }]}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: tenant.status === 'active' ? '#047857' : '#b45309',
              letterSpacing: 0.3,
            }}
          >
            {(tenant.status ?? 'onbekend').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[s.cardMeta, { borderColor: theme.colors.border }]}>
        <MetaRow label="Supabase" value={shortUrl(tenant.supabaseUrl)} theme={theme} />
        {tenant.adminEmail && <MetaRow label="Admin" value={tenant.adminEmail} theme={theme} />}
        {tenant.users != null && <MetaRow label="Gebruikers" value={String(tenant.users)} theme={theme} />}
        <MetaRow
          label="Klant-link"
          value={`/?t=${tenant.slug ?? tenant.companyId}`}
          theme={theme}
        />
      </View>

      <View style={s.cardActions}>
        <TouchableOpacity
          style={[s.smallBtn, { backgroundColor: theme.colors.accent }]}
          onPress={onOpen}
          activeOpacity={0.85}
        >
          <Text style={s.smallBtnText}>🔧 Open als klant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.smallBtnGhost, { borderColor: theme.colors.border }]}
          onPress={onCopyLink}
          activeOpacity={0.7}
        >
          <Text style={[s.smallBtnGhostText, { color: theme.colors.textSecondary }]}>🔗 Kopieer link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.smallBtnGhost, { borderColor: theme.colors.border }]}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <Text style={[s.smallBtnGhostText, { color: theme.colors.textSecondary }]}>✏️ Bewerk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.smallBtnGhost, { borderColor: '#fecaca' }]}
          onPress={onDelete}
          activeOpacity={0.7}
        >
          <Text style={[s.smallBtnGhostText, { color: '#dc2626' }]}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetaRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={s.metaRow}>
      <Text style={[s.metaLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[s.metaValue, { color: theme.colors.textPrimary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function shortUrl(u: string): string {
  try {
    return new URL(u).host.split('.')[0];
  } catch {
    return u.slice(0, 24);
  }
}

// ───────────────────────── Tenant Form ────────────────────────────────────

function TenantForm({
  theme, existing, busy, msg, onCancel, onSave,
}: {
  theme: any;
  existing: Tenant | null;
  busy: boolean;
  msg: { tone: 'ok' | 'err'; text: string } | null;
  onCancel: () => void;
  onSave: (input: NewTenantInput) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.displayName ?? existing?.name ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [supabaseUrl, setSupabaseUrl] = useState(existing?.supabaseUrl ?? '');
  const [anonKey, setAnonKey] = useState(existing?.supabaseAnonKey ?? '');
  const [customDomain, setCustomDomain] = useState(existing?.customDomain ?? '');
  const [adminEmail, setAdminEmail] = useState(existing?.adminEmail ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const canSave = useMemo(
    () => name.trim().length >= 2 && supabaseUrl.trim().length > 0 && anonKey.trim().length > 0,
    [name, supabaseUrl, anonKey],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%', gap: 14 }}
    >
      <TouchableOpacity onPress={onCancel} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
        <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>← Terug</Text>
      </TouchableOpacity>

      <Text style={[s.title, { color: theme.colors.textPrimary }]}>
        {existing ? '✏️ Klant bewerken' : '➕ Nieuwe klant'}
      </Text>
      <Text style={[s.subtitle, { color: theme.colors.textSecondary, marginBottom: 14 }]}>
        Vul de Supabase-credentials in van het project dat voor déze klant draait.
        Vraag je technische contactpersoon om de URL + anon-key uit Supabase &gt; Project Settings &gt; API.
      </Text>

      <Field label="Bedrijfsnaam *" value={name} onChange={setName} theme={theme} placeholder="Bouwbedrijf Jansen BV" />
      <Field label="Slug (optioneel)" value={slug} onChange={setSlug} theme={theme} placeholder="jansen — gebruikt voor URL: jansen.speeq-wkb.vercel.app" />
      <Field label="Supabase URL *" value={supabaseUrl} onChange={setSupabaseUrl} theme={theme} placeholder="https://xxx.supabase.co" />
      <Field label="Supabase anon key *" value={anonKey} onChange={setAnonKey} theme={theme} placeholder="eyJ..." multiline />
      <Field label="Custom domain" value={customDomain} onChange={setCustomDomain} theme={theme} placeholder="wkb.jansen.nl (later via Vercel koppelen)" />
      <Field label="Admin-e-mail" value={adminEmail} onChange={setAdminEmail} theme={theme} placeholder="admin@jansen.nl" />
      <Field label="Telefoon" value={contactPhone} onChange={setContactPhone} theme={theme} placeholder="06-..." />
      <Field label="Notities" value={notes} onChange={setNotes} theme={theme} placeholder="Eigen aantekeningen" multiline />

      {msg && (
        <Text style={{ color: msg.tone === 'ok' ? '#047857' : '#991b1b', marginTop: 6, fontWeight: '700' }}>
          {msg.tone === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          style={[s.primaryBtn, { flex: 1, backgroundColor: theme.colors.accent, opacity: !canSave || busy ? 0.5 : 1 }]}
          onPress={() => canSave && onSave({
            name, slug: slug || undefined, supabaseUrl, supabaseAnonKey: anonKey,
            customDomain: customDomain || null, adminEmail: adminEmail || null,
            contactPhone: contactPhone || null, notes: notes || null,
          })}
          disabled={!canSave || busy}
          activeOpacity={0.85}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{existing ? 'Wijzigingen opslaan' : 'Klant toevoegen'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.ghostBtn, { borderColor: theme.colors.border }]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={[s.ghostBtnText, { color: theme.colors.textSecondary }]}>Annuleren</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChange, theme, placeholder, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: any;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4, letterSpacing: 0.3 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={theme.colors.textSecondary + '99'}
        style={[
          s.input,
          multiline && { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 },
          { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginBottom: 0 },
        ]}
      />
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────────────────────

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { padding: 24, maxWidth: 1180, alignSelf: 'center', width: '100%', gap: 16, paddingBottom: 60 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  headerMeta: { paddingBottom: 16, borderBottomWidth: 1, marginBottom: 4 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  primaryBtn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ghostBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  ghostBtnText: { fontWeight: '700', fontSize: 13 },
  toast: { borderWidth: 1, borderRadius: 10, padding: 12 },
  empty: {
    alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 40, paddingHorizontal: 28, gap: 8, marginTop: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    width: 340, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '900', fontSize: 16 },
  cardName: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 11, fontFamily: 'Menlo' as any },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  cardMeta: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  metaValue: { fontSize: 11, flex: 1, textAlign: 'right' },
  cardActions: { flexDirection: 'row', gap: 8 },
  smallBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  smallBtnGhost: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  smallBtnGhostText: { fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10,
  },
  loginCard: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: 14, padding: 24 },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
