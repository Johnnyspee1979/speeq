/**
 * TaskAssignmentPanel — WV wijst borgingspunten toe aan vakmansen.
 * Toont een lijst van alle toewijzingen voor het project.
 * Per borgingspunt: wie, prioriteit, deadline, status.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import {
  getTaskAssignments,
  createTaskAssignment,
  updateTaskAssignment,
  deleteTaskAssignment,
  type TaskAssignment,
  type TaskPriority,
  type TaskStatus,
} from '../services/TaskAssignmentService';
import { wkbTaskTemplates } from '../data/WkbTemplates';

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

interface TeamMemberOption {
  id: string;
  displayName: string;
  jobType: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  LAAG:   { label: 'Laag',   color: '#9ca3af', icon: '⬇️' },
  NORMAAL:{ label: 'Normaal',color: '#3b82f6', icon: '➡️' },
  HOOG:   { label: 'Hoog',   color: '#f59e0b', icon: '⬆️' },
  URGENT: { label: 'Urgent', color: '#ef4444', icon: '🚨' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  OPEN:        { label: 'Open',         color: '#9ca3af' },
  IN_PROGRESS: { label: 'In uitvoering',color: '#3b82f6' },
  DONE:        { label: 'Klaar',        color: '#059669' },
  BLOCKED:     { label: 'Geblokkeerd',  color: '#ef4444' },
};

export default function TaskAssignmentPanel({ projectId, theme }: Props) {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'alle'>('alle');

  // New assignment form state
  const [formPointId, setFormPointId] = useState('');
  const [formPointSearch, setFormPointSearch] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState<string>('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('NORMAAL');
  const [formDeadline, setFormDeadline] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [assignmentsData, teamData] = await Promise.all([
      getTaskAssignments(projectId),
      loadTeamMembers(),
    ]);
    setAssignments(assignmentsData);
    setTeamMembers(teamData);
    setLoading(false);
  }, [projectId]);

  const loadTeamMembers = async (): Promise<TeamMemberOption[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, job_type')
      .contains('project_ids', [projectId]);
    if (!data) return [];
    return data.map(row => ({
      id: row.id,
      displayName: row.display_name ?? 'Onbekend',
      jobType: row.job_type ?? 'VAKMAN',
    }));
  };

  const handleSaveAssignment = useCallback(async () => {
    if (!formPointId) return;
    setFormSaving(true);
    const result = await createTaskAssignment({
      projectId,
      inspectionPointId: formPointId,
      assignedTo: formAssignedTo || null,
      priority: formPriority,
      deadline: formDeadline || null,
      notes: formNotes || null,
    });
    setFormSaving(false);
    if (result) {
      setAssignments(prev => [result, ...prev]);
    } else {
      await loadData();
    }
    setShowAddModal(false);
    resetForm();
  }, [formPointId, formAssignedTo, formPriority, formDeadline, formNotes, projectId, loadData]);

  const resetForm = () => {
    setFormPointId(''); setFormPointSearch(''); setFormAssignedTo('');
    setFormPriority('NORMAAL'); setFormDeadline(''); setFormNotes('');
  };

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await updateTaskAssignment(id, { status });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    await deleteTaskAssignment(id);
  }, []);

  const filteredAssignments = filterStatus === 'alle'
    ? assignments
    : assignments.filter(a => a.status === filterStatus);

  const filteredPoints = wkbTaskTemplates.filter(t =>
    !formPointSearch ||
    t.title.toLowerCase().includes(formPointSearch.toLowerCase()) ||
    t.inspectionPointId.toLowerCase().includes(formPointSearch.toLowerCase())
  );

  const s = createStyles(theme);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: theme.colors.textPrimary }]}>📋 Taak Toewijzing</Text>
          <Text style={[s.sub, { color: theme.colors.textSecondary }]}>
            {assignments.length} taken · {assignments.filter(a => a.status !== 'DONE').length} nog open
          </Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.colors.accent }]}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={s.addBtnText}>+ Taak toewijzen</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {(['alle', 'OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const).map(st => (
          <TouchableOpacity
            key={st}
            onPress={() => setFilterStatus(st)}
            style={[s.filterPill, { borderColor: theme.colors.border },
              filterStatus === st && { backgroundColor: theme.colors.accent }]}
          >
            <Text style={[s.filterPillText,
              { color: filterStatus === st ? '#fff' : theme.colors.textSecondary }]}>
              {st === 'alle' ? 'Alle' : STATUS_CONFIG[st as TaskStatus]?.label ?? st}
              {st !== 'alle' && ` (${assignments.filter(a => a.status === st).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Assignment list */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {filteredAssignments.length === 0 ? (
          <View style={[s.emptyBox, { borderColor: theme.colors.border }]}>
            <Text style={[s.emptyText, { color: theme.colors.textSecondary }]}>
              Nog geen taken toegewezen.{'\n'}
              Klik "+ Taak toewijzen" om te starten.
            </Text>
          </View>
        ) : filteredAssignments.map(a => {
          const pri = PRIORITY_CONFIG[a.priority];
          const sta = STATUS_CONFIG[a.status];
          const task = wkbTaskTemplates.find(t => t.inspectionPointId === a.inspectionPointId);
          const member = teamMembers.find(m => m.id === a.assignedTo);

          return (
            <View key={a.id} style={[s.card, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            }]}>
              <View style={s.cardTop}>
                <View style={s.cardTitle}>
                  <View style={[s.priBadge, { backgroundColor: pri.color + '20' }]}>
                    <Text style={[s.priBadgeText, { color: pri.color }]}>
                      {pri.icon} {pri.label}
                    </Text>
                  </View>
                  <Text style={[s.cardPointId, { color: theme.colors.textSecondary }]}>
                    {a.inspectionPointId}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(a.id)} style={s.delBtn}>
                  <Text style={s.delBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={[s.cardName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {task?.title ?? a.inspectionPointId}
              </Text>

              <View style={s.cardMeta}>
                <Text style={[s.cardMetaItem, { color: theme.colors.textSecondary }]}>
                  👷 {member?.displayName ?? (a.assignedTo ? 'Toegewezen' : 'Niet toegewezen')}
                </Text>
                {a.deadline && (
                  <Text style={[s.cardMetaItem, { color: theme.colors.textSecondary }]}>
                    📅 {new Date(a.deadline).toLocaleDateString('nl-NL')}
                  </Text>
                )}
              </View>

              {a.notes ? (
                <Text style={[s.cardNotes, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {a.notes}
                </Text>
              ) : null}

              {/* Status buttons */}
              <View style={s.statusRow}>
                {(['OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as TaskStatus[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => handleStatusChange(a.id, st)}
                    style={[s.statusBtn, {
                      backgroundColor: a.status === st
                        ? STATUS_CONFIG[st].color
                        : theme.colors.surface,
                      borderColor: a.status === st
                        ? STATUS_CONFIG[st].color
                        : theme.colors.border,
                    }]}
                  >
                    <Text style={[s.statusBtnText, {
                      color: a.status === st ? '#fff' : theme.colors.textSecondary,
                    }]}>
                      {STATUS_CONFIG[st].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add task modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => { setShowAddModal(false); resetForm(); }}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: theme.colors.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.colors.textPrimary }]}>+ Taak toewijzen</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Text style={[{ color: theme.colors.textSecondary, fontSize: 20 }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Borgingspunt zoeken */}
              <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>BORGINGSPUNT *</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                value={formPointSearch}
                onChangeText={setFormPointSearch}
                placeholder="Zoek borgingspunt..."
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />
              {formPointSearch.length > 0 && !formPointId && (
                <ScrollView style={[s.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} nestedScrollEnabled>
                  {filteredPoints.slice(0, 8).map(t => (
                    <TouchableOpacity
                      key={t.inspectionPointId}
                      style={[s.dropdownItem, { borderBottomColor: theme.colors.border }]}
                      onPress={() => { setFormPointId(t.inspectionPointId); setFormPointSearch(t.title); }}
                    >
                      <Text style={[s.dropdownItemText, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={[s.dropdownItemSub, { color: theme.colors.textSecondary }]}>
                        {t.inspectionPointId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Vakman */}
              <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>TOEGEWEZEN AAN</Text>
              <View style={[s.pickerWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                {[{ id: '', displayName: '— Nog niet toegewezen —', jobType: '' }, ...teamMembers].map(m => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setFormAssignedTo(m.id)}
                    style={[s.pickerItem, {
                      backgroundColor: formAssignedTo === m.id ? theme.colors.accent + '15' : 'transparent',
                      borderColor: formAssignedTo === m.id ? theme.colors.accent : 'transparent',
                    }]}
                  >
                    <Text style={[s.pickerItemText, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {m.displayName}
                    </Text>
                    {m.jobType ? <Text style={[s.pickerItemSub, { color: theme.colors.textSecondary }]}>{m.jobType}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Prioriteit */}
              <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>PRIORITEIT</Text>
              <View style={s.priRow}>
                {(['LAAG', 'NORMAAL', 'HOOG', 'URGENT'] as TaskPriority[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setFormPriority(p)}
                    style={[s.priBtnSel, {
                      backgroundColor: formPriority === p ? PRIORITY_CONFIG[p].color : 'transparent',
                      borderColor: PRIORITY_CONFIG[p].color,
                    }]}
                  >
                    <Text style={[s.priBtnSelText, { color: formPriority === p ? '#fff' : PRIORITY_CONFIG[p].color }]}>
                      {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Deadline */}
              <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>DEADLINE (optioneel)</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                value={formDeadline}
                onChangeText={setFormDeadline}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textSecondary + '88'}
              />

              {/* Notities */}
              <Text style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>NOTITIES (optioneel)</Text>
              <TextInput
                style={[s.input, s.inputMulti, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Aanvullende instructies..."
                placeholderTextColor={theme.colors.textSecondary + '88'}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[s.saveBtn, {
                  backgroundColor: formPointId ? theme.colors.accent : '#ccc',
                }]}
                onPress={handleSaveAssignment}
                disabled={!formPointId || formSaving}
              >
                <Text style={s.saveBtnText}>{formSaving ? 'Opslaan...' : '✓ Toewijzing opslaan'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sub:   { fontSize: 12 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterRow: { marginBottom: 10 },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, marginRight: 6,
  },
  filterPillText: { fontSize: 11, fontWeight: '600' },
  list: { flex: 1 },
  card: {
    borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  priBadgeText: { fontSize: 10, fontWeight: '700' },
  cardPointId: { fontSize: 10, fontFamily: 'monospace' },
  delBtn: { padding: 4 },
  delBtnText: { color: '#ef4444', fontSize: 16 },
  cardName: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  cardMetaItem: { fontSize: 11 },
  cardNotes: { fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  statusBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusBtnText: { fontSize: 10, fontWeight: '600' },
  emptyBox: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
    padding: 32, alignItems: 'center', marginTop: 20,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 6, marginTop: 14,
  },
  input: {
    height: 42, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 13, marginBottom: 4,
  },
  inputMulti: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  dropdown: {
    maxHeight: 180, borderWidth: 1, borderRadius: 10,
    marginBottom: 8,
  },
  dropdownItem: {
    padding: 10, borderBottomWidth: 1,
  },
  dropdownItemText: { fontSize: 13, fontWeight: '600' },
  dropdownItemSub: { fontSize: 10 },
  pickerWrap: {
    borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 4, maxHeight: 160,
  },
  pickerItem: {
    padding: 10, borderWidth: 1.5, margin: 3, borderRadius: 8,
  },
  pickerItemText: { fontSize: 12, fontWeight: '600' },
  pickerItemSub: { fontSize: 10 },
  priRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  priBtnSel: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  priBtnSelText: { fontSize: 12, fontWeight: '700' },
  saveBtn: {
    height: 46, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', marginTop: 16, marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
