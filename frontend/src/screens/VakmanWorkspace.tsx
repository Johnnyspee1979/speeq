/**
 * VakmanWorkspace — Workspace voor de vakman / ambachtsman op de bouwplaats
 *
 * Doel: zo eenvoudig mogelijk. De vakman wil weten:
 *   1. Vandaag   — wat heb ik vandaag geüpload, is het goed?
 *   2. Mijn taken — welke borgingspunten moet ik nog afdekken?
 *   3. Alle uploads — overzicht van alles wat ik ooit instuurde
 *
 * Laadt evidence gefilterd op user_id (ingelogde vakman) + project_id.
 * Feedback van werkvoorbereider (field_note) en AI-status zichtbaar per foto.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { useWkbAuth } from '../hooks/useWkbAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

type AiStatus = 'PASSED' | 'FAILED' | 'NEEDS_REVIEW' | 'PENDING' | null;
type VakTab = 'vandaag' | 'taken' | 'alles';

interface EvidenceRow {
  id: string;
  project_id: string | null;
  inspection_point_id: string | null;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string | null;
  ai_status: AiStatus;
  ai_notes: string | null;
  sync_status: string | null;
  field_note: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

interface VakmanWorkspaceProps {
  projectId?: string;
  projectName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(ts: string | null): boolean {
  if (!ts) return false;
  try { return new Date(ts).toDateString() === new Date().toDateString(); }
  catch { return false; }
}

function fmtDate(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch { return ts; }
}

function statusConfig(status: AiStatus) {
  switch (status) {
    case 'PASSED':       return { icon: '✓', label: 'Goedgekeurd', color: '#059669', bg: 'rgba(5,150,105,0.1)',   border: 'rgba(5,150,105,0.25)' };
    case 'FAILED':       return { icon: '✗', label: 'Afgekeurd',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' };
    case 'NEEDS_REVIEW': return { icon: '⚠', label: 'In review',   color: '#d97706', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
    default:             return { icon: '○', label: 'Wachten…',    color: '#64748b', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VakmanWorkspace({
  projectId = 'default',
  projectName = 'Project',
}: VakmanWorkspaceProps) {
  const { theme } = useTheme();
  const { user } = useWkbAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeTab, setActiveTab] = useState<VakTab>('vandaag');
  const [evidence, setEvidence]   = useState<EvidenceRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('evidence')
        .select('id, project_id, inspection_point_id, media_uri, photo_uri, timestamp, ai_status, ai_notes, sync_status, field_note, gps_lat, gps_lng')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(200);

      // Filter op user_id alleen als we een echte user hebben (niet dev bypass)
      if (user?.id && !user.id.startsWith('dev-bypass')) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;
      setEvidence((data ?? []) as EvidenceRow[]);
    } catch { /* stil */ }
    finally { setLoading(false); }
  }, [projectId, user?.id]);

  useEffect(() => { void fetchEvidence(); }, [fetchEvidence]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const vandaagItems  = useMemo(() => evidence.filter(e => isToday(e.timestamp)), [evidence]);
  const akkoordCount  = useMemo(() => evidence.filter(e => e.ai_status === 'PASSED').length, [evidence]);
  const reviewCount   = useMemo(() => evidence.filter(e => e.ai_status === 'NEEDS_REVIEW').length, [evidence]);
  const afgekeurdCount = useMemo(() => evidence.filter(e => e.ai_status === 'FAILED').length, [evidence]);

  // ── Taken per borgingspunt ─────────────────────────────────────────────────
  // Groepeer alle uploads per inspection_point_id
  const takenMap = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>();
    for (const e of evidence) {
      const key = e.inspection_point_id ?? '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([pointId, items]) => {
      const latest = items[0]; // gesorteerd op timestamp desc
      const hasAkkoord = items.some(i => i.ai_status === 'PASSED');
      const hasAfgekeurd = items.some(i => i.ai_status === 'FAILED');
      const hasReview = items.some(i => i.ai_status === 'NEEDS_REVIEW');
      const overallStatus: AiStatus = hasAfgekeurd ? 'FAILED'
        : hasReview ? 'NEEDS_REVIEW'
        : hasAkkoord ? 'PASSED'
        : null;
      return { pointId, count: items.length, overallStatus, latest };
    }).sort((a, b) => {
      // Sortering: afgekeurd first, dan review, dan pending, dan akkoord
      const order: Record<string, number> = { FAILED: 0, NEEDS_REVIEW: 1, null: 2, undefined: 2, PASSED: 3 };
      return (order[String(a.overallStatus)] ?? 2) - (order[String(b.overallStatus)] ?? 2);
    });
  }, [evidence]);

  const TABS: { id: VakTab; label: string; badge?: number }[] = [
    { id: 'vandaag', label: '📅 Vandaag',   badge: vandaagItems.length || undefined },
    { id: 'taken',   label: '📋 Mijn taken', badge: afgekeurdCount > 0 ? afgekeurdCount : undefined },
    { id: 'alles',   label: '🗂 Alle uploads' },
  ];

  return (
    <View style={[st.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { padding: isDesktop ? 28 : 16, maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[st.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={st.headerTop}>
            <View style={st.avatarBox}>
              <Text style={st.avatarText}>👷</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.userName, { color: theme.colors.textPrimary }]}>
                {user?.companyName ?? 'Mijn werkruimte'}
              </Text>
              <Text style={[st.projectName, { color: theme.colors.textSecondary }]}>
                📍 {projectName}
              </Text>
            </View>
            {/* Vandaag badge */}
            <View style={[st.todayBadge, { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent + '40' }]}>
              <Text style={[st.todayBadgeNum, { color: theme.colors.accent }]}>{vandaagItems.length}</Text>
              <Text style={[st.todayBadgeLabel, { color: theme.colors.accent }]}>vandaag</Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={[st.statsStrip, { borderTopColor: theme.colors.border }]}>
            {[
              { label: 'Totaal',    value: evidence.length,    color: theme.colors.textPrimary },
              { label: 'Akkoord',   value: akkoordCount,       color: '#059669' },
              { label: 'In review', value: reviewCount,        color: '#d97706' },
              { label: 'Afgekeurd', value: afgekeurdCount,     color: afgekeurdCount > 0 ? '#ef4444' : theme.colors.textSecondary },
            ].map(s => (
              <View key={s.label} style={st.statItem}>
                <Text style={[st.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={[st.statLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Feedback banner: afgekeurde items */}
          {afgekeurdCount > 0 && (
            <View style={[st.feedbackBanner, { backgroundColor: 'rgba(239,68,68,0.08)', borderTopColor: 'rgba(239,68,68,0.2)' }]}>
              <Text style={{ fontSize: 18 }}>❗</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#991b1b', fontWeight: '800', fontSize: 14 }}>
                  {afgekeurdCount} foto{afgekeurdCount !== 1 ? "'s" : ''} afgekeurd
                </Text>
                <Text style={{ color: '#b91c1c', fontSize: 12, marginTop: 2 }}>
                  Bekijk de feedback en maak nieuwe foto's van deze punten.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('taken')}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Bekijken →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={[st.tabRow, { borderBottomColor: theme.colors.border }]}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[st.tabItem, activeTab === tab.id && st.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[st.tabLabel, { color: activeTab === tab.id ? theme.colors.accent : theme.colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={[st.tabBadge, { backgroundColor: tab.id === 'taken' && afgekeurdCount > 0 ? '#ef4444' : theme.colors.accent }]}>
                    <Text style={st.tabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              {activeTab === tab.id && <View style={[st.tabUnderline, { backgroundColor: theme.colors.accent }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab: Vandaag ── */}
        {activeTab === 'vandaag' && (
          <VandaagTab
            items={vandaagItems}
            loading={loading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            theme={theme}
            onRefresh={fetchEvidence}
          />
        )}

        {/* ── Tab: Taken ── */}
        {activeTab === 'taken' && (
          <TakenTab
            takenMap={takenMap}
            loading={loading}
            theme={theme}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
          />
        )}

        {/* ── Tab: Alles ── */}
        {activeTab === 'alles' && (
          <AllesTab
            evidence={evidence}
            loading={loading}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            theme={theme}
          />
        )}

      </ScrollView>
    </View>
  );
}

// ─── Tab: Vandaag ─────────────────────────────────────────────────────────────

function VandaagTab({
  items, loading, expandedId, setExpandedId, theme, onRefresh,
}: {
  items: EvidenceRow[]; loading: boolean;
  expandedId: string | null; setExpandedId: (id: string | null) => void;
  theme: { colors: Record<string, string> };
  onRefresh: () => void;
}) {
  if (loading) return <View style={tabSt.centered}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;

  const dateStr = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (items.length === 0) {
    return (
      <View style={tabSt.emptyBox}>
        <Text style={{ fontSize: 52 }}>📷</Text>
        <Text style={[tabSt.emptyTitle, { color: theme.colors.textPrimary }]}>
          Nog geen uploads vandaag
        </Text>
        <Text style={[tabSt.emptyBody, { color: theme.colors.textSecondary }]}>
          {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
          {'\n'}Maak foto's via de Camera tab en ze verschijnen hier direct.
        </Text>
        <TouchableOpacity
          style={[tabSt.refreshBtn, { borderColor: theme.colors.border }]}
          onPress={onRefresh}
        >
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>↺ Vernieuwen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const akkoord = items.filter(i => i.ai_status === 'PASSED').length;
  const afgekeurd = items.filter(i => i.ai_status === 'FAILED').length;

  return (
    <View style={{ gap: 10 }}>
      {/* Dagsamenvattting */}
      <View style={[tabSt.daySummary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[tabSt.daySummaryDate, { color: theme.colors.textSecondary }]}>
          {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
        </Text>
        <Text style={[tabSt.daySummaryNum, { color: theme.colors.textPrimary }]}>
          {items.length} foto{items.length !== 1 ? "'s" : ''} geüpload
          {akkoord > 0 ? `  ·  ${akkoord} ✓` : ''}
          {afgekeurd > 0 ? `  ·  ${afgekeurd} ✗` : ''}
        </Text>
      </View>

      {items.map(item => (
        <EvidenceCard
          key={item.id}
          item={item}
          isOpen={expandedId === item.id}
          onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          theme={theme}
          showPointId
        />
      ))}
    </View>
  );
}

// ─── Tab: Taken ───────────────────────────────────────────────────────────────

function TakenTab({
  takenMap, loading, theme, expandedId, setExpandedId,
}: {
  takenMap: { pointId: string; count: number; overallStatus: AiStatus; latest: EvidenceRow }[];
  loading: boolean;
  theme: { colors: Record<string, string> };
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  if (loading) return <View style={tabSt.centered}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;

  if (takenMap.length === 0) {
    return (
      <View style={tabSt.emptyBox}>
        <Text style={{ fontSize: 52 }}>📋</Text>
        <Text style={[tabSt.emptyTitle, { color: theme.colors.textPrimary }]}>Geen taken gevonden</Text>
        <Text style={[tabSt.emptyBody, { color: theme.colors.textSecondary }]}>
          Upload je eerste foto via de Camera tab. Dan zie je hier per borgingspunt wat de status is.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[tabSt.sectionTitle, { color: theme.colors.textSecondary }]}>
        BORGINGSPUNTEN — {takenMap.length} PUNTEN
      </Text>

      {takenMap.map(({ pointId, count, overallStatus, latest }) => {
        const cfg = statusConfig(overallStatus);
        const isOpen = expandedId === `task-${pointId}`;

        return (
          <TouchableOpacity
            key={pointId}
            style={[tabSt.taakCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
            onPress={() => setExpandedId(isOpen ? null : `task-${pointId}`)}
            activeOpacity={0.8}
          >
            <View style={tabSt.taakRow}>
              {/* Status icoon */}
              <View style={[tabSt.taakIconBox, { backgroundColor: cfg.color + '22' }]}>
                <Text style={[tabSt.taakIcon, { color: cfg.color }]}>{cfg.icon}</Text>
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[tabSt.taakId, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {pointId}
                </Text>
                <Text style={[tabSt.taakMeta, { color: theme.colors.textSecondary }]}>
                  {count} foto{count !== 1 ? "'s" : ''} · {fmtDate(latest.timestamp)}
                </Text>
              </View>

              <View style={[tabSt.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Text style={[tabSt.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>

            {/* Uitgebreid: laatste foto + feedback */}
            {isOpen && (
              <View style={[tabSt.taakExpanded, { borderTopColor: cfg.border + '80' }]}>
                {(latest.media_uri ?? latest.photo_uri) && (
                  <Image
                    source={{ uri: latest.media_uri ?? latest.photo_uri ?? '' }}
                    style={tabSt.thumbLarge}
                    resizeMode="cover"
                  />
                )}
                {/* Feedback van WV */}
                {latest.field_note ? (
                  <View style={[tabSt.feedbackBox, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' }]}>
                    <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 12, marginBottom: 4 }}>
                      💬 Feedback werkvoorbereider
                    </Text>
                    <Text style={{ color: '#78350f', fontSize: 13, lineHeight: 19 }}>
                      {latest.field_note}
                    </Text>
                  </View>
                ) : null}
                {/* AI notitie */}
                {latest.ai_notes ? (
                  <View style={[tabSt.feedbackBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.textSecondary, fontWeight: '800', fontSize: 12, marginBottom: 4 }}>
                      🤖 AI analyse
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                      {latest.ai_notes}
                    </Text>
                  </View>
                ) : null}
                {/* Actie als afgekeurd */}
                {overallStatus === 'FAILED' && (
                  <View style={[tabSt.actionHint, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}>
                    <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 13 }}>
                      ↑ Maak een nieuwe foto van dit borgingspunt en upload die via de Camera tab.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Tab: Alles ───────────────────────────────────────────────────────────────

function AllesTab({
  evidence, loading, expandedId, setExpandedId, theme,
}: {
  evidence: EvidenceRow[]; loading: boolean;
  expandedId: string | null; setExpandedId: (id: string | null) => void;
  theme: { colors: Record<string, string> };
}) {
  // Groepeer op datum
  const grouped = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>();
    for (const e of evidence) {
      const dateKey = e.timestamp
        ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(e.timestamp))
        : 'Onbekende datum';
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(e);
    }
    return Array.from(map.entries());
  }, [evidence]);

  if (loading) return <View style={tabSt.centered}><ActivityIndicator size="large" color={theme.colors.accent} /></View>;

  if (evidence.length === 0) {
    return (
      <View style={tabSt.emptyBox}>
        <Text style={{ fontSize: 52 }}>🗂</Text>
        <Text style={[tabSt.emptyTitle, { color: theme.colors.textPrimary }]}>Nog geen uploads</Text>
        <Text style={[tabSt.emptyBody, { color: theme.colors.textSecondary }]}>
          Al je geüploade foto's verschijnen hier, gesorteerd op datum.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {grouped.map(([date, items]) => (
        <View key={date} style={{ gap: 6 }}>
          <Text style={[tabSt.sectionTitle, { color: theme.colors.textSecondary }]}>
            {date.toUpperCase()} — {items.length} FOTO{items.length !== 1 ? "'S" : ''}
          </Text>
          {items.map(item => (
            <EvidenceCard
              key={item.id}
              item={item}
              isOpen={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              theme={theme}
              showPointId
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── EvidenceCard ─────────────────────────────────────────────────────────────

function EvidenceCard({
  item, isOpen, onToggle, theme, showPointId,
}: {
  item: EvidenceRow; isOpen: boolean; onToggle: () => void;
  theme: { colors: Record<string, string> }; showPointId?: boolean;
}) {
  const cfg = statusConfig(item.ai_status);
  const uri = item.media_uri ?? item.photo_uri ?? null;

  return (
    <TouchableOpacity
      style={[tabSt.evidenceCard, {
        backgroundColor: theme.colors.surface,
        borderColor: isOpen ? theme.colors.accent : cfg.border,
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      {/* Collapsed */}
      <View style={tabSt.evidenceRow}>
        {uri
          ? <Image source={{ uri }} style={tabSt.thumb} resizeMode="cover" />
          : <View style={[tabSt.thumbEmpty, { backgroundColor: theme.colors.border }]}><Text style={{ fontSize: 22 }}>📷</Text></View>
        }
        <View style={{ flex: 1, gap: 4 }}>
          {showPointId && item.inspection_point_id && (
            <Text style={[tabSt.pointId, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item.inspection_point_id}
            </Text>
          )}
          <Text style={[tabSt.evidenceTime, { color: theme.colors.textSecondary }]}>
            🕐 {fmtDate(item.timestamp)}
          </Text>
          {item.field_note && (
            <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
              💬 {item.field_note}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <View style={[tabSt.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[tabSt.statusPillText, { color: cfg.color }]}>
              {cfg.icon} {cfg.label}
            </Text>
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>{isOpen ? '▲' : '▼'}</Text>
        </View>
      </View>

      {/* Uitgebreid */}
      {isOpen && (
        <View style={[tabSt.expanded, { borderTopColor: theme.colors.border }]}>
          {uri && (
            <Image source={{ uri }} style={tabSt.thumbLarge} resizeMode="contain" />
          )}
          {item.field_note ? (
            <View style={[tabSt.feedbackBox, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', marginTop: 10 }]}>
              <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 12, marginBottom: 4 }}>
                💬 Feedback werkvoorbereider
              </Text>
              <Text style={{ color: '#78350f', fontSize: 13, lineHeight: 20 }}>{item.field_note}</Text>
            </View>
          ) : null}
          {item.ai_notes ? (
            <View style={[tabSt.feedbackBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '800', fontSize: 12, marginBottom: 4 }}>
                🤖 AI analyse
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 }}>{item.ai_notes}</Text>
            </View>
          ) : null}
          {item.gps_lat != null && (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              📍 {item.gps_lat.toFixed(4)}, {item.gps_lng?.toFixed(4)}
            </Text>
          )}
          {item.ai_status === 'FAILED' && (
            <View style={[tabSt.actionHint, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', marginTop: 8 }]}>
              <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 13 }}>
                ↑ Maak een nieuwe foto via de Camera tab voor dit borgingspunt.
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 60 },

  headerCard:    { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  headerTop:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatarBox:     { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:    { fontSize: 26 },
  userName:      { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  projectName:   { fontSize: 12, marginTop: 2 },

  todayBadge:    { alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  todayBadgeNum: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  todayBadgeLabel:{ fontSize: 10, fontWeight: '700', marginTop: 1 },

  statsStrip:    { flexDirection: 'row', borderTopWidth: 1 },
  statItem:      { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statNum:       { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:     { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  feedbackBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, padding: 14 },

  tabRow:        { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16 },
  tabItem:       { paddingHorizontal: 14, paddingVertical: 10, position: 'relative' },
  tabItemActive: {},
  tabLabel:      { fontSize: 13, fontWeight: '700' },
  tabBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 18, alignItems: 'center' },
  tabBadgeText:  { color: '#fff', fontSize: 10, fontWeight: '800' },
  tabUnderline:  { position: 'absolute', bottom: -1, left: 14, right: 14, height: 2, borderRadius: 1 },
});

const tabSt = StyleSheet.create({
  centered: { paddingVertical: 48, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', maxWidth: 300, lineHeight: 21 },
  refreshBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, marginTop: 8 },

  daySummary:    { borderRadius: 12, borderWidth: 1, padding: 14 },
  daySummaryDate:{ fontSize: 11, fontWeight: '600', marginBottom: 4 },
  daySummaryNum: { fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },

  taakCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  taakRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  taakIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  taakIcon: { fontSize: 18, fontWeight: '800' },
  taakId:   { fontSize: 13, fontWeight: '700' },
  taakMeta: { fontSize: 11 },
  taakExpanded: { borderTopWidth: 1, padding: 12, gap: 10 },

  feedbackBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  actionHint:  { borderWidth: 1, borderRadius: 10, padding: 12 },

  evidenceCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  evidenceRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb:        { width: 60, height: 60, borderRadius: 10, flexShrink: 0 },
  thumbEmpty:   { width: 60, height: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbLarge:   { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#000' },
  pointId:      { fontSize: 13, fontWeight: '700' },
  evidenceTime: { fontSize: 11 },
  expanded:     { borderTopWidth: 1, padding: 12, gap: 6 },

  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
});
