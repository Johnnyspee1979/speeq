/**
 * EvidenceCard — Sprint 9 — gebouwd met 21st.dev Magic MCP als design-tool.
 *
 * Patroon: photo-first hero card met overlay (geïnspireerd op `verification-card`
 * uit 21st.dev), status-pill rechtsboven, sync-dot linksboven, gradient-footer
 * met borgingspunt + tijd over de foto. Daaronder een compacte detail-rij met
 * GPS + field note, en een action-balk met MotionPressable icon-buttons.
 *
 * Aangepast op SpeeQ theme-tokens (geen Tailwind). Alle hover/tap-feedback via
 * Framer Motion (`MotionPressable`). Keyboard-accessible via :focus-visible.
 *
 * Werkt op web én native (RN). Native fallback gebruikt standaard Pressable.
 */

import React, { useState } from 'react';
import {
  View, Text, Image, Platform, StyleSheet,
} from 'react-native';
import type { Theme } from '../theme/theme';
import MotionPressable from './motion/MotionPressable';

export type EvidenceBucket = 'akkoord' | 'review' | 'afgekeurd' | 'pending';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface EvidenceCardItem {
  id: string;
  mediaUri?: string | null;
  inspectionPointId?: string | null;
  timestamp?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  fieldNote?: string | null;
  aiStatus?: string | null;
  aiNotes?: string | null;
  userId?: string | null;
  syncStatus?: SyncStatus | null;
  bucket: EvidenceBucket;
  stale?: boolean;
}

interface Props {
  item: EvidenceCardItem;
  theme: Theme;
  selected?: boolean;
  expanded?: boolean;
  commentCount?: number;
  onToggleExpand: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShareWhatsApp?: (id: string) => void;
  onToggleComments?: (id: string) => void;
  onEdit?: (id: string) => void;
}

// Status-mapping (SpeeQ-tokens, niet Tailwind) — geïnspireerd op 21st.dev "light" badge appearance
function statusConfig(bucket: EvidenceBucket, theme: Theme) {
  switch (bucket) {
    case 'akkoord':   return { bg: theme.colors.success + '22', text: theme.colors.success, label: 'Akkoord',   icon: '✓' };
    case 'review':    return { bg: theme.colors.warning + '22', text: theme.colors.warning, label: 'Review',    icon: '!' };
    case 'afgekeurd': return { bg: theme.colors.danger  + '22', text: theme.colors.danger,  label: 'Afgekeurd', icon: '✗' };
    default:          return { bg: theme.colors.textSecondary + '22', text: theme.colors.textSecondary, label: 'Pending', icon: '·' };
  }
}

function syncConfig(s: SyncStatus | null | undefined, theme: Theme) {
  if (s === 'SYNCED') return { color: theme.colors.success, label: 'Online' };
  if (s === 'FAILED') return { color: theme.colors.danger,  label: 'Sync mislukt' };
  return { color: theme.colors.warning, label: 'Wachtend op sync' };
}

function fmtDate(ts?: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ts.slice(0, 16); }
}

export default function EvidenceCard({
  item, theme, selected, expanded, commentCount = 0,
  onToggleExpand, onToggleSelect, onApprove, onReject,
  onShareWhatsApp, onToggleComments, onEdit,
}: Props) {
  const status = statusConfig(item.bucket, theme);
  const sync = syncConfig(item.syncStatus, theme);
  const uri = item.mediaUri ?? null;

  // ── Web-versie: hero-foto met gradient-overlay en MotionPressable acties ──
  if (Platform.OS === 'web') {
    return (
      <div
        data-evidence-card={item.id}
        style={{
          background: theme.colors.surface,
          border: `1px solid ${selected ? theme.colors.accent : item.stale ? theme.colors.danger : item.bucket === 'review' ? theme.colors.warning : theme.colors.border}`,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          boxShadow: theme.shadow.md,
          fontFamily: theme.font.body,
          transition: 'border-color 200ms ease',
        }}
      >
        {/* ── Hero-foto met overlays ── */}
        <button
          type="button"
          onClick={() => onToggleExpand(item.id)}
          aria-label={`Bewijs ${item.inspectionPointId ?? item.id} ${expanded ? 'inklappen' : 'uitklappen'}`}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: expanded ? '4/3' : '16/9',
            background: theme.colors.surfaceAlt,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'block',
            transition: 'aspect-ratio 240ms ease',
          }}
        >
          {uri ? (
            <img
              src={uri}
              alt={item.inspectionPointId ?? 'Bewijsfoto'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, color: theme.colors.textSecondary,
            }}>📷</div>
          )}

          {/* Top-left: sync-indicator + checkbox */}
          <div style={{
            position: 'absolute', top: theme.spacing.sm, left: theme.spacing.sm,
            display: 'flex', alignItems: 'center', gap: theme.spacing.xs,
          }}>
            {onToggleSelect && (
              <span
                onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `2px solid ${selected ? theme.colors.accent : 'rgba(255,255,255,0.7)'}`,
                  background: selected ? theme.colors.accent : 'rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 12, fontWeight: 900, color: '#fff',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {selected ? '✓' : ''}
              </span>
            )}
            <span
              title={sync.label}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: sync.color,
                boxShadow: `0 0 0 2px rgba(0,0,0,0.4)`,
              }}
            />
          </div>

          {/* Top-right: status pill (light appearance, 21st.dev pattern) */}
          <div style={{
            position: 'absolute', top: theme.spacing.sm, right: theme.spacing.sm,
            display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, alignItems: 'flex-end',
          }}>
            <span style={{
              padding: `4px 10px`,
              background: status.bg,
              color: status.text,
              border: `1px solid ${status.text}40`,
              borderRadius: theme.radius.pill,
              fontSize: 11, fontWeight: 700,
              letterSpacing: 0.3,
              backdropFilter: 'blur(8px)',
            }}>
              {status.icon}  {status.label}
            </span>
            {item.stale && (
              <span style={{
                padding: `3px 8px`,
                background: theme.colors.danger + '22',
                color: theme.colors.danger,
                border: `1px solid ${theme.colors.danger}40`,
                borderRadius: theme.radius.pill,
                fontSize: 10, fontWeight: 800,
                backdropFilter: 'blur(8px)',
              }}>
                ⏰ 24u+
              </span>
            )}
          </div>

          {/* Bottom gradient + meta-overlay */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: `${theme.spacing.md}px ${theme.spacing.md}px ${theme.spacing.sm}px`,
            background: 'linear-gradient(to top, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.6) 60%, transparent 100%)',
            color: '#F8FAFC',
            textAlign: 'left',
          }}>
            <div style={{
              fontFamily: theme.font.heading,
              fontSize: 14, fontWeight: 700, letterSpacing: -0.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.inspectionPointId ?? '—'}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500,
              color: '#CBD5E1',
              marginTop: 2,
              display: 'flex', gap: 12, flexWrap: 'wrap',
            }}>
              <span>🕐 {fmtDate(item.timestamp)}</span>
              {item.gpsLat != null && item.gpsLng != null && (
                <span>📍 {item.gpsLat.toFixed(4)}, {item.gpsLng.toFixed(4)}</span>
              )}
            </div>
          </div>
        </button>

        {/* ── Field note (alleen als aanwezig) ── */}
        {item.fieldNote && (
          <div style={{
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            color: theme.colors.textSecondary,
            fontSize: 12,
            borderBottom: `1px solid ${theme.colors.border}`,
            fontStyle: 'italic',
          }}>
            <span style={{ color: theme.colors.textPrimary, fontWeight: 600, marginRight: 6 }}>📝</span>
            {item.fieldNote}
          </div>
        )}

        {/* ── Action-balk: MotionPressable icon-buttons ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          padding: theme.spacing.sm,
          borderTop: `1px solid ${theme.colors.border}`,
        }}>
          {/* Goedkeuren */}
          <MotionPressable
            onPress={() => onApprove(item.id)}
            disabled={item.bucket === 'akkoord'}
            accessibilityLabel="Goedkeuren"
            pressScale={0.92}
            hoverScale={1.06}
            style={{
              flex: 1,
              height: 36,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.success + '15',
              borderWidth: 1, borderStyle: 'solid', borderColor: theme.colors.success + '50',
              flexDirection: 'row',
              gap: 6,
            } as any}
          >
            <Text style={{ color: theme.colors.success, fontWeight: '800', fontSize: 13, fontFamily: theme.font.body }}>
              ✓ Goed
            </Text>
          </MotionPressable>

          {/* Afkeuren */}
          <MotionPressable
            onPress={() => onReject(item.id)}
            disabled={item.bucket === 'afgekeurd'}
            accessibilityLabel="Afkeuren"
            pressScale={0.92}
            hoverScale={1.06}
            style={{
              flex: 1,
              height: 36,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.danger + '12',
              borderWidth: 1, borderStyle: 'solid', borderColor: theme.colors.danger + '50',
              flexDirection: 'row',
              gap: 6,
            } as any}
          >
            <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 13, fontFamily: theme.font.body }}>
              ✗ Afkeur
            </Text>
          </MotionPressable>

          {/* WhatsApp */}
          {onShareWhatsApp && (
            <MotionPressable
              onPress={() => onShareWhatsApp(item.id)}
              accessibilityLabel="Delen via WhatsApp"
              pressScale={0.9}
              hoverScale={1.1}
              style={{
                width: 36, height: 36,
                borderRadius: theme.radius.md,
                backgroundColor: 'rgba(37,211,102,0.10)',
                borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(37,211,102,0.40)',
              } as any}
            >
              <Text style={{ fontSize: 14 }}>📱</Text>
            </MotionPressable>
          )}

          {/* Comments */}
          {onToggleComments && (
            <MotionPressable
              onPress={() => onToggleComments(item.id)}
              accessibilityLabel={`Opmerkingen ${commentCount > 0 ? `(${commentCount})` : ''}`}
              pressScale={0.9}
              hoverScale={1.1}
              style={{
                height: 36, paddingHorizontal: 10,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1, borderStyle: 'solid', borderColor: theme.colors.border,
                flexDirection: 'row',
                gap: 4,
              } as any}
            >
              <Text style={{ fontSize: 13 }}>💬</Text>
              {commentCount > 0 && (
                <Text style={{ color: theme.colors.textPrimary, fontWeight: '800', fontSize: 11, fontFamily: theme.font.mono }}>
                  {commentCount}
                </Text>
              )}
            </MotionPressable>
          )}

          {/* Edit */}
          {onEdit && (
            <MotionPressable
              onPress={() => onEdit(item.id)}
              accessibilityLabel="Bewerken"
              pressScale={0.9}
              hoverScale={1.1}
              style={{
                width: 36, height: 36,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1, borderStyle: 'solid', borderColor: theme.colors.border,
              } as any}
            >
              <Text style={{ fontSize: 13 }}>✏️</Text>
            </MotionPressable>
          )}
        </div>

        {/* ── Expanded details (optioneel; AnimatePresence-style fade) ── */}
        {expanded && (
          <div style={{
            padding: theme.spacing.md,
            borderTop: `1px solid ${theme.colors.border}`,
            background: theme.colors.background,
            display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
            animation: 'evidenceCardFadeIn 220ms ease-out',
          }}>
            {item.aiNotes && (
              <div style={{
                padding: theme.spacing.sm,
                background: status.bg,
                borderRadius: theme.radius.sm,
                borderLeft: `3px solid ${status.text}`,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  color: status.text, marginBottom: 4, textTransform: 'uppercase',
                }}>AI-analyse</div>
                <div style={{ fontSize: 12, color: theme.colors.textPrimary, lineHeight: 1.5 }}>
                  {item.aiNotes}
                </div>
              </div>
            )}
            {item.userId && (
              <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>Geüpload door:</span>
                <span style={{ fontFamily: theme.font.mono, color: theme.colors.textPrimary }}>{item.userId}</span>
              </div>
            )}
            {item.gpsLat != null && item.gpsLng != null && (
              <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>GPS:</span>
                <span style={{ fontFamily: theme.font.mono, color: theme.colors.textPrimary }}>
                  {item.gpsLat.toFixed(5)}, {item.gpsLng.toFixed(5)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Inline keyframes voor de expand-fade */}
        <style>{`
          @keyframes evidenceCardFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Native fallback: simpele Pressable-card (mobile) ──
  return (
    <View style={[nativeSt.card, {
      backgroundColor: theme.colors.surface,
      borderColor: selected ? theme.colors.accent : theme.colors.border,
      borderRadius: theme.radius.lg,
    }]}>
      {uri ? (
        <Image source={{ uri }} style={nativeSt.thumb} resizeMode="cover" />
      ) : (
        <View style={[nativeSt.thumb, { backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 32 }}>📷</Text>
        </View>
      )}
      <View style={[nativeSt.statusOverlay, { backgroundColor: status.bg }]}>
        <Text style={{ color: status.text, fontWeight: '800', fontSize: 11 }}>
          {status.icon}  {status.label}
        </Text>
      </View>
      <View style={{ padding: theme.spacing.md, gap: 4 }}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
          {item.inspectionPointId ?? '—'}
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
          {fmtDate(item.timestamp)}
        </Text>
      </View>
      <View style={[nativeSt.actionRow, { borderTopColor: theme.colors.border }]}>
        <MotionPressable onPress={() => onApprove(item.id)} style={[nativeSt.actionBtn, { backgroundColor: theme.colors.success + '15' }] as any}>
          <Text style={{ color: theme.colors.success, fontWeight: '800', fontSize: 12 }}>✓ Goed</Text>
        </MotionPressable>
        <MotionPressable onPress={() => onReject(item.id)} style={[nativeSt.actionBtn, { backgroundColor: theme.colors.danger + '12' }] as any}>
          <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>✗ Afkeur</Text>
        </MotionPressable>
      </View>
    </View>
  );
}

const nativeSt = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  statusOverlay: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  actionRow: {
    flexDirection: 'row', gap: 6,
    padding: 8, borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
