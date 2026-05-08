/**
 * QRStickerSheet — tabblad in WerkvoorbereiderDashboard voor het aanmaken
 * en afdrukken van QR-stickers per borgingspunt.
 *
 * Vakmensen plakken de stickers op de bouwplaats.
 * Scannen → PWA opent direct op het juiste borgingspunt.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Platform,
} from 'react-native';
import { wkbTaskTemplates } from '../data/WkbTemplates';
import { printQRStickerSheet, buildQRImageUrl, buildTaskUrl, type StickerTask } from '../services/QRStickerService';

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
  projectName: string;
  theme: Theme;
}

const CATEGORY_ICONS: Record<string, string> = {
  BOUW:            '🏗️',
  BOUWFYSICA:      '🌡️',
  BRANDVEILIGHEID: '🔥',
  INSTALLATIE:     '🔧',
  ELEKTRA:         '⚡',
  AFBOUW_SCHILDER: '🎨',
  STRUCTURAL:      '🏛️',
};

const DISCIPLINE_LABELS: Record<string, string> = {
  BOUW:            'Bouw',
  BOUWFYSICA:      'Bouwfysica',
  BRANDVEILIGHEID: 'Brandveiligheid',
  INSTALLATIE:     'Installatie',
  ELEKTRA:         'Elektra',
  AFBOUW_SCHILDER: 'Afbouw',
  STRUCTURAL:      'Constructie',
};

export default function QRStickerSheet({ projectId, projectName, theme }: Props) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(wkbTaskTemplates.map(t => t.categoryId as string));
    return Array.from(cats);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return wkbTaskTemplates.filter(t => {
      const matchCat = filterCategory ? t.categoryId === filterCategory : true;
      const matchQ = !q ||
        t.title.toLowerCase().includes(q) ||
        t.inspectionPointId.toLowerCase().includes(q) ||
        t.disciplineTitle.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [search, filterCategory]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map(t => t.inspectionPointId)));
  }, [filtered]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  const handlePrint = useCallback(() => {
    const tasks: StickerTask[] = wkbTaskTemplates
      .filter(t => selectedIds.has(t.inspectionPointId))
      .map(t => ({
        inspectionPointId: t.inspectionPointId,
        label: t.title,
        categoryIcon: CATEGORY_ICONS[t.categoryId as string] ?? '📋',
        discipline: DISCIPLINE_LABELS[t.categoryId as string] ?? t.categoryId,
      }));
    printQRStickerSheet({ projectId, projectName, tasks });
  }, [selectedIds, projectId, projectName]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wkb-snap-sync.vercel.app';

  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>🏷️ QR-sticker vel</Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
            Selecteer borgingspunten → afdrukken → plakken op de bouwplaats
          </Text>
        </View>
        {selectedIds.size > 0 && Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.printBtn, { backgroundColor: theme.colors.accent }]}
            onPress={handlePrint}
          >
            <Text style={styles.printBtnText}>🖨️ {selectedIds.size} sticker{selectedIds.size !== 1 ? 's' : ''} afdrukken</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search + filter */}
      <View style={styles.filterRow}>
        <TextInput
          style={[styles.searchInput, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.textPrimary,
          }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Zoek borgingspunt..."
          placeholderTextColor={theme.colors.textSecondary + '88'}
        />
        <TouchableOpacity
          style={[styles.selectAllBtn, { borderColor: theme.colors.border }]}
          onPress={selectedIds.size > 0 ? clearAll : selectAll}
        >
          <Text style={[styles.selectAllText, { color: theme.colors.textSecondary }]}>
            {selectedIds.size > 0 ? 'Wis alles' : 'Alles selecteren'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
        <TouchableOpacity
          onPress={() => setFilterCategory(null)}
          style={[styles.catPill, { borderColor: theme.colors.border },
            !filterCategory && { backgroundColor: theme.colors.accent }]}
        >
          <Text style={[styles.catPillText, { color: !filterCategory ? '#fff' : theme.colors.textSecondary }]}>
            Alle
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setFilterCategory(cat === filterCategory ? null : cat)}
            style={[styles.catPill, { borderColor: theme.colors.border },
              cat === filterCategory && { backgroundColor: theme.colors.accent }]}
          >
            <Text style={[styles.catPillText, { color: cat === filterCategory ? '#fff' : theme.colors.textSecondary }]}>
              {CATEGORY_ICONS[cat]} {DISCIPLINE_LABELS[cat] ?? cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count line */}
      <Text style={[styles.countLine, { color: theme.colors.textSecondary }]}>
        {filtered.length} borgingspunten · {selectedIds.size} geselecteerd
      </Text>

      {/* Task list */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(task => {
          const isSelected = selectedIds.has(task.inspectionPointId);
          const isPreview = previewId === task.inspectionPointId;
          const qrUrl = buildQRImageUrl(buildTaskUrl(baseUrl, projectId, task.inspectionPointId), 80);

          return (
            <TouchableOpacity
              key={task.inspectionPointId}
              onPress={() => toggleSelect(task.inspectionPointId)}
              activeOpacity={0.8}
              style={[
                styles.taskRow,
                {
                  backgroundColor: isSelected ? theme.colors.accent + '15' : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                },
              ]}
            >
              <View style={[styles.checkbox, {
                borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                backgroundColor: isSelected ? theme.colors.accent : 'transparent',
              }]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <View style={styles.taskIcon}>
                <Text style={styles.taskIconText}>
                  {CATEGORY_ICONS[task.categoryId as string] ?? '📋'}
                </Text>
              </View>

              <View style={styles.taskInfo}>
                <Text style={[styles.taskTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {task.title}
                </Text>
                <Text style={[styles.taskId, { color: theme.colors.textSecondary }]}>
                  {task.inspectionPointId} · {DISCIPLINE_LABELS[task.categoryId as string] ?? task.categoryId}
                </Text>
              </View>

              {/* Mini QR preview on hover/tap */}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setPreviewId(isPreview ? null : task.inspectionPointId);
                  }}
                  style={styles.previewBtn}
                >
                  <Text style={[styles.previewBtnText, { color: theme.colors.textSecondary }]}>
                    {isPreview ? '✕' : '🔍'}
                  </Text>
                </TouchableOpacity>
              )}

              {isPreview && Platform.OS === 'web' && (
                // @ts-ignore
                <img src={qrUrl} style={{ width: 80, height: 80, marginLeft: 8 }} alt="QR preview" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom action bar */}
      {selectedIds.size > 0 && Platform.OS === 'web' && (
        <View style={[styles.bottomBar, {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        }]}>
          <Text style={[styles.bottomText, { color: theme.colors.textSecondary }]}>
            {selectedIds.size} borgingspunt{selectedIds.size !== 1 ? 'en' : ''} geselecteerd
          </Text>
          <TouchableOpacity
            style={[styles.printBtn, { backgroundColor: theme.colors.accent }]}
            onPress={handlePrint}
          >
            <Text style={styles.printBtnText}>🖨️ Afdrukken als A4 vel</Text>
          </TouchableOpacity>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <View style={[styles.mobileNote, { borderColor: theme.colors.border }]}>
          <Text style={[styles.mobileNoteText, { color: theme.colors.textSecondary }]}>
            📱 QR-stickers afdrukken is beschikbaar op de desktop versie.
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sub:   { fontSize: 12 },
  printBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, flexShrink: 0,
  },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: {
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 13,
  },
  selectAllBtn: {
    height: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  selectAllText: { fontSize: 12, fontWeight: '600' },
  catRow: { marginBottom: 8 },
  catPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, marginRight: 6,
  },
  catPillText: { fontSize: 11, fontWeight: '600' },
  countLine: { fontSize: 11, marginBottom: 8 },
  list: { flex: 1 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10, padding: 10,
    marginBottom: 6,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  taskIcon: { marginRight: 10 },
  taskIconText: { fontSize: 20 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  taskId:    { fontSize: 10 },
  previewBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  previewBtnText: { fontSize: 16 },
  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderTopWidth: 1, marginTop: 8,
  },
  bottomText: { fontSize: 13 },
  mobileNote: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  mobileNoteText: { fontSize: 13, textAlign: 'center' },
});
