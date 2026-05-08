/**
 * NotificatiePanel — live notificatiecentrum voor WKB Snap & Sync.
 *
 * Bellknop in de header + dropdown met de laatste 20 events:
 *  - 📸 Nieuw bewijs geüpload
 *  - ✓/✗ Status gewijzigd
 *
 * Events komen binnen via Supabase postgres_changes real-time.
 * Ongelezen teller opgeslagen in localStorage.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'NEW_EVIDENCE' | 'STATUS_CHANGED';

interface NotifEvent {
  id: string;
  type: EventType;
  message: string;
  sub: string | null;
  ts: string; // ISO
}

type Theme = {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
};

interface Props {
  projectId: string;
  theme: Theme;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const READ_KEY = (pid: string) => `wkb_notif_read_${pid}`;

function loadReadAt(projectId: string): number {
  if (typeof window === 'undefined') return 0;
  try { return parseInt(window.localStorage.getItem(READ_KEY(projectId)) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveReadAt(projectId: string, ts: number) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(READ_KEY(projectId), String(ts)); }
  catch { /* ignore */ }
}

function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Zojuist';
    if (mins < 60) return `${mins} min geleden`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} uur geleden`;
    return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch { return ''; }
}

function eventIcon(type: EventType): string {
  if (type === 'NEW_EVIDENCE')   return '📸';
  if (type === 'STATUS_CHANGED') return '🔄';
  return '•';
}

function makeId(): string {
  return Math.random().toString(36).slice(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificatiePanel({ projectId, theme }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<NotifEvent[]>([]);
  const [readAt, setReadAt] = useState(() => loadReadAt(projectId));
  const panelRef = useRef<View>(null);

  // Unread count = events newer than readAt
  const unread = events.filter(e => new Date(e.ts).getTime() > readAt).length;

  // Push event to top of list (max 20)
  const addEvent = useCallback((ev: NotifEvent) => {
    setEvents(prev => [ev, ...prev].slice(0, 20));
  }, []);

  // Mark all as read
  const markRead = useCallback(() => {
    const now = Date.now();
    setReadAt(now);
    saveReadAt(projectId, now);
  }, [projectId]);

  // Load recent evidence inserts on mount (last 10)
  useEffect(() => {
    supabase
      .from('evidence')
      .select('id, inspection_point_id, timestamp, ai_status')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!data) return;
        const initial: NotifEvent[] = data.map(row => ({
          id: row.id as string,
          type: 'NEW_EVIDENCE' as EventType,
          message: `Bewijs geüpload`,
          sub: (row.inspection_point_id as string | null) ?? null,
          ts: (row.timestamp as string | null) ?? new Date().toISOString(),
        }));
        setEvents(initial);
      }, () => {});
  }, [projectId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`notif-panel-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evidence', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          addEvent({
            id: makeId(),
            type: 'NEW_EVIDENCE',
            message: '📸 Nieuw bewijs geüpload',
            sub: (row.inspection_point_id as string | null) ?? null,
            ts: (row.timestamp as string | null) ?? new Date().toISOString(),
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'evidence', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          if (row.ai_status !== oldRow.ai_status) {
            const status = row.ai_status as string;
            const icon = status === 'PASSED' ? '✓' : status === 'FAILED' ? '✗' : '⚠';
            addEvent({
              id: makeId(),
              type: 'STATUS_CHANGED',
              message: `${icon} Status: ${status}`,
              sub: (row.inspection_point_id as string | null) ?? null,
              ts: new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, addEvent]);

  // Close dropdown when clicking outside (web only)
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('wkb-notif-panel');
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Web render (dropdown) ───────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      // @ts-ignore
      <div id="wkb-notif-panel" style={{ position: 'relative' }}>
        {/* Bell knop */}
        {/* @ts-ignore */}
        <div
          onClick={() => { setOpen(v => !v); if (!open) markRead(); }}
          style={{
            position: 'relative', cursor: 'pointer',
            padding: '6px 10px', borderRadius: 10, borderWidth: 1,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: unread > 0 ? theme.colors.accent + '15' : theme.colors.surface,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {/* @ts-ignore */}
          <span style={{ fontSize: 16 }}>🔔</span>
          {unread > 0 && (
            // @ts-ignore
            <span style={{
              position: 'absolute', top: -4, right: -4,
              backgroundColor: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 900, borderRadius: 10,
              padding: '1px 5px', minWidth: 16, textAlign: 'center',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          // @ts-ignore
          <div style={{
            position: 'absolute', top: 38, right: 0,
            width: 320, maxHeight: 420,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            zIndex: 9999,
          }}>
            {/* Header */}
            {/* @ts-ignore */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}>
              {/* @ts-ignore */}
              <span style={{ fontSize: 13, fontWeight: 800, color: theme.colors.textPrimary }}>
                🔔 Notificaties
              </span>
              {/* @ts-ignore */}
              <span
                onClick={markRead}
                style={{ fontSize: 11, color: theme.colors.accent, cursor: 'pointer', fontWeight: 700 }}
              >
                Alles gelezen
              </span>
            </div>

            {/* Events lijst */}
            {/* @ts-ignore */}
            <div style={{ overflowY: 'auto', maxHeight: 360 }}>
              {events.length === 0 ? (
                // @ts-ignore
                <div style={{ padding: 24, textAlign: 'center', color: theme.colors.textSecondary, fontSize: 13 }}>
                  Nog geen notificaties
                </div>
              ) : events.map(ev => {
                const isNew = new Date(ev.ts).getTime() > readAt;
                return (
                  // @ts-ignore
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: isNew ? theme.colors.accent + '08' : 'transparent',
                    cursor: 'default',
                  }}>
                    {/* @ts-ignore */}
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{eventIcon(ev.type)}</span>
                    {/* @ts-ignore */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* @ts-ignore */}
                      <div style={{ fontSize: 12, fontWeight: isNew ? 800 : 600, color: theme.colors.textPrimary, marginBottom: 2 }}>
                        {ev.message}
                      </div>
                      {ev.sub && (
                        // @ts-ignore
                        <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 2 }}>
                          {ev.sub}
                        </div>
                      )}
                      {/* @ts-ignore */}
                      <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                        {fmtRelative(ev.ts)}
                      </div>
                    </div>
                    {isNew && (
                      // @ts-ignore
                      <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent, flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Native fallback ─────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={() => setOpen(v => !v)}
      style={[styles.bellBtn, { backgroundColor: unread > 0 ? theme.colors.accent + '15' : theme.colors.surface, borderColor: theme.colors.border }]}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 16 }}>🔔</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bellBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 4, minWidth: 16, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
