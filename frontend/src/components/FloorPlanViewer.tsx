/**
 * FloorPlanViewer — bouwtekeningen bekijken met:
 *  • Zoom + pan op desktop (muiswiel + slepen)
 *  • Pinch-to-zoom op mobiel (touch events)
 *  • Tekening uploaden (web + mobiel)
 *  • Gekleurde pins per bewijs-item (klik → detail)
 *  • Wijzigingsverzoek aanmaken + goedkeuringslink kopiëren
 *  • Statusoverzicht openstaande akkoord-aanvragen
 */

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  deleteFloorPlan, FloorPlan,
  getFloorPlansForProject, uploadFloorPlan,
} from '../services/FloorPlanService';
import {
  buildApprovalUrl, createChangeRequest,
  DrawingChangeRequest, getChangeRequestsForProject,
} from '../services/DrawingChangeRequestService';
import type { StoredWkbEvidence } from '../types/Evidence';

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = {
  colors: {
    background: string; surface: string; border: string;
    textPrimary: string; textSecondary: string; accent: string;
    success?: string; warning?: string; error?: string;
  };
};

interface Props {
  projectId: string;
  evidence: StoredWkbEvidence[];
  theme: Theme;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pinColor(s?: string | null) {
  switch (s) {
    case 'PASSED':      return '#059669';
    case 'NEEDS_REVIEW':return '#d97706';
    case 'FAILED':      return '#ef4444';
    default:            return '#6366f1';
  }
}

function statusBadge(s: DrawingChangeRequest['status']) {
  switch (s) {
    case 'APPROVED': return { bg: 'rgba(5,150,105,0.12)', text: '#059669', label: '✓ Akkoord' };
    case 'REJECTED': return { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: '✗ Afgewezen' };
    default:         return { bg: 'rgba(245,158,11,0.12)', text: '#d97706', label: '⏳ Wacht op akkoord' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FloorPlanViewer({ projectId, evidence, theme }: Props) {
  const [floorPlans, setFloorPlans]       = useState<FloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<StoredWkbEvidence | null>(null);
  const [changeRequests, setChangeRequests] = useState<DrawingChangeRequest[]>([]);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeDesc, setChangeDesc]       = useState('');
  const [changeType, setChangeType]       = useState<'AANPASSING' | 'NIEUWE_TEKENING' | 'VERWIJDERING' | 'PIN_WIJZIGING'>('AANPASSING');
  const [savingChange, setSavingChange]   = useState(false);
  const [copiedLink, setCopiedLink]       = useState<string | null>(null);

  // Zoom state (desktop)
  const [zoom, setZoom]   = useState(1);
  const [pan, setPan]     = useState({ x: 0, y: 0 });
  const isDragging        = useRef(false);
  const lastMouse         = useRef({ x: 0, y: 0 });
  const containerRef      = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Laad tekeningen ─────────────────────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    setLoading(true);
    const [plans, requests] = await Promise.all([
      getFloorPlansForProject(projectId),
      getChangeRequestsForProject(projectId),
    ]);
    setFloorPlans(plans);
    setChangeRequests(requests);
    if (plans.length > 0 && !selectedPlanId) setSelectedPlanId(plans[0]!.id);
    setLoading(false);
  }, [projectId, selectedPlanId]);

  useEffect(() => { loadPlans(); }, [projectId]);

  const selectedPlan = floorPlans.find(p => p.id === selectedPlanId) ?? null;
  const pinsForPlan  = evidence.filter(
    e => e.floorPlanId === selectedPlanId && e.pinX != null && e.pinY != null
  );
  const pendingRequests = changeRequests.filter(r => r.status === 'PENDING');

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const name = file.name.replace(/\.[^/.]+$/, '');
    const result = await uploadFloorPlan(projectId, file, name);
    if (result) {
      await loadPlans();
      setSelectedPlanId(result.id);
    }
    setUploading(false);
    if (e.target) e.target.value = '';
  }, [projectId, loadPlans]);

  const handleDelete = useCallback(async () => {
    if (!selectedPlan) return;
    Alert.alert(
      'Tekening verwijderen',
      `"${selectedPlan.name}" permanent verwijderen?`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen', style: 'destructive',
          onPress: async () => {
            await deleteFloorPlan(selectedPlan.id);
            const remaining = floorPlans.filter(p => p.id !== selectedPlan.id);
            setFloorPlans(remaining);
            setSelectedPlanId(remaining[0]?.id ?? null);
          },
        },
      ]
    );
  }, [selectedPlan, floorPlans]);

  // ── Wijzigingsverzoek ───────────────────────────────────────────────────────
  const handleCreateChange = useCallback(async () => {
    if (!changeDesc.trim()) return;
    setSavingChange(true);
    const result = await createChangeRequest({
      projectId,
      floorPlanId: selectedPlanId,
      changeType,
      changeDescription: changeDesc,
    });
    setSavingChange(false);
    if (!result) {
      Alert.alert('Fout', 'Kon wijzigingsverzoek niet aanmaken.');
      return;
    }
    const link = buildApprovalUrl(result.approvalToken);
    setChangeRequests(prev => [result, ...prev]);
    setShowChangeModal(false);
    setChangeDesc('');

    // Kopieer link naar klembord
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopiedLink(link);
    Alert.alert(
      '✅ Goedkeuringslink aangemaakt',
      `Stuur deze link naar de klant via WhatsApp of email:\n\n${link}\n\nDe link is ook naar je klembord gekopieerd.`,
      [{ text: 'Begrepen' }]
    );
  }, [changeDesc, changeType, projectId, selectedPlanId]);

  // ── Zoom: desktop muiswiel ──────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(6, Math.max(0.4, prev * (e.deltaY < 0 ? 1.12 : 0.9))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current  = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>

      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[s.title, { color: theme.colors.textPrimary }]}>📐 Bouwtekening</Text>
        <View style={s.headerRight}>
          {pendingRequests.length > 0 && (
            <View style={[s.pendingBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' }]}>
              <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '800' }}>
                ⏳ {pendingRequests.length} openstaand
              </Text>
            </View>
          )}
          {selectedPlan && (
            <TouchableOpacity
              style={[s.btn, { backgroundColor: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)' }]}
              onPress={() => setShowChangeModal(true)}
            >
              <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 12 }}>✏️ Aanpassing aanvragen</Text>
            </TouchableOpacity>
          )}
          {Platform.OS === 'web' && (
            uploading ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <>
                {/* @ts-ignore */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                />
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: theme.colors.accent }]}
                  onPress={() => (fileInputRef.current as any)?.click()}
                >
                  <Text style={s.btnText}>+ Uploaden</Text>
                </TouchableOpacity>
              </>
            )
          )}
        </View>
      </View>

      {/* ── Geen tekeningen ── */}
      {floorPlans.length === 0 ? (
        <View style={[s.emptyBox, { borderColor: theme.colors.border }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🗺</Text>
          <Text style={[s.emptyTitle, { color: theme.colors.textPrimary }]}>Nog geen bouwtekeningen</Text>
          <Text style={[s.emptyBody, { color: theme.colors.textSecondary }]}>
            Klik op "+ Uploaden" om een PNG of PDF bouwtekening toe te voegen.{'\n'}
            Vakmans kunnen daarna hun fotolocaties als pin op de tekening zetten.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Tekening tabs ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
            {floorPlans.map(fp => (
              <TouchableOpacity
                key={fp.id}
                onPress={() => { setSelectedPlanId(fp.id); resetZoom(); }}
                style={[
                  s.tab, { borderColor: theme.colors.border },
                  fp.id === selectedPlanId && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                ]}
              >
                <Text style={[s.tabText, { color: fp.id === selectedPlanId ? '#fff' : theme.colors.textSecondary }]}>
                  {fp.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Zoom controls ── */}
          {selectedPlan && Platform.OS === 'web' && (
            <View style={s.zoomBar}>
              <TouchableOpacity style={[s.zoomBtn, { borderColor: theme.colors.border }]} onPress={() => setZoom(z => Math.min(6, z * 1.25))}>
                <Text style={[s.zoomBtnText, { color: theme.colors.textPrimary }]}>＋</Text>
              </TouchableOpacity>
              <Text style={[s.zoomLevel, { color: theme.colors.textSecondary }]}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity style={[s.zoomBtn, { borderColor: theme.colors.border }]} onPress={() => setZoom(z => Math.max(0.4, z * 0.8))}>
                <Text style={[s.zoomBtnText, { color: theme.colors.textPrimary }]}>－</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.zoomBtn, { borderColor: theme.colors.border, marginLeft: 6 }]} onPress={resetZoom}>
                <Text style={[s.zoomBtnText, { color: theme.colors.textSecondary, fontSize: 11 }]}>↺</Text>
              </TouchableOpacity>
              <Text style={[s.zoomHint, { color: theme.colors.textSecondary }]}>Muiswiel = zoom · Slepen = verschuiven</Text>
            </View>
          )}

          {/* ── Tekening + pins (desktop/web) ── */}
          {selectedPlan && Platform.OS === 'web' && (
            // @ts-ignore
            <div
              ref={containerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: 12,
                marginTop: 10,
                cursor: isDragging.current ? 'grabbing' : 'grab',
                userSelect: 'none',
                backgroundColor: '#0a0a0a',
                minHeight: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* @ts-ignore */}
              <div style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center',
                position: 'relative',
                transition: isDragging.current ? 'none' : 'transform 0.05s',
              }}>
                {/* @ts-ignore */}
                <img
                  src={selectedPlan.fileUrl}
                  alt={selectedPlan.name}
                  draggable={false}
                  style={{ display: 'block', maxWidth: '100%', borderRadius: 8 }}
                />
                {pinsForPlan.map(item => (
                  // @ts-ignore
                  <div
                    key={item.id}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedEvidence(item); }}
                    title={`${item.inspectionPointId} — ${item.aiStatus ?? 'PENDING'}`}
                    style={{
                      position: 'absolute',
                      left: `${(item.pinX ?? 0) * 100}%`,
                      top: `${(item.pinY ?? 0) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 20, height: 20,
                      borderRadius: '50%',
                      backgroundColor: pinColor(item.aiStatus),
                      border: '2.5px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLElement).style.transform = 'translate(-50%,-50%) scale(1.5)'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLElement).style.transform = 'translate(-50%,-50%) scale(1)'; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Tekening (mobiel — pinch-to-zoom via ScrollView) ── */}
          {selectedPlan && Platform.OS !== 'web' && (
            <ScrollView
              style={{ marginTop: 10 }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center' }}
            >
              <Image
                source={{ uri: selectedPlan.fileUrl }}
                style={s.planImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}

          {/* ── Legenda ── */}
          <View style={s.legend}>
            {[
              { color: '#059669', label: 'Goedgekeurd' },
              { color: '#d97706', label: 'Review nodig' },
              { color: '#ef4444', label: 'Afgekeurd' },
              { color: '#6366f1', label: 'In behandeling' },
            ].map(item => (
              <View key={item.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={[s.legendText, { color: theme.colors.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
            <Text style={[s.legendText, { color: theme.colors.textSecondary }]}>
              {pinsForPlan.length} pin{pinsForPlan.length !== 1 ? 's' : ''} op deze tekening
            </Text>
          </View>

          {/* ── Acties ── */}
          {selectedPlan && (
            <TouchableOpacity style={[s.deleteBtn, { borderColor: '#ef4444' }]} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>🗑 Tekening verwijderen</Text>
            </TouchableOpacity>
          )}

          {/* ── Openstaande akkoord-aanvragen ── */}
          {changeRequests.length > 0 && (
            <View style={{ marginTop: 20, gap: 8 }}>
              <Text style={[s.sectionTitle, { color: theme.colors.textSecondary }]}>
                WIJZIGINGSVERZOEKEN ({changeRequests.length})
              </Text>
              {changeRequests.map(cr => {
                const badge = statusBadge(cr.status);
                const link = buildApprovalUrl(cr.approvalToken);
                return (
                  <View key={cr.id} style={[s.crCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={[s.crBadge, { backgroundColor: badge.bg }]}>
                        <Text style={{ color: badge.text, fontSize: 10, fontWeight: '800' }}>{badge.label}</Text>
                      </View>
                      <Text style={[s.crType, { color: theme.colors.textSecondary }]}>{cr.changeType}</Text>
                      <Text style={[s.crDate, { color: theme.colors.textSecondary }]}>
                        {new Date(cr.requestedAt).toLocaleDateString('nl-NL')}
                      </Text>
                    </View>
                    <Text style={[s.crDesc, { color: theme.colors.textPrimary }]}>{cr.changeDescription}</Text>
                    {cr.status === 'APPROVED' && cr.clientName && (
                      <Text style={[s.crMeta, { color: '#059669' }]}>
                        ✓ Akkoord van {cr.clientName} op {new Date(cr.approvedAt!).toLocaleString('nl-NL')}
                      </Text>
                    )}
                    {cr.status === 'REJECTED' && (
                      <Text style={[s.crMeta, { color: '#ef4444' }]}>✗ Afgewezen: {cr.rejectionReason}</Text>
                    )}
                    {cr.status === 'PENDING' && Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={[s.copyLinkBtn, { borderColor: 'rgba(99,102,241,0.3)' }]}
                        onPress={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(link).then(() => {
                              setCopiedLink(cr.id);
                              setTimeout(() => setCopiedLink(null), 2000);
                            }).catch(() => {});
                          }
                        }}
                      >
                        <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '700' }}>
                          {copiedLink === cr.id ? '✓ Link gekopieerd!' : '🔗 Goedkeuringslink kopiëren'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* ── Modal: Aanpassing aanvragen ── */}
      <Modal visible={showChangeModal} transparent animationType="slide" onRequestClose={() => setShowChangeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: theme.colors.surface }]}>
            <Text style={[s.modalTitle, { color: theme.colors.textPrimary }]}>✏️ Aanpassing aanvragen</Text>
            <Text style={[s.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Beschrijf de gewenste wijziging. De klant ontvangt een link om akkoord te geven.
            </Text>

            {/* Type */}
            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>Type wijziging</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {(['AANPASSING', 'NIEUWE_TEKENING', 'VERWIJDERING', 'PIN_WIJZIGING'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setChangeType(t)}
                  style={[s.typeChip, {
                    backgroundColor: changeType === t ? theme.colors.accent : theme.colors.background,
                    borderColor: changeType === t ? theme.colors.accent : theme.colors.border,
                  }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: changeType === t ? '#fff' : theme.colors.textSecondary }}>
                    {t === 'AANPASSING' ? 'Aanpassing' : t === 'NIEUWE_TEKENING' ? 'Nieuwe tekening' : t === 'VERWIJDERING' ? 'Verwijdering' : 'Pin wijziging'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Beschrijving */}
            <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>Beschrijving van de wijziging *</Text>
            <TextInput
              style={[s.textArea, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              value={changeDesc}
              onChangeText={setChangeDesc}
              placeholder="bijv. 'Aansluitpunt B7 verplaatst naar de linker gevel, zie bijgevoegde revisietekening...'"
              placeholderTextColor={theme.colors.textSecondary + '88'}
              multiline
              numberOfLines={4}
            />

            <View style={[s.legalBox, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }]}>
              <Text style={{ color: '#92400e', fontSize: 11, lineHeight: 17 }}>
                ⚖️ De klant ontvangt een unieke link. Na akkoord wordt naam, tijdstempel en bevestigingstekst vastgelegd in Supabase voor juridische dekking.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: theme.colors.accent, opacity: (!changeDesc.trim() || savingChange) ? 0.5 : 1 }]}
                onPress={handleCreateChange}
                disabled={!changeDesc.trim() || savingChange}
              >
                {savingChange
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalBtnText}>🔗 Link aanmaken & kopiëren</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border }]}
                onPress={() => setShowChangeModal(false)}
              >
                <Text style={[s.modalBtnText, { color: theme.colors.textSecondary }]}>Annuleren</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Bewijs detail ── */}
      {selectedEvidence && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedEvidence(null)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalBox, { backgroundColor: theme.colors.surface, maxWidth: 520 }]}>
              <Text style={[s.modalTitle, { color: theme.colors.textPrimary }]}>
                📍 {selectedEvidence.inspectionPointId}
              </Text>
              <Image source={{ uri: selectedEvidence.mediaUri }} style={s.modalImage} resizeMode="contain" />
              <View style={[s.statusBadge, { backgroundColor: pinColor(selectedEvidence.aiStatus) + '22', borderColor: pinColor(selectedEvidence.aiStatus) + '50', borderWidth: 1 }]}>
                <Text style={[s.statusText, { color: pinColor(selectedEvidence.aiStatus) }]}>
                  {selectedEvidence.aiStatus ?? 'PENDING'}
                </Text>
              </View>
              {selectedEvidence.fieldNote ? (
                <Text style={[s.modalNote, { color: theme.colors.textSecondary }]}>{selectedEvidence.fieldNote}</Text>
              ) : null}
              {selectedEvidence.aiNotes ? (
                <Text style={[s.modalNote, { color: theme.colors.textSecondary }]}>🤖 {selectedEvidence.aiNotes}</Text>
              ) : null}
              <Text style={[s.modalMeta, { color: theme.colors.textSecondary }]}>
                🕐 {new Date(selectedEvidence.timestamp).toLocaleString('nl-NL')}
              </Text>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: theme.colors.accent, marginTop: 8 }]}
                onPress={() => setSelectedEvidence(null)}
              >
                <Text style={s.modalBtnText}>Sluiten</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' as 'wrap' },
  title:   { fontSize: 18, fontWeight: '900' },

  pendingBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  btn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  tabRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 },
  tab:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  tabText: { fontSize: 12, fontWeight: '600' },

  zoomBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  zoomBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { fontSize: 16, fontWeight: '700' },
  zoomLevel: { fontSize: 12, fontWeight: '600', minWidth: 42, textAlign: 'center' },
  zoomHint: { fontSize: 11, marginLeft: 6, fontStyle: 'italic' },

  planImage: { width: '100%', height: 350, borderRadius: 10 },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },

  deleteBtn:     { marginHorizontal: 16, marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  deleteBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 12 },

  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 16 },
  crCard:   { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  crBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  crType:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  crDate:   { fontSize: 10, marginLeft: 'auto' as unknown as number },
  crDesc:   { fontSize: 13, lineHeight: 19 },
  crMeta:   { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  copyLinkBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },

  emptyBox:   { margin: 20, borderRadius: 14, borderWidth: 1.5, padding: 32, alignItems: 'center', borderStyle: 'dashed' },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  emptyBody:  { fontSize: 13, textAlign: 'center', lineHeight: 21 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBox:     { width: '100%', maxWidth: 480, borderRadius: 18, padding: 20, gap: 4 },
  modalTitle:   { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  modalSubtitle:{ fontSize: 13, lineHeight: 19, marginBottom: 14 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  typeChip:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  textArea:     { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
  legalBox:     { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 10 },
  modalBtn:     { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalImage:   { width: '100%', height: 220, borderRadius: 10, marginBottom: 10, backgroundColor: '#000' },
  statusBadge:  { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  statusText:   { fontWeight: '700', fontSize: 12 },
  modalNote:    { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  modalMeta:    { fontSize: 11, marginBottom: 8 },
});
