/**
 * TeamBeheerScreen — PC-only scherm voor het beheren van vakmensen.
 *
 * Admin kan hier:
 *  - Vakmensen aanmelden (naam + profiel + disciplines)
 *  - Disciplines per vakman instellen & opslaan in Supabase
 *  - Extra taken toewijzen (bijv. betonherstel aan een kitter)
 *  - Uitnodigingslink kopiëren/sturen via WhatsApp
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { wkbTaskTemplates } from '../data/WkbTemplates';
import { useTheme } from '../theme/ThemeProvider';
import { useWkbAuth } from '../hooks/useWkbAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

type Discipline =
  | 'BOUW'
  | 'BOUWFYSICA'
  | 'BRANDVEILIGHEID'
  | 'INSTALLATIE'
  | 'ELEKTRA'
  | 'AFBOUW_SCHILDER';

type JobType =
  | 'WERKVOORBEREIDER'
  | 'PROJECTLEIDER'
  | 'VOORMAN'
  | 'UITVOERDER'
  | 'TIMMERMAN'
  | 'METSELAAR'
  | 'LOODGIETER'
  | 'ELECTRICIEN'
  | 'KITTER'
  | 'SCHILDER'
  | 'DAKDEKKER'
  | 'ISOLATIESPECIALIST'
  | 'BRANDVEILIGHEID'
  | 'KEUKENBOUWER'
  | 'VAKMAN';

interface TeamMember {
  id: string;
  inviteToken: string | null;
  inviteAcceptedAt: string | null;
  displayName: string;
  email: string;
  phone?: string;
  jobType: JobType;
  disciplines: Discipline[];
  extraTaskIds: string[];
  projectIds: string[];
  role: string;
  isOnline: boolean;
}

// ─── Job type → automatische disciplines ─────────────────────────────────────

const JOB_DISCIPLINES: Record<JobType, Discipline[]> = {
  WERKVOORBEREIDER:   ['BOUW', 'BOUWFYSICA', 'BRANDVEILIGHEID', 'INSTALLATIE', 'ELEKTRA', 'AFBOUW_SCHILDER'],
  PROJECTLEIDER:      ['BOUW', 'BOUWFYSICA', 'BRANDVEILIGHEID', 'INSTALLATIE', 'ELEKTRA', 'AFBOUW_SCHILDER'],
  VOORMAN:            ['BOUW', 'BOUWFYSICA', 'BRANDVEILIGHEID', 'INSTALLATIE', 'ELEKTRA', 'AFBOUW_SCHILDER'],
  UITVOERDER:         ['BOUW', 'BOUWFYSICA', 'BRANDVEILIGHEID', 'INSTALLATIE', 'ELEKTRA', 'AFBOUW_SCHILDER'],
  TIMMERMAN:          ['BOUW'],
  METSELAAR:          ['BOUW'],
  LOODGIETER:         ['INSTALLATIE'],
  ELECTRICIEN:        ['ELEKTRA'],
  KITTER:             ['AFBOUW_SCHILDER'],
  SCHILDER:           ['AFBOUW_SCHILDER'],
  DAKDEKKER:          ['BOUW', 'BOUWFYSICA'],
  ISOLATIESPECIALIST: ['BOUWFYSICA'],
  BRANDVEILIGHEID:    ['BRANDVEILIGHEID'],
  KEUKENBOUWER:       ['AFBOUW_SCHILDER'],
  VAKMAN:             [],
};

const JOB_LABELS: Record<JobType, string> = {
  WERKVOORBEREIDER:   '🏗️ Werkvoorbereider',
  PROJECTLEIDER:      '📋 Projectleider',
  VOORMAN:            '👷 Voorman',
  UITVOERDER:         '👷 Uitvoerder',
  TIMMERMAN:          '🪵 Timmerman',
  METSELAAR:          '🧱 Metselaar',
  LOODGIETER:         '🔧 Loodgieter',
  ELECTRICIEN:        '⚡ Elektriciën',
  KITTER:             '🔩 Kitter / Afbouwer',
  SCHILDER:           '🎨 Schilder',
  DAKDEKKER:          '🏠 Dakdekker',
  ISOLATIESPECIALIST: '🧊 Isolatiespecialist',
  BRANDVEILIGHEID:    '🔥 Brandveiligheid',
  KEUKENBOUWER:       '🍳 Keukenbouwer',
  VAKMAN:             '🔨 Vakman (overig)',
};

const DISCIPLINE_LABELS: Record<Discipline, string> = {
  BOUW:            'Bouw / Ruwbouw',
  BOUWFYSICA:      'Bouwfysica',
  BRANDVEILIGHEID: 'Brandveiligheid',
  INSTALLATIE:     'Installatie / Sanitair',
  ELEKTRA:         'Elektra',
  AFBOUW_SCHILDER: 'Schilder / Afbouw',
};

const ALL_JOB_TYPES = Object.keys(JOB_LABELS) as JobType[];
const ALL_DISCIPLINES = Object.keys(DISCIPLINE_LABELS) as Discipline[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): TeamMember {
  const lastSeen = row.last_seen_at as string | null;
  const isOnline = lastSeen
    ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
    : false;

  return {
    id: row.id as string,
    inviteToken: (row.invite_token as string | null) ?? null,
    inviteAcceptedAt: (row.invite_accepted_at as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? (row.email as string | null) ?? 'Onbekend',
    email: (row.email as string | null) ?? '',
    phone: (row.phone as string | null) ?? undefined,
    jobType: ((row.job_type as string | null) as JobType) ?? 'VAKMAN',
    disciplines: ((row.disciplines as string[] | null) as Discipline[]) ?? [],
    extraTaskIds: (row.extra_task_ids as string[] | null) ?? [],
    projectIds: (row.project_ids as string[] | null) ?? [],
    role: (row.role as string | null) ?? 'ONDERAANNEMER',
    isOnline,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

type TeamTab = 'team' | 'bevoegdheden';

export default function TeamBeheerScreen() {
  const { theme } = useTheme();
  const { user } = useWkbAuth();
  const isDark = theme.name === 'dark';
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const [activeTab, setActiveTab] = useState<TeamTab>('team');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [qrMemberId, setQrMemberId] = useState<string | null>(null);

  // Nieuw lid form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobType, setNewJobType] = useState<JobType>('VAKMAN');
  const [newProjectIds, setNewProjectIds] = useState<string[]>([]);

  // Beschikbare projecten voor project-toewijzing
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string; name: string}>>([]);

  // Edit panel project-ids (per member id)
  const [editProjectIds, setEditProjectIds] = useState<Record<string, string[]>>({});

  // ── Load from Supabase ──────────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, phone, job_type, disciplines, extra_task_ids, project_ids, invite_token, invite_accepted_at, last_seen_at, role')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers((data ?? []).map(mapRow));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kon teamleden niet laden';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Laad beschikbare projecten voor project-toewijzing
  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => {
      if (data) {
        setAvailableProjects(data.map((p) => ({ id: p.id as string, name: (p.name as string) ?? (p.id as string) })));
      }
    });
  }, []);

  // Sync editProjectIds wanneer editingId verandert
  useEffect(() => {
    if (editingId) {
      const member = members.find((m) => m.id === editingId);
      if (member) {
        setEditProjectIds((prev) => ({
          ...prev,
          [editingId]: member.projectIds,
        }));
      }
    }
  }, [editingId, members]);

  // ── Editing state helpers ───────────────────────────────────────────────────

  const editingMember = useMemo(
    () => members.find((m) => m.id === editingId) ?? null,
    [members, editingId]
  );

  const availableExtraTasks = useMemo(
    () =>
      editingMember
        ? wkbTaskTemplates.filter(
            (t) => !editingMember.disciplines.includes(t.categoryId as Discipline)
          )
        : [],
    [editingMember]
  );

  // Local toggle — updates UI immediately, saved on "Opslaan"
  const toggleDiscipline = useCallback((memberId: string, disc: Discipline) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id !== memberId ? m : {
          ...m,
          disciplines: m.disciplines.includes(disc)
            ? m.disciplines.filter((d) => d !== disc)
            : [...m.disciplines, disc],
        }
      )
    );
  }, []);

  const toggleExtraTask = useCallback((memberId: string, taskId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id !== memberId ? m : {
          ...m,
          extraTaskIds: m.extraTaskIds.includes(taskId)
            ? m.extraTaskIds.filter((t) => t !== taskId)
            : [...m.extraTaskIds, taskId],
        }
      )
    );
  }, []);

  // ── Save disciplines to Supabase ────────────────────────────────────────────

  const handleSaveMember = useCallback(async (member: TeamMember) => {
    setSavingId(member.id);
    try {
      const projectIds = editProjectIds[member.id] ?? member.projectIds;
      const { error } = await supabase
        .from('profiles')
        .update({
          disciplines: member.disciplines,
          extra_task_ids: member.extraTaskIds,
          project_ids: projectIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.id);

      if (error) throw error;
      setEditingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kon wijzigingen niet opslaan';
      Alert.alert('Fout', msg);
    } finally {
      setSavingId(null);
    }
  }, [editProjectIds]);

  // ── Add new member to Supabase ──────────────────────────────────────────────

  const handleAddMember = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Vul een naam in');
      return;
    }
    setAdding(true);
    try {
      const inviteToken = crypto.randomUUID();
      const placeholderId = crypto.randomUUID();
      const disciplines = JOB_DISCIPLINES[newJobType];

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: placeholderId,
          display_name: newName.trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
          job_type: newJobType,
          disciplines,
          extra_task_ids: [],
          project_ids: newProjectIds,
          role: 'ONDERAANNEMER',
          company_name: '',
          invite_token: inviteToken,
        });

      if (error) throw error;

      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewJobType('VAKMAN');
      setNewProjectIds([]);
      setShowAddForm(false);
      await loadMembers();
      // Auto-open QR panel voor het nieuwe lid
      setQrMemberId(placeholderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kon teamlid niet toevoegen';
      Alert.alert('Fout', msg);
    } finally {
      setAdding(false);
    }
  }, [newName, newEmail, newPhone, newJobType, newProjectIds, loadMembers]);

  // ── Invite URL & sharing ────────────────────────────────────────────────────

  const getInviteUrl = useCallback((member: TeamMember) => {
    const token = member.inviteToken ?? member.id;
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://wkb-snap-sync.vercel.app';
    return `${base}/?join=${token}`;
  }, []);

  const copyInviteLink = useCallback(
    (member: TeamMember) => {
      const link = getInviteUrl(member);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(link);
      }
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2000);
    },
    [getInviteUrl]
  );

  const shareInviteWhatsApp = useCallback(
    (member: TeamMember) => {
      const link = getInviteUrl(member);
      const disciplineLabels = member.disciplines
        .map((d) => DISCIPLINE_LABELS[d])
        .join(', ');
      const text =
        `Hoi ${member.displayName}! 👋\n\n` +
        `Je bent uitgenodigd voor SpeeQ.\n` +
        `Tap de link om je account aan te maken:\n\n` +
        `${link}\n\n` +
        `Je ziet alleen de borgingspunten voor jouw discipline${member.disciplines.length > 1 ? 's' : ''}: ${disciplineLabels || 'alle taken'}.`;
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener'
      );
    },
    [getInviteUrl]
  );

  const shareNative = useCallback(
    (member: TeamMember) => {
      const link = getInviteUrl(member);
      const text = `Hoi ${member.displayName}! Je bent uitgenodigd voor SpeeQ.\nMaak je account aan via:\n${link}`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        void navigator.share({ title: 'WKB Uitnodiging', text, url: link });
      } else {
        // Fallback: WhatsApp
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          '_blank',
          'noopener'
        );
      }
    },
    [getInviteUrl]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={styles.eyebrow}>TEAMBEHEER</Text>
          <Text style={styles.pageTitle}>Team & Bevoegdheden</Text>
          <Text style={styles.pageSubtitle}>
            Beheer teamleden, rollen en toegangsrechten.
          </Text>
        </View>

        {/* ── Tab switcher ── */}
        <View style={[bvdSt.tabBar, { borderBottomColor: theme.colors.border, marginBottom: 20 }]}>
          {([
            { id: 'team' as TeamTab,          label: '👥 Team',           desc: 'Leden toevoegen & disciplines' },
            { id: 'bevoegdheden' as TeamTab,  label: '🔑 Bevoegdheden',   desc: 'Rollen & toegangsrechten' },
          ] as { id: TeamTab; label: string; desc: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[bvdSt.tabBtn, activeTab === tab.id && bvdSt.tabBtnActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[bvdSt.tabBtnLabel, { color: activeTab === tab.id ? theme.colors.accent : theme.colors.textSecondary }]}>
                {tab.label}
              </Text>
              {activeTab === tab.id && <View style={[bvdSt.tabUnderline, { backgroundColor: theme.colors.accent }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Laden / fout / inhoud ── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Team laden…
            </Text>
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
              ⚠️ {loadError}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.colors.accent, marginTop: 12 }]}
              onPress={() => void loadMembers()}
            >
              <Text style={styles.saveBtnText}>Opnieuw proberen</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'bevoegdheden' ? (
          <BevoegdhedenBord
            members={members}
            viewerRole={user?.role ?? 'ONDERAANNEMER'}
            theme={theme}
            onRoleChanged={(id, newRole) => {
              setMembers(prev => prev.map(m => m.id === id ? { ...m, role: newRole } : m));
            }}
          />
        ) : (
          <>
            {/* ── Teamleden lijst ── */}
            {members.map((member) => (
              <View
                key={member.id}
                style={[
                  styles.memberCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                {/* Links: info */}
                <View style={styles.memberLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {member.displayName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={[styles.memberName, { color: theme.colors.textPrimary }]}>
                        {member.displayName}
                      </Text>
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: member.isOnline ? theme.colors.success : theme.colors.border },
                        ]}
                      />
                      {/* Invite status badge */}
                      {member.inviteToken && !member.inviteAcceptedAt ? (
                        <View style={styles.inviteBadge}>
                          <Text style={styles.inviteBadgeText}>⏳ uitgenodigd</Text>
                        </View>
                      ) : member.inviteAcceptedAt ? (
                        <View style={[styles.inviteBadge, styles.inviteBadgeActive]}>
                          <Text style={[styles.inviteBadgeText, { color: '#059669' }]}>✓ actief</Text>
                        </View>
                      ) : null}
                    </View>
                    {member.email ? (
                      <Text style={[styles.memberEmail, { color: theme.colors.textSecondary }]}>
                        {member.email}
                      </Text>
                    ) : null}
                    <Text style={[styles.memberJob, { color: theme.colors.accent }]}>
                      {JOB_LABELS[member.jobType] ?? member.jobType}
                    </Text>
                    <View style={styles.disciplineChips}>
                      {member.disciplines.map((d) => (
                        <View
                          key={d}
                          style={[
                            styles.discChip,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(0,0,0,0.06)',
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.discChipText, { color: theme.colors.textSecondary }]}>
                            {DISCIPLINE_LABELS[d] ?? d}
                          </Text>
                        </View>
                      ))}
                      {member.extraTaskIds.length > 0 ? (
                        <View
                          style={[
                            styles.discChip,
                            {
                              backgroundColor: 'rgba(164,13,47,0.1)',
                              borderColor: 'rgba(164,13,47,0.3)',
                            },
                          ]}
                        >
                          <Text style={[styles.discChipText, { color: theme.colors.accent }]}>
                            +{member.extraTaskIds.length} extra
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Rechts: acties */}
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={[
                      styles.inviteBtn,
                      {
                        backgroundColor: qrMemberId === member.id
                          ? theme.colors.accent
                          : 'rgba(164,13,47,0.1)',
                        borderColor: theme.colors.accent,
                      },
                    ]}
                    onPress={() => setQrMemberId(qrMemberId === member.id ? null : member.id)}
                  >
                    <Text style={[styles.inviteBtnText, { color: qrMemberId === member.id ? '#fff' : theme.colors.accent }]}>
                      📲 Uitnodigen
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionChip, { borderColor: theme.colors.accent }]}
                    onPress={() => {
                      setQrMemberId(null);
                      setEditingId(editingId === member.id ? null : member.id);
                    }}
                  >
                    <Text style={styles.actionChipText}>✏️</Text>
                  </TouchableOpacity>
                </View>

                {/* ── QR uitnodigingspanel ── */}
                {qrMemberId === member.id ? (
                  <View
                    style={[
                      styles.qrPanel,
                      { borderTopColor: theme.colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
                    ]}
                  >
                    <Text style={[styles.qrTitle, { color: theme.colors.textPrimary }]}>
                      📲 Uitnodigingslink voor {member.displayName}
                    </Text>

                    {/* Disciplines */}
                    <View style={styles.qrChipsRow}>
                      {member.disciplines.map((d) => (
                        <View key={d} style={[styles.qrChip, { backgroundColor: 'rgba(164,13,47,0.1)', borderColor: theme.colors.accent + '44' }]}>
                          <Text style={[styles.qrChipText, { color: theme.colors.accent }]}>{DISCIPLINE_LABELS[d] ?? d}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Toegewezen projecten */}
                    {member.projectIds.length > 0 ? (
                      <View style={styles.qrChipsRow}>
                        {member.projectIds.map((pid) => {
                          const proj = availableProjects.find((p) => p.id === pid);
                          return (
                            <View key={pid} style={[styles.qrChip, { backgroundColor: 'rgba(8,145,178,0.1)', borderColor: '#0891b244' }]}>
                              <Text style={[styles.qrChipText, { color: '#0891b2' }]}>📁 {proj?.name ?? pid}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={[styles.qrHint, { color: theme.colors.textSecondary }]}>
                        ⚠️ Nog geen project toegewezen — klik ✏️ om een project te koppelen.
                      </Text>
                    )}

                    {/* QR code */}
                    <View style={styles.qrImageWrap}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=A40D2F&bgcolor=FFFFFF&margin=12&data=${encodeURIComponent(getInviteUrl(member))}`,
                        }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>

                    {/* URL tekst */}
                    <Text
                      style={[styles.qrUrlText, { color: theme.colors.textSecondary, borderColor: theme.colors.border }]}
                      numberOfLines={2}
                      selectable
                    >
                      {getInviteUrl(member)}
                    </Text>

                    {/* Actieknoppen */}
                    <View style={styles.qrActions}>
                      <TouchableOpacity
                        style={[styles.qrActionBtn, { backgroundColor: '#25D366' }]}
                        onPress={() => shareInviteWhatsApp(member)}
                      >
                        <Text style={styles.qrActionBtnText}>💬 WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.qrActionBtn, { backgroundColor: copiedId === member.id ? '#059669' : theme.colors.accent }]}
                        onPress={() => copyInviteLink(member)}
                      >
                        <Text style={styles.qrActionBtnText}>
                          {copiedId === member.id ? '✓ Gekopieerd!' : '🔗 Link kopiëren'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.qrActionBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
                        onPress={() => shareNative(member)}
                      >
                        <Text style={[styles.qrActionBtnText, { color: theme.colors.textPrimary }]}>📤 Delen</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.qrCloseBtn}
                      onPress={() => setQrMemberId(null)}
                    >
                      <Text style={[styles.qrCloseBtnText, { color: theme.colors.textSecondary }]}>Sluiten ✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* ── Edit panel ── */}
                {editingId === member.id ? (
                  <View
                    style={[
                      styles.editPanel,
                      {
                        borderTopColor: theme.colors.border,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(0,0,0,0.03)',
                      },
                    ]}
                  >
                    {/* Disciplines */}
                    <Text style={[styles.editLabel, { color: theme.colors.textSecondary }]}>
                      DISCIPLINES
                    </Text>
                    <View style={styles.editChipsRow}>
                      {ALL_DISCIPLINES.map((d) => {
                        const active = member.disciplines.includes(d);
                        return (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.editChip,
                              {
                                borderColor: active
                                  ? theme.colors.accent
                                  : theme.colors.border,
                              },
                              active && { backgroundColor: 'rgba(164,13,47,0.1)' },
                            ]}
                            onPress={() => toggleDiscipline(member.id, d)}
                          >
                            <Text
                              style={[
                                styles.editChipText,
                                {
                                  color: active
                                    ? theme.colors.accent
                                    : theme.colors.textSecondary,
                                },
                              ]}
                            >
                              {active ? '✓ ' : ''}
                              {DISCIPLINE_LABELS[d]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Extra taken */}
                    {availableExtraTasks.length > 0 ? (
                      <>
                        <Text
                          style={[
                            styles.editLabel,
                            { color: theme.colors.textSecondary, marginTop: 14 },
                          ]}
                        >
                          EXTRA TAKEN TOEWIJZEN
                        </Text>
                        <Text style={[styles.editHint, { color: theme.colors.textSecondary }]}>
                          Taken buiten de standaard discipline van deze vakman
                        </Text>
                        <View style={styles.editChipsRow}>
                          {availableExtraTasks.slice(0, 20).map((t) => {
                            const active = member.extraTaskIds.includes(t.id);
                            return (
                              <TouchableOpacity
                                key={t.id}
                                style={[
                                  styles.editChip,
                                  {
                                    borderColor: active
                                      ? '#059669'
                                      : theme.colors.border,
                                  },
                                  active && { backgroundColor: 'rgba(5,150,105,0.08)' },
                                ]}
                                onPress={() => toggleExtraTask(member.id, t.id)}
                              >
                                <Text
                                  style={[
                                    styles.editChipText,
                                    {
                                      color: active
                                        ? '#059669'
                                        : theme.colors.textSecondary,
                                    },
                                  ]}
                                >
                                  {active ? '✓ ' : ''}
                                  {t.title}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : null}

                    {/* Project-toewijzing voor WERKVOORBEREIDER, VAKMAN en VOORMAN */}
                    {(member.jobType === 'WERKVOORBEREIDER' || member.jobType === 'VAKMAN' || member.jobType === 'VOORMAN') && availableProjects.length > 0 ? (
                      <>
                        <Text
                          style={[
                            styles.editLabel,
                            { color: theme.colors.textSecondary, marginTop: 14 },
                          ]}
                        >
                          TOEGEWEZEN PROJECTEN
                        </Text>
                        <Text style={[styles.editHint, { color: theme.colors.textSecondary }]}>
                          Kies welke projecten deze persoon kan zien
                        </Text>
                        <View style={styles.editChipsRow}>
                          {availableProjects.map((project) => {
                            const currentIds = editProjectIds[member.id] ?? member.projectIds;
                            const selected = currentIds.includes(project.id);
                            return (
                              <TouchableOpacity
                                key={project.id}
                                style={[
                                  styles.editChip,
                                  {
                                    borderColor: selected ? '#0891b2' : theme.colors.border,
                                  },
                                  selected && { backgroundColor: 'rgba(8,145,178,0.1)' },
                                ]}
                                onPress={() => {
                                  setEditProjectIds((prev) => {
                                    const current = prev[member.id] ?? member.projectIds;
                                    return {
                                      ...prev,
                                      [member.id]: selected
                                        ? current.filter((id) => id !== project.id)
                                        : [...current, project.id],
                                    };
                                  });
                                }}
                              >
                                <Text
                                  style={[
                                    styles.editChipText,
                                    { color: selected ? '#0891b2' : theme.colors.textSecondary },
                                  ]}
                                >
                                  {selected ? '✓ ' : ''}
                                  {project.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { backgroundColor: theme.colors.accent },
                        savingId === member.id && { opacity: 0.6 },
                      ]}
                      onPress={() => void handleSaveMember(member)}
                      disabled={savingId === member.id}
                    >
                      {savingId === member.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveBtnText}>Opslaan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}

            {/* ── Leeg team ── */}
            {members.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👷</Text>
                <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                  Nog geen teamleden
                </Text>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  Voeg een vakman toe om een uitnodigingslink aan te maken.
                </Text>
              </View>
            ) : null}
          </>
        )}

        {/* ── Nieuw lid toevoegen ── */}
        {showAddForm ? (
          <View
            style={[
              styles.addForm,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.addFormTitle, { color: theme.colors.textPrimary }]}>
              Nieuw teamlid
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Naam *"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="words"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                },
              ]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Email (optioneel)"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                },
              ]}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="Telefoon (optioneel)"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
            />

            <Text
              style={[
                styles.editLabel,
                { color: theme.colors.textSecondary, marginTop: 12, marginBottom: 8 },
              ]}
            >
              PROFIEL
            </Text>
            <View style={styles.editChipsRow}>
              {ALL_JOB_TYPES.map((jt) => (
                <TouchableOpacity
                  key={jt}
                  style={[
                    styles.editChip,
                    {
                      borderColor:
                        newJobType === jt ? theme.colors.accent : theme.colors.border,
                    },
                    newJobType === jt && { backgroundColor: 'rgba(164,13,47,0.1)' },
                  ]}
                  onPress={() => setNewJobType(jt)}
                >
                  <Text
                    style={[
                      styles.editChipText,
                      {
                        color:
                          newJobType === jt
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {JOB_LABELS[jt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newJobType !== 'VAKMAN' ? (
              <View style={[styles.disciplinePreview, { borderColor: theme.colors.border }]}>
                <Text style={[styles.editHint, { color: theme.colors.textSecondary }]}>
                  Krijgt automatisch toegang tot:{' '}
                  {JOB_DISCIPLINES[newJobType]
                    .map((d) => DISCIPLINE_LABELS[d])
                    .join(', ')}
                </Text>
              </View>
            ) : null}

            {(newJobType === 'WERKVOORBEREIDER' || newJobType === 'VAKMAN' || newJobType === 'VOORMAN') && availableProjects.length > 0 ? (
              <>
                <Text
                  style={[
                    styles.editLabel,
                    { color: theme.colors.textSecondary, marginTop: 4, marginBottom: 8 },
                  ]}
                >
                  TOEGEWEZEN PROJECTEN
                </Text>
                <Text style={[styles.editHint, { color: theme.colors.textSecondary }]}>
                  Kies welke projecten deze persoon kan zien
                </Text>
                <View style={styles.editChipsRow}>
                  {availableProjects.map((project) => {
                    const selected = newProjectIds.includes(project.id);
                    return (
                      <TouchableOpacity
                        key={project.id}
                        style={[
                          styles.editChip,
                          {
                            borderColor: selected ? '#0891b2' : theme.colors.border,
                          },
                          selected && { backgroundColor: 'rgba(8,145,178,0.1)' },
                        ]}
                        onPress={() => {
                          setNewProjectIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== project.id)
                              : [...prev, project.id]
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.editChipText,
                            { color: selected ? '#0891b2' : theme.colors.textSecondary },
                          ]}
                        >
                          {selected ? '✓ ' : ''}
                          {project.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.colors.accent, flex: 1 },
                  adding && { opacity: 0.6 },
                ]}
                onPress={() => void handleAddMember()}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>💬 Aanmaken & uitnodigen</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setShowAddForm(false)}
                disabled={adding}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>
                  Annuleer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          !loading && (
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: theme.colors.accent }]}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.addBtnText, { color: theme.colors.accent }]}>
                + Vakman toevoegen
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (
  theme: { name?: string; colors: Record<string, string> },
  isDark: boolean
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      padding: 20,
      paddingBottom: 60,
      gap: 12,
      maxWidth: 860,
      alignSelf: 'center',
      width: '100%',
    },

    centered: { alignItems: 'center', paddingVertical: 40 },
    loadingText: { marginTop: 12, fontSize: 14 },
    errorText: { fontSize: 14, textAlign: 'center' },

    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 300 },

    // Header
    pageHeader: { marginBottom: 8 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 3,
      color: theme.colors.accent,
      marginBottom: 6,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.colors.textPrimary,
      letterSpacing: -0.8,
      marginBottom: 4,
    },
    pageSubtitle: { fontSize: 14, color: theme.colors.textSecondary },

    // Member card
    memberCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'flex-start',
    },
    memberLeft: {
      flex: 1,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      minWidth: 200,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(164,13,47,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: { fontSize: 15, fontWeight: '800', color: theme.colors.accent },
    memberInfo: { flex: 1, gap: 4 },
    memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    memberName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
    onlineDot: { width: 7, height: 7, borderRadius: 4 },
    inviteBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    inviteBadgeActive: { backgroundColor: 'rgba(5,150,105,0.1)' },
    inviteBadgeText: { fontSize: 10, fontWeight: '700', color: '#9B6700' },
    memberEmail: { fontSize: 11, marginTop: -2 },
    memberJob: { fontSize: 12, fontWeight: '700' },
    disciplineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
    discChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    discChipText: { fontSize: 10, fontWeight: '600' },

    // Member actions
    memberActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    actionChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionChipText: { fontSize: 15 },
    inviteBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteBtnText: { fontSize: 13, fontWeight: '700' },

    // QR uitnodigingspanel
    qrPanel: {
      width: '100%',
      borderTopWidth: 1,
      paddingTop: 18,
      marginTop: 4,
      gap: 10,
      alignItems: 'center',
    },
    qrTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    qrChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    qrChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    qrChipText: { fontSize: 12, fontWeight: '700' },
    qrHint: { fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
    qrImageWrap: {
      marginVertical: 8,
      padding: 12,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    qrImage: { width: 220, height: 220 },
    qrUrlText: {
      fontSize: 11,
      fontFamily: 'monospace',
      textAlign: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: 8,
      maxWidth: 380,
      width: '100%',
    },
    qrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
    qrActionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    qrCloseBtn: { paddingVertical: 6, paddingHorizontal: 12, marginTop: 4 },
    qrCloseBtnText: { fontSize: 12, fontWeight: '600' },

    // Edit panel
    editPanel: {
      width: '100%',
      borderTopWidth: 1,
      paddingTop: 14,
      marginTop: 4,
      gap: 4,
    },
    editLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 8,
    },
    editHint: { fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
    editChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    editChip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    editChipText: { fontSize: 12, fontWeight: '600' },
    saveBtn: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

    // Add form
    addForm: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
    addFormTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
    },
    disciplinePreview: { borderRadius: 10, borderWidth: 1, padding: 10 },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600' },

    // Add button
    addBtn: {
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'dashed' as const,
      paddingVertical: 16,
      alignItems: 'center',
    },
    addBtnText: { fontSize: 14, fontWeight: '700' },
  });

// ─── Bevoegdheden bord ────────────────────────────────────────────────────────

type WkbRole =
  | 'ADMIN'
  | 'PROJECTLEIDER'
  | 'WERKVOORBEREIDER'
  | 'KWALITEITSBORGER'
  | 'VOORMAN'
  | 'VAKMAN'
  | 'OPDRACHTGEVER'
  | 'ONDERAANNEMER';

// Welke rollen mag een viewer toewijzen?
const ASSIGNABLE_BY: Record<string, WkbRole[]> = {
  ADMIN: ['PROJECTLEIDER', 'WERKVOORBEREIDER', 'KWALITEITSBORGER', 'VOORMAN', 'VAKMAN', 'OPDRACHTGEVER', 'ONDERAANNEMER'],
  PROJECTLEIDER: ['WERKVOORBEREIDER', 'VOORMAN', 'VAKMAN'],
};

const ROLE_META: Record<WkbRole, { label: string; icon: string; color: string; bg: string }> = {
  ADMIN:             { label: 'Key user',         icon: '🔑', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  PROJECTLEIDER:     { label: 'Projectleider',    icon: '📋', color: '#2563eb', bg: 'rgba(37,99,235,0.1)'  },
  WERKVOORBEREIDER:  { label: 'Werkvoorbereider', icon: '🏗️', color: '#d97706', bg: 'rgba(217,119,6,0.1)'  },
  KWALITEITSBORGER:  { label: 'Kwaliteitsborger', icon: '🛡️', color: '#0891b2', bg: 'rgba(8,145,178,0.1)'  },
  VOORMAN:           { label: 'Voorman',           icon: '👷', color: '#ca8a04', bg: 'rgba(202,138,4,0.1)'  },
  VAKMAN:            { label: 'Vakman',            icon: '🔨', color: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  OPDRACHTGEVER:     { label: 'Opdrachtgever',    icon: '🏢', color: '#475569', bg: 'rgba(71,85,105,0.1)'  },
  ONDERAANNEMER:     { label: 'Onderaannemer',    icon: '🔩', color: '#64748b', bg: 'rgba(100,116,139,0.08)'},
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role as WkbRole] ?? { label: role, icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)' };
  return (
    <View style={[bvdSt.roleBadge, { backgroundColor: meta.bg }]}>
      <Text style={[bvdSt.roleBadgeText, { color: meta.color }]}>
        {meta.icon} {meta.label}
      </Text>
    </View>
  );
}

interface BevoegdhedenBordProps {
  members: TeamMember[];
  viewerRole: string;
  theme: { colors: Record<string, string> };
  onRoleChanged: (id: string, newRole: string) => void;
}

function BevoegdhedenBord({ members, viewerRole, theme, onRoleChanged }: BevoegdhedenBordProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [savedId, setSavedId]           = useState<string | null>(null);
  const [errorId, setErrorId]           = useState<string | null>(null);

  // Normaliseer role naar uppercase zodat 'admin' en 'ADMIN' beide werken
  const normRole = (viewerRole ?? '').toUpperCase();
  const assignable = ASSIGNABLE_BY[normRole] ?? [];
  const canDelegate = assignable.length > 0;

  // Groepeer members op huidige rol
  const byRole = useMemo(() => {
    const order: WkbRole[] = ['ADMIN', 'PROJECTLEIDER', 'WERKVOORBEREIDER', 'KWALITEITSBORGER', 'VOORMAN', 'VAKMAN', 'OPDRACHTGEVER', 'ONDERAANNEMER'];
    const map = new Map<string, TeamMember[]>();
    for (const r of order) map.set(r, []);
    for (const m of members) {
      const r = m.role as WkbRole;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    }
    return order.map(r => ({ role: r, items: map.get(r) ?? [] })).filter(g => g.items.length > 0);
  }, [members]);

  const changeRole = async (memberId: string, newRole: WkbRole) => {
    setSavingId(memberId);
    setErrorId(null);
    setOpenDropdown(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;
      onRoleChanged(memberId, newRole);
      setSavedId(memberId);
      setTimeout(() => setSavedId(prev => prev === memberId ? null : prev), 3000);
    } catch {
      setErrorId(memberId);
    } finally {
      setSavingId(null);
    }
  };

  if (!canDelegate) {
    return (
      <View style={{ gap: 16 }}>
        <View style={[bvdSt.noAccess, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={{ fontSize: 32 }}>🔒</Text>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
            Alleen bekijken
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
            Jouw rol ({viewerRole || 'onbekend'}) heeft geen bevoegdheid om rollen te wijzigen. Je kunt wel zien wie welke rol heeft.
          </Text>
        </View>
        {/* Toon teamoverzicht als read-only */}
        {byRole.map(({ role, items }) => {
          const meta = ROLE_META[role as WkbRole] ?? { label: role, icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)' };
          return (
            <View key={role} style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: theme.colors.textSecondary }}>
                {meta.icon} {meta.label} — {items.length} persoon{items.length !== 1 ? 'en' : ''}
              </Text>
              {items.map(m => (
                <View key={m.id} style={[bvdSt.memberRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={[bvdSt.memberAvatar, { backgroundColor: meta.bg }]}>
                    <Text style={[bvdSt.memberAvatarText, { color: meta.color }]}>
                      {m.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <Text style={[bvdSt.memberName, { color: theme.colors.textPrimary }]}>{m.displayName}</Text>
                </View>
              ))}
            </View>
          );
        })}
        {members.length === 0 && (
          <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
            Geen teamleden gevonden.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Uitleg banner */}
      <View style={[bvdSt.infoBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={{ fontSize: 20 }}>{normRole === 'ADMIN' ? '🔑' : '📋'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 14 }}>
            {normRole === 'ADMIN' ? 'Key user — volledige delegatie' : 'Projectleider — beperkte delegatie'}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 }}>
            {normRole === 'ADMIN'
              ? `Je kunt iedereen elke rol geven (behalve key user). Tik op een rol-chip om te wijzigen.`
              : `Je kunt rollen toewijzen: Werkvoorbereider, Voorman en Vakman. Tik op een rol-chip om te wijzigen.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {assignable.map(r => {
              const meta = ROLE_META[r];
              return (
                <View key={r} style={[bvdSt.roleBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[bvdSt.roleBadgeText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Per-rol groepen */}
      {byRole.map(({ role, items }) => {
        const meta = ROLE_META[role] ?? { label: role, icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)' };
        return (
          <View key={role} style={{ gap: 6 }}>
            {/* Groep header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
                {meta.icon} {meta.label} — {items.length} persoon{items.length !== 1 ? 'en' : ''}
              </Text>
            </View>

            {/* Member rijen */}
            {items.map(member => {
              const canChange = assignable.includes(member.role as WkbRole) || (normRole === 'ADMIN' && member.role?.toUpperCase() !== 'ADMIN');
              const isOpen = openDropdown === member.id;
              const isSaving = savingId === member.id;
              const isSaved = savedId === member.id;
              const hasError = errorId === member.id;
              const ini = member.displayName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

              return (
                <View
                  key={member.id}
                  style={[bvdSt.memberRow, {
                    backgroundColor: theme.colors.surface,
                    borderColor: isOpen ? theme.colors.accent : theme.colors.border,
                  }]}
                >
                  {/* Avatar */}
                  <View style={[bvdSt.memberAvatar, { backgroundColor: meta.bg }]}>
                    <Text style={[bvdSt.memberAvatarText, { color: meta.color }]}>{ini}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[bvdSt.memberName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {member.displayName}
                    </Text>
                    {member.email ? (
                      <Text style={[bvdSt.memberEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {member.email}
                      </Text>
                    ) : null}
                    <Text style={[bvdSt.memberJob, { color: theme.colors.textSecondary }]}>
                      {member.jobType ? JOB_LABELS[member.jobType] ?? member.jobType : '—'}
                    </Text>
                  </View>

                  {/* Rol chip + wissel */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {isSaving ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : canChange ? (
                      <TouchableOpacity
                        onPress={() => setOpenDropdown(isOpen ? null : member.id)}
                        activeOpacity={0.75}
                        style={[bvdSt.roleBadge, { backgroundColor: meta.bg, borderWidth: 1, borderColor: meta.color + '40' }]}
                      >
                        <Text style={[bvdSt.roleBadgeText, { color: meta.color }]}>
                          {meta.icon} {meta.label} {canChange ? '▾' : ''}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                    {isSaved && <Text style={{ color: '#059669', fontSize: 11, fontWeight: '700' }}>✓ Opgeslagen</Text>}
                    {hasError && <Text style={{ color: '#ef4444', fontSize: 11 }}>Fout — probeer opnieuw</Text>}
                  </View>

                  {/* Dropdown */}
                  {isOpen && (
                    <View style={[bvdSt.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: '#000' }]}>
                      <Text style={[bvdSt.dropdownTitle, { color: theme.colors.textSecondary }]}>
                        Rol wijzigen voor {member.displayName}
                      </Text>
                      {assignable.map(r => {
                        const rm = ROLE_META[r];
                        const isCurrent = member.role === r;
                        return (
                          <TouchableOpacity
                            key={r}
                            style={[
                              bvdSt.dropdownItem,
                              isCurrent && { backgroundColor: rm.bg },
                              { borderBottomColor: theme.colors.border },
                            ]}
                            onPress={() => { if (!isCurrent) void changeRole(member.id, r); else setOpenDropdown(null); }}
                            activeOpacity={0.75}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={{ fontSize: 18 }}>{rm.icon}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={[bvdSt.dropdownItemLabel, { color: isCurrent ? rm.color : theme.colors.textPrimary }]}>
                                  {rm.label}
                                </Text>
                                <Text style={[bvdSt.dropdownItemDesc, { color: theme.colors.textSecondary }]}>
                                  {ROLE_DESC[r]}
                                </Text>
                              </View>
                              {isCurrent && <Text style={{ color: rm.color, fontWeight: '800', fontSize: 13 }}>✓</Text>}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[bvdSt.dropdownCancel, { borderTopColor: theme.colors.border }]}
                        onPress={() => setOpenDropdown(null)}
                      >
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Annuleren</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const ROLE_DESC: Record<WkbRole, string> = {
  ADMIN:            'Volledige toegang, kan alles delegeren',
  PROJECTLEIDER:    'Ziet alle projecten, beheert zijn team',
  WERKVOORBEREIDER: 'Reviewt bewijsstukken, beheert dagelijkse voortgang',
  KWALITEITSBORGER: 'Externe kwaliteitsborger, keurt dossiers goed',
  VOORMAN:          'Leidt vaklieden op de bouwplaats',
  VAKMAN:           'Upload bewijsfoto\'s voor zijn borgingspunten',
  OPDRACHTGEVER:    'Leest alleen het consumentendossier',
  ONDERAANNEMER:    'Beperkte toegang, eigen taken',
};

const bvdSt = StyleSheet.create({
  // Tab bar
  tabBar:       { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn:       { paddingHorizontal: 16, paddingVertical: 10, position: 'relative' },
  tabBtnActive: {},
  tabBtnLabel:  { fontSize: 14, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 1 },

  // Info banner
  infoBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },

  // Rol badge
  roleBadge:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText:{ fontSize: 12, fontWeight: '700' },

  // Member rij
  memberRow:    { borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative' },
  memberAvatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarText: { fontSize: 14, fontWeight: '800' },
  memberName:   { fontSize: 13, fontWeight: '700' },
  memberEmail:  { fontSize: 11 },
  memberJob:    { fontSize: 11 },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: 300,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 999,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownTitle:     { fontSize: 11, fontWeight: '700', padding: 12, letterSpacing: 0.5 },
  dropdownItem:      { padding: 12, borderBottomWidth: 1 },
  dropdownItemLabel: { fontSize: 14, fontWeight: '700' },
  dropdownItemDesc:  { fontSize: 11, marginTop: 2 },
  dropdownCancel:    { padding: 12, alignItems: 'center', borderTopWidth: 1 },

  // No access
  noAccess: { alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 32 },
});
