/**
 * EvidenceComments — opmerkingen-thread voor één bewijsstuk.
 *
 * Gebruik:
 *   <EvidenceComments evidenceId={item.id} projectId={projectId}
 *     role="WV" authorName="Jan de Vries" theme={theme} />
 *
 * Laadt comments bij mount, luistert via Supabase real-time naar nieuwe.
 * WV en admin kunnen direct reageren; vakman ook maar in read-only modus
 * kan dit optioneel uitgeschakeld worden via `readOnly`.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  addComment,
  deleteComment,
  getComments,
  type CommentRole,
  type EvidenceComment,
} from '../services/EvidenceCommentService';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  evidenceId: string;
  projectId?: string | null;
  role?: CommentRole;
  authorName?: string | null;
  readOnly?: boolean;
  theme: Theme;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function roleBadgeStyle(role: CommentRole): { bg: string; text: string; label: string } {
  switch (role) {
    case 'WV':    return { bg: 'rgba(37,99,235,0.12)', text: '#1d4ed8', label: 'WV' };
    case 'ADMIN': return { bg: 'rgba(124,58,237,0.12)', text: '#6d28d9', label: 'Admin' };
    default:      return { bg: 'rgba(217,119,6,0.12)', text: '#b45309', label: 'Vakman' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EvidenceComments({
  evidenceId,
  projectId,
  role = 'WV',
  authorName,
  readOnly = false,
  theme,
}: Props) {
  const [comments, setComments] = useState<EvidenceComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Laad opmerkingen bij mount
  useEffect(() => {
    setLoading(true);
    getComments(evidenceId).then(data => {
      setComments(data);
      setLoading(false);
    }, () => setLoading(false));
  }, [evidenceId]);

  // Real-time nieuwe opmerkingen
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${evidenceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'evidence_comments',
          filter: `evidence_id=eq.${evidenceId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const c: EvidenceComment = {
            id:         row.id as string,
            evidenceId: row.evidence_id as string,
            projectId:  (row.project_id as string | null) ?? null,
            userId:     (row.user_id as string | null) ?? null,
            authorName: (row.author_name as string | null) ?? null,
            role:       ((row.role as string) ?? 'WV') as CommentRole,
            body:       row.body as string,
            createdAt:  row.created_at as string,
          };
          setComments(prev => {
            if (prev.some(x => x.id === c.id)) return prev;
            return [...prev, c];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [evidenceId]);

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const result = await addComment({
      evidenceId,
      projectId,
      body: trimmed,
      role,
      authorName: authorName ?? null,
    });
    setSending(false);
    if (result) {
      setBody('');
      // Real-time zal het toevoegen; voeg alvast toe voor snelheid
      setComments(prev => prev.some(c => c.id === result.id) ? prev : [...prev, result]);
    }
  }, [body, sending, evidenceId, projectId, role, authorName]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await deleteComment(id);
    if (ok) setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { borderTopColor: theme.colors.border }]}>
      {/* Header */}
      <Text style={[s.heading, { color: theme.colors.textSecondary }]}>
        💬 OPMERKINGEN {comments.length > 0 ? `(${comments.length})` : ''}
      </Text>

      {/* Comments */}
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginVertical: 8 }} />
      ) : comments.length === 0 ? (
        <Text style={[s.empty, { color: theme.colors.textSecondary }]}>
          {readOnly ? 'Geen opmerkingen.' : 'Nog geen opmerkingen — geef feedback hieronder.'}
        </Text>
      ) : (
        <View style={s.list}>
          {comments.map(c => {
            const badge = roleBadgeStyle(c.role);
            return (
              <View key={c.id} style={[s.bubble, {
                backgroundColor: c.role === 'WV' ? 'rgba(37,99,235,0.05)' : theme.colors.surface,
                borderColor: c.role === 'WV' ? 'rgba(37,99,235,0.2)' : theme.colors.border,
              }]}>
                <View style={s.bubbleHeader}>
                  <View style={[s.roleBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.roleBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                  {c.authorName ? (
                    <Text style={[s.authorName, { color: theme.colors.textPrimary }]}>
                      {c.authorName}
                    </Text>
                  ) : null}
                  <Text style={[s.time, { color: theme.colors.textSecondary }]}>
                    {fmtTime(c.createdAt)}
                  </Text>
                  {!readOnly && (
                    <TouchableOpacity onPress={() => handleDelete(c.id)} style={s.deleteBtn}>
                      <Text style={[s.deleteText, { color: theme.colors.textSecondary }]}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[s.body, { color: theme.colors.textPrimary }]}>{c.body}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Invoer */}
      {!readOnly && (
        <View style={[s.inputRow, { borderTopColor: theme.colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[s.input, {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.background,
              outlineStyle: 'none',
            } as ReturnType<typeof StyleSheet.create>[string]]}
            value={body}
            onChangeText={setBody}
            placeholder={role === 'WV'
              ? 'Feedback geven… (bijv. "maak opnieuw, hand voor lens")'
              : 'Reageren op feedback…'}
            placeholderTextColor={theme.colors.textSecondary + '88'}
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, {
              backgroundColor: body.trim() ? theme.colors.accent : theme.colors.border,
              opacity: sending ? 0.6 : 1,
            }]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.sendText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  heading: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  empty: { fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },
  list: { gap: 6 },

  bubble: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  authorName: { fontSize: 11, fontWeight: '700', flex: 1 },
  time: { fontSize: 10 },
  deleteBtn: { padding: 2 },
  deleteText: { fontSize: 16, lineHeight: 16 },
  body: { fontSize: 12, lineHeight: 18 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 8,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10,
    paddingVertical: 8, fontSize: 13, minHeight: 38, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
