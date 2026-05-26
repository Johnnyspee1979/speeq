/**
 * MakerDashboardScreen — Maker-only klanten-poort (gatekeeper view).
 *
 * Per Johnny 25 mei: "hoe beheer ik mijn klanten overzichtelijk?"
 *
 * Toont alle SpeeQ-tenants in een tabel:
 *   • bedrijfsnaam + slug + admin-email
 *   • #users · #projecten · #foto's per klant
 *   • status (active / paused / inactive)
 *   • acties: ✏️ Bewerken · ⏸ Pauzeren · 👁 Bekijk als deze klant
 *
 * Plus knop "+ Nieuwe klant" → opent MakerNewTenantScreen.
 *
 * "Bekijk als" zet een localStorage-override zodat Johnny door
 * de ogen van die klant ziet (data-isolatie via RLS blijft staan
 * — admin role mag alle tenants zien, anderen niet).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import {
  Building2,
  Plus,
  Users,
  FolderOpen,
  Camera,
  Eye,
  Edit2,
  Pause,
  Play,
  Search,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';

interface TenantOverview {
  slug: string;
  company_name: string;
  admin_email: string | null;
  provisioning_status: string | null;
  created_at: string | null;
  projecten: number;
  users: number;
  fotos: number;
  primary_color: string | null;
  logo_url: string | null;
}

interface Props {
  onNewTenant: () => void;
  onViewAs: (slug: string) => void;
}

export default function MakerDashboardScreen({ onNewTenant, onViewAs }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyTenant, setBusyTenant] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Haal tenants op + counts in 1 keer via aparte queries (Postgres view zou
      // beter zijn, voor nu pragmatisch met paralle fetches).
      const [tRes, pRes, uRes, eRes, bRes] = await Promise.all([
        supabase.from('tenants').select('slug, company_name, admin_email, provisioning_status, created_at').order('created_at', { ascending: false }),
        supabase.from('projects').select('tenant_id'),
        supabase.from('profiles').select('tenant_id'),
        supabase.from('evidence').select('tenant_id'),
        supabase.from('tenant_branding').select('company_name, primary_color, logo_url'),
      ]);
      if (tRes.error) throw tRes.error;

      // Tel projecten/users/foto's per tenant_id
      const projectCount = new Map<string, number>();
      (pRes.data ?? []).forEach((r: { tenant_id: string | null }) => {
        if (!r.tenant_id) return;
        projectCount.set(r.tenant_id, (projectCount.get(r.tenant_id) ?? 0) + 1);
      });
      const userCount = new Map<string, number>();
      (uRes.data ?? []).forEach((r: { tenant_id: string | null }) => {
        if (!r.tenant_id) return;
        userCount.set(r.tenant_id, (userCount.get(r.tenant_id) ?? 0) + 1);
      });
      const photoCount = new Map<string, number>();
      (eRes.data ?? []).forEach((r: { tenant_id: string | null }) => {
        if (!r.tenant_id) return;
        photoCount.set(r.tenant_id, (photoCount.get(r.tenant_id) ?? 0) + 1);
      });

      // Branding via company_name match (tenant_branding heeft geen slug-kolom)
      const brandingMap = new Map<string, { color: string | null; logo: string | null }>();
      (bRes.data ?? []).forEach((b: { company_name: string | null; primary_color: string | null; logo_url: string | null }) => {
        if (!b.company_name) return;
        brandingMap.set(b.company_name.toLowerCase(), {
          color: b.primary_color,
          logo: b.logo_url,
        });
      });

      const enriched: TenantOverview[] = (tRes.data ?? []).map((t: {
        slug: string; company_name: string | null; admin_email: string | null;
        provisioning_status: string | null; created_at: string | null;
      }) => {
        const brand = brandingMap.get((t.company_name ?? '').toLowerCase());
        return {
          slug: t.slug,
          company_name: t.company_name ?? '(naamloos)',
          admin_email: t.admin_email,
          provisioning_status: t.provisioning_status,
          created_at: t.created_at,
          projecten: projectCount.get(t.slug) ?? 0,
          users: userCount.get(t.slug) ?? 0,
          fotos: photoCount.get(t.slug) ?? 0,
          primary_color: brand?.color ?? null,
          logo_url: brand?.logo ?? null,
        };
      });
      setTenants(enriched);
    } catch (err) {
      console.warn('[MakerDashboard] load mislukt:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter((t) =>
      t.slug.toLowerCase().includes(q) ||
      t.company_name.toLowerCase().includes(q) ||
      (t.admin_email ?? '').toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const totals = useMemo(() => ({
    klanten: tenants.length,
    users: tenants.reduce((s, t) => s + t.users, 0),
    projecten: tenants.reduce((s, t) => s + t.projecten, 0),
    fotos: tenants.reduce((s, t) => s + t.fotos, 0),
  }), [tenants]);

  const handleTogglePause = async (t: TenantOverview) => {
    const next = t.provisioning_status === 'paused' ? 'active' : 'paused';
    setBusyTenant(t.slug);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ provisioning_status: next })
        .eq('slug', t.slug);
      if (error) throw error;
      await load();
    } catch (err) {
      Alert.alert('Status wijzigen mislukt', err instanceof Error ? err.message : String(err));
    } finally {
      setBusyTenant(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero — totals */}
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Building2 size={22} color="#1B3A5C" />
        </View>
        <Text style={styles.eyebrow}>MAKER POORT</Text>
        <Text style={styles.title}>Klanten-overzicht</Text>
        <Text style={styles.subtitle}>
          Alle SpeeQ-tenants. Klik door om door hun ogen mee te kijken.
        </Text>
      </View>

      {/* KPI strip */}
      <View style={styles.kpiRow}>
        <KpiBox label="Klanten"   value={totals.klanten}   icon={<Building2 size={16} color="#1B3A5C" />} theme={theme} />
        <KpiBox label="Users"     value={totals.users}     icon={<Users size={16} color="#1B3A5C" />}     theme={theme} />
        <KpiBox label="Projecten" value={totals.projecten} icon={<FolderOpen size={16} color="#1B3A5C" />} theme={theme} />
        <KpiBox label="Foto's"    value={totals.fotos}     icon={<Camera size={16} color="#1B3A5C" />}    theme={theme} />
      </View>

      {/* Zoek + nieuwe klant knop */}
      <View style={styles.actionsRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Zoek op naam, slug of email…"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
        <Pressable
          onPress={onNewTenant}
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Nieuwe klant aanmaken"
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.newBtnText}>Nieuwe klant</Text>
        </Pressable>
      </View>

      {/* Lijst */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.loadingText}>Klanten laden…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {search ? `Geen klant gevonden voor "${search}"` : 'Nog geen klanten — maak de eerste aan.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((t) => (
            <TenantRow
              key={t.slug}
              t={t}
              busy={busyTenant === t.slug}
              onViewAs={() => onViewAs(t.slug)}
              onTogglePause={() => handleTogglePause(t)}
              theme={theme}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Sub: KpiBox ───────────────────────────────────────────────────────
const KpiBox: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  theme: ReturnType<typeof useTheme>['theme'];
}> = ({ label, value, icon, theme }) => (
  <View style={{
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    minWidth: 120,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.textMuted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}>{label}</Text>
    </View>
    <Text style={{
      fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -1,
    }}>{value}</Text>
  </View>
);

// ─── Sub: TenantRow ────────────────────────────────────────────────────
const TenantRow: React.FC<{
  t: TenantOverview;
  busy: boolean;
  onViewAs: () => void;
  onTogglePause: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}> = ({ t, busy, onViewAs, onTogglePause, theme }) => {
  const paused = t.provisioning_status === 'paused';
  const statusColor = paused ? '#D97706' : '#16A34A';
  const statusLabel = paused ? 'Gepauzeerd' : 'Actief';

  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 18,
      marginBottom: 10,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 1px 2px rgba(15,36,54,0.04)' } as object)
        : {}),
    }}>
      {/* Top row: brand + naam + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: t.primary_color ?? '#1B3A5C',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
            {t.company_name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.textPrimary,
            marginBottom: 2,
          }} numberOfLines={1}>
            {t.company_name}
          </Text>
          <Text style={{
            fontSize: 12,
            color: theme.colors.textMuted,
            fontFamily: 'Menlo, monospace',
          }} numberOfLines={1}>
            /{t.slug} · {t.admin_email ?? 'geen admin-mail'}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: statusColor + '15',
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Stats inline */}
      <View style={{ flexDirection: 'row', gap: 18, marginBottom: 14, paddingLeft: 58 }}>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
          <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{t.users}</Text> users
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
          <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{t.projecten}</Text> projecten
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
          <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{t.fotos}</Text> foto's
        </Text>
      </View>

      {/* Acties */}
      <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 58 }}>
        <Pressable
          onPress={onViewAs}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#1B3A5C' }, pressed && { opacity: 0.85 }]}
          accessibilityLabel={`Bekijk als ${t.company_name}`}
        >
          <Eye size={14} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Bekijk als</Text>
        </Pressable>
        <Pressable
          onPress={onTogglePause}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
            pressed && { opacity: 0.7 },
            busy && { opacity: 0.4 },
          ]}
        >
          {paused ? <Play size={14} color={theme.colors.textPrimary} /> : <Pause size={14} color={theme.colors.textPrimary} />}
          <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>
            {paused ? 'Activeer' : 'Pauze'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      padding: 32,
      maxWidth: 1080,
      width: '100%',
      alignSelf: 'center',
      paddingBottom: 60,
    },
    header: {
      marginBottom: 24,
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
      fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif',
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -1,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 24,
      flexWrap: 'wrap',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 18,
      alignItems: 'center',
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textPrimary,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#1B3A5C',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
    },
    newBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    loadingBox: {
      padding: 40,
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    emptyBox: {
      padding: 40,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      borderStyle: 'dashed',
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    list: {
      gap: 0,
    },
  });
}
