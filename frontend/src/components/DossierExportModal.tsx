/**
 * DossierExportModal — Sprint 4
 *
 * Laat de gebruiker kiezen tussen 3 export-formats voor het WKB rapport:
 *  - INTERNAL     : alles inclusief afgekeurd
 *  - MUNICIPALITY : alles + volledige metadata (gemeente / bevoegd gezag)
 *  - AUDITOR      : alléén PASSED (kwaliteitsborger oplevering)
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { StoredWkbEvidence } from '../types/Evidence';
import {
  exportWkbReportAsPdf,
  filterEvidenceForExport,
  type DossierMeta,
  type DossierSignatures,
  type FloorPlanAnnotation,
  type WkbExportFormat,
} from '../services/BorgingsDossierService';
import { useTranslation } from '../i18n';

export interface DossierExportModalProps {
  visible: boolean;
  onClose: () => void;
  evidence: StoredWkbEvidence[];
  projectId: string;
  projectName: string;
  meta?: DossierMeta;
  signatures?: DossierSignatures;
  floorPlanAnnotations?: FloorPlanAnnotation[];
}

interface FormatOption {
  id: WkbExportFormat;
  titleKey: string;
  descKey: string;
  icon: string;
  accent: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'INTERNAL',     titleKey: 'export.type_internal',     descKey: 'export.desc_internal',     icon: '📋', accent: '#6b7280' },
  { id: 'MUNICIPALITY', titleKey: 'export.type_municipality', descKey: 'export.desc_municipality', icon: '🏛️', accent: '#111827' },
  { id: 'AUDITOR',      titleKey: 'export.type_auditor',      descKey: 'export.desc_auditor',      icon: '✅', accent: '#059669' },
];

export default function DossierExportModal({
  visible,
  onClose,
  evidence,
  projectId,
  projectName,
  meta = {},
  signatures = {},
  floorPlanAnnotations = [],
}: DossierExportModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<WkbExportFormat>('MUNICIPALITY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCount = useMemo(
    () => filterEvidenceForExport(evidence, selected).length,
    [evidence, selected]
  );

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportWkbReportAsPdf(
        evidence,
        projectId,
        projectName,
        selected,
        meta,
        signatures,
        floorPlanAnnotations
      );
      // Sluit pas na een korte tick zodat de print-window kan openen
      setTimeout(() => {
        setBusy(false);
        onClose();
      }, 300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('export.title')}</Text>
            <Text style={styles.subtitle}>{t('export.subtitle')}</Text>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16 }}>
            {FORMAT_OPTIONS.map((opt) => {
              const isActive = selected === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelected(opt.id)}
                  style={[
                    styles.option,
                    isActive && { borderColor: opt.accent, backgroundColor: `${opt.accent}10` },
                  ]}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, isActive && { color: opt.accent }]}>
                        {t(opt.titleKey)}
                      </Text>
                      <Text style={styles.optionDesc}>{t(opt.descKey)}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        isActive && { borderColor: opt.accent, backgroundColor: opt.accent },
                      ]}
                    >
                      {isActive && <Text style={styles.radioDot}>✓</Text>}
                    </View>
                  </View>

                  {isActive && (
                    <View style={styles.optionExtras}>
                      {opt.id === 'MUNICIPALITY' && (
                        <Text style={styles.extraLine}>• {t('export.include_metadata')}</Text>
                      )}
                      {opt.id === 'AUDITOR' && (
                        <Text style={styles.extraLine}>• {t('export.only_passed')}</Text>
                      )}
                      <Text style={styles.countLine}>
                        {t('export.count_label')}: <Text style={{ fontWeight: '900' }}>{filteredCount}</Text>
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.btnSecondary} onPress={onClose} disabled={busy}>
              <Text style={styles.btnSecondaryText}>{t('export.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, busy && { opacity: 0.6 }]}
              onPress={handleExport}
              disabled={busy || filteredCount === 0}
            >
              {busy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.btnPrimaryText}>{t('export.generating')}</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>📄 {t('export.button')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#111' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },

  option: {
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionIcon: { fontSize: 22 },
  optionTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  optionDesc: { fontSize: 11.5, color: '#666', marginTop: 2, lineHeight: 16 },
  optionExtras: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  extraLine: { fontSize: 11, color: '#444', marginBottom: 4 },
  countLine: { fontSize: 12, color: '#111', marginTop: 4 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { color: '#fff', fontSize: 12, fontWeight: '900' },

  errorBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: '#991b1b', fontSize: 12, fontWeight: '600' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  btnSecondaryText: { color: '#444', fontWeight: '700', fontSize: 13 },
  btnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111827',
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
