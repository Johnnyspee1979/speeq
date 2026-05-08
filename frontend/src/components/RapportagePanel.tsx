/**
 * RapportagePanel — UI voor het genereren van officiële WKB-rapporten
 *
 * Twee rapporttypen:
 *  1. 🏛️ Dossier Bevoegd Gezag  — formeel gereedmeldingsdossier voor gemeente
 *  2. 🔬 Kwaliteitsborger Rapport — technisch eindrapport intern gebruik
 *
 * Gebruik in WerkvoorbereiderDashboard:
 *   <RapportagePanel projectId={...} projectName={...} evidence={...} theme={theme} />
 */

import React, { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  generateGemeenteRapportHtml,
  printGemeenteRapport,
  downloadGemeenteRapport,
  type GemeenteEvidenceItem,
} from '../services/GemeenteRapportService';
import {
  generateKwaliteitsborgerRapportHtml,
  printKwaliteitsborgerRapport,
  downloadKwaliteitsborgerRapport,
  type KwbEvidenceItem,
} from '../services/KwaliteitsborgerRapportService';

// ─── Types ─────────────────────────────────────────────────────────────────

interface EvidenceRow {
  id: string;
  inspection_point_id: string | null;
  media_uri: string | null;
  photo_uri: string | null;
  timestamp: string | null;
  ai_status: string | null;
  ai_notes: string | null;
  field_note: string | null;
  user_id: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

interface Props {
  projectId: string;
  projectName: string;
  evidence: EvidenceRow[];
  theme: { colors: Record<string, string> };
}

type RapportType = 'gemeente' | 'kwaliteitsborger';

// ─── Component ──────────────────────────────────────────────────────────────

export default function RapportagePanel({ projectId, projectName, evidence, theme }: Props) {
  const c = theme.colors;

  const [rapportType, setRapportType] = useState<RapportType>('gemeente');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Gemeente velden
  const [projectAddress, setProjectAddress] = useState('');
  const [initiatorName, setInitiatorName] = useState('');
  const [vergunningNummer, setVergunningNummer] = useState('');
  const [kadastrale, setKadastrale] = useState('');
  const [bouwmeldingDatum, setBouwmeldingDatum] = useState('');
  const [gevolgklasse, setGevolgklasse] = useState('Gevolgklasse 1');
  const [kwaliteitsborger, setKwaliteitsborger] = useState('');
  const [kwaliteitsborgerOrg, setKwaliteitsborgerOrg] = useState('');
  const [uitvoerder, setUitvoerder] = useState('');

  const stats = React.useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const e of evidence) {
      const k = e.inspection_point_id ?? e.id;
      if (!seen.has(k) || (e.timestamp ?? '') > (seen.get(k) ?? '')) {
        seen.set(k, e.ai_status);
      }
    }
    const values = Array.from(seen.values());
    return {
      totaal: values.length,
      akkoord: values.filter(s => s === 'PASSED').length,
      afgekeurd: values.filter(s => s === 'FAILED').length,
      review: values.filter(s => s === 'NEEDS_REVIEW').length,
      pct: values.length > 0 ? Math.round((values.filter(s => s === 'PASSED').length / values.length) * 100) : 0,
    };
  }, [evidence]);

  const mapToGemeente = useCallback((): GemeenteEvidenceItem[] =>
    evidence.map(e => ({
      id: e.id,
      inspectionPointId: e.inspection_point_id,
      mediaUri: e.media_uri ?? e.photo_uri,
      timestamp: e.timestamp,
      aiStatus: e.ai_status,
      aiNotes: e.ai_notes,
      fieldNote: e.field_note,
      userId: e.user_id,
    })), [evidence]);

  const mapToKwb = useCallback((): KwbEvidenceItem[] =>
    evidence.map(e => ({
      id: e.id,
      inspectionPointId: e.inspection_point_id,
      mediaUri: e.media_uri ?? e.photo_uri,
      timestamp: e.timestamp,
      aiStatus: e.ai_status,
      aiNotes: e.ai_notes,
      fieldNote: e.field_note,
      userId: e.user_id,
      latitude: e.gps_lat,
      longitude: e.gps_lng,
    })), [evidence]);

  const handleGenerate = useCallback((action: 'print' | 'download') => {
    if (Platform.OS !== 'web') return;
    setGenerating(true);

    try {
      if (rapportType === 'gemeente') {
        const html = generateGemeenteRapportHtml({
          projectName,
          projectAddress: projectAddress || projectName,
          initiatorName: initiatorName || '—',
          vergunningNummer: vergunningNummer || undefined,
          kadastrale: kadastrale || undefined,
          gevolgklasse,
          bouwmeldingDatum: bouwmeldingDatum || undefined,
          projectId,
          evidence: mapToGemeente(),
          kwaliteitsborger: kwaliteitsborger || undefined,
          kwaliteitsborgerOrg: kwaliteitsborgerOrg || undefined,
          uitvoerder: uitvoerder || undefined,
        });
        if (action === 'print') printGemeenteRapport(html);
        else downloadGemeenteRapport(html, projectId);
      } else {
        const html = generateKwaliteitsborgerRapportHtml({
          projectName,
          projectAddress: projectAddress || projectName,
          initiatorName: initiatorName || undefined,
          vergunningNummer: vergunningNummer || undefined,
          kadastrale: kadastrale || undefined,
          gevolgklasse,
          projectId,
          evidence: mapToKwb(),
          kwaliteitsborger: kwaliteitsborger || undefined,
          kwaliteitsborgerOrg: kwaliteitsborgerOrg || undefined,
          uitvoerder: uitvoerder || undefined,
        });
        if (action === 'print') printKwaliteitsborgerRapport(html);
        else downloadKwaliteitsborgerRapport(html, projectId);
      }
      setGenerated(true);
      setTimeout(() => setGenerated(false), 4000);
    } finally {
      setGenerating(false);
    }
  }, [rapportType, projectName, projectAddress, initiatorName, vergunningNummer,
      kadastrale, gevolgklasse, bouwmeldingDatum, kwaliteitsborger, kwaliteitsborgerOrg,
      uitvoerder, projectId, mapToGemeente, mapToKwb]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[st.center, { backgroundColor: c.background }]}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🖥️</Text>
        <Text style={{ color: c.textSecondary, textAlign: 'center', fontSize: 14 }}>
          Rapportage is beschikbaar op desktop / web
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={st.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={st.pageHeader}>
        <Text style={[st.pageTitle, { color: c.textPrimary }]}>📑 Rapportage</Text>
        <Text style={[st.pageSubtitle, { color: c.textSecondary }]}>
          Officiële WKB-rapporten voor gemeente en kwaliteitsborger
        </Text>
      </View>

      {/* ── Stats strip ── */}
      <View style={[st.statsRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        {[
          { num: stats.totaal,    lbl: 'Borgingspunten', color: c.accent },
          { num: stats.akkoord,   lbl: 'Akkoord',        color: '#059669' },
          { num: stats.afgekeurd, lbl: 'Afgekeurd',      color: '#dc2626' },
          { num: stats.review,    lbl: 'Review',         color: '#d97706' },
          { num: `${stats.pct}%`, lbl: 'Compliance',     color: stats.pct >= 80 ? '#059669' : '#d97706' },
        ].map((s, i) => (
          <View key={i} style={st.statItem}>
            <Text style={[st.statNum, { color: s.color }]}>{s.num}</Text>
            <Text style={[st.statLbl, { color: c.textSecondary }]}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      {/* ── Rapport type selector ── */}
      <View style={[st.typeSelector, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[st.sectionLabel, { color: c.textSecondary }]}>RAPPORTTYPE</Text>
        <View style={st.typeRow}>
          {([
            { id: 'gemeente',        icon: '🏛️', title: 'Dossier Bevoegd Gezag', sub: 'Formele gereedmelding voor gemeente' },
            { id: 'kwaliteitsborger', icon: '🔬', title: 'Kwaliteitsborger Rapport', sub: 'Technisch eindrapport intern gebruik' },
          ] as const).map(opt => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setRapportType(opt.id)}
              activeOpacity={0.8}
              style={[
                st.typeCard,
                { borderColor: rapportType === opt.id ? c.accent : c.border,
                  backgroundColor: rapportType === opt.id ? c.accent + '0d' : c.background },
              ]}
            >
              <Text style={{ fontSize: 28, marginBottom: 6 }}>{opt.icon}</Text>
              <Text style={[st.typeTitle, { color: rapportType === opt.id ? c.accent : c.textPrimary }]}>
                {opt.title}
              </Text>
              <Text style={[st.typeSub, { color: c.textSecondary }]}>{opt.sub}</Text>
              {rapportType === opt.id && (
                <View style={[st.typeDot, { backgroundColor: c.accent }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Projectgegevens ── */}
      <View style={[st.formCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[st.sectionLabel, { color: c.textSecondary }]}>PROJECTGEGEVENS</Text>

        <View style={st.fieldRow}>
          <View style={[st.fieldWrap, { flex: 1 }]}>
            <Text style={[st.fieldLabel, { color: c.textSecondary }]}>Projectnaam</Text>
            <View style={[st.fieldReadonly, { borderColor: c.border, backgroundColor: c.background }]}>
              <Text style={{ color: c.textPrimary }}>{projectName}</Text>
            </View>
          </View>
          <View style={[st.fieldWrap, { flex: 1 }]}>
            <Text style={[st.fieldLabel, { color: c.textSecondary }]}>Gevolgklasse</Text>
            <TextInput
              style={[st.input, { borderColor: c.border, color: c.textPrimary, backgroundColor: c.background }]}
              value={gevolgklasse}
              onChangeText={setGevolgklasse}
              placeholder="Gevolgklasse 1"
              placeholderTextColor={c.textSecondary}
            />
          </View>
        </View>

        <Field label="Projectadres" value={projectAddress} onChange={setProjectAddress}
          placeholder="Straatnaam 1, 1234 AB Stad" colors={c} />
        <Field label="Initiatiefnemer / opdrachtgever" value={initiatorName} onChange={setInitiatorName}
          placeholder="Naam initiatiefnemer of eigenaar" colors={c} />

        <View style={st.fieldRow}>
          <Field label="Vergunningnummer" value={vergunningNummer} onChange={setVergunningNummer}
            placeholder="OV-2024-00123" colors={c} flex />
          <Field label="Kadastraal perceel" value={kadastrale} onChange={setKadastrale}
            placeholder="Gemeente A, sectie B, nr. 123" colors={c} flex />
        </View>

        {rapportType === 'gemeente' && (
          <Field label="Datum bouwmelding (optioneel)" value={bouwmeldingDatum} onChange={setBouwmeldingDatum}
            placeholder="2024-01-15" colors={c} />
        )}
      </View>

      {/* ── Betrokken personen ── */}
      <View style={[st.formCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[st.sectionLabel, { color: c.textSecondary }]}>BETROKKEN PERSONEN</Text>
        <View style={st.fieldRow}>
          <Field label="Kwaliteitsborger naam" value={kwaliteitsborger} onChange={setKwaliteitsborger}
            placeholder="Naam kwaliteitsborger" colors={c} flex />
          <Field label="Organisatie kwaliteitsborger" value={kwaliteitsborgerOrg} onChange={setKwaliteitsborgerOrg}
            placeholder="Bedrijfsnaam" colors={c} flex />
        </View>
        <Field label="Uitvoerder / Werkvoorbereider" value={uitvoerder} onChange={setUitvoerder}
          placeholder="Naam uitvoerder" colors={c} />
      </View>

      {/* ── Rapportinhoud preview ── */}
      <View style={[st.previewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[st.sectionLabel, { color: c.textSecondary }]}>RAPPORTINHOUD</Text>
        {(rapportType === 'gemeente'
          ? [
              '📄 Cover met projectgegevens en vergunningnummer',
              '📜 Gereedmelding verklaring (Wkb art. 2.17 / BKL art. 7.16)',
              `📊 Samenvatting borgingspunten (${stats.totaal} punten, ${stats.pct}% akkoord)`,
              `⚠️ Afwijkingenregister (${stats.afgekeurd + stats.review} items)`,
              '✍️ Verklaring kwaliteitsborger',
              '📎 Bijlagen checklist',
            ]
          : [
              '📄 Cover met projectgegevens',
              `📊 Technische samenvatting (${stats.totaal} borgingspunten)`,
              '🏗️ Overzicht per discipline (constructie, installaties, etc.)',
              '🛑 Stopmomenten status',
              `⚠️ Risicobeoordeling (${stats.afgekeurd + stats.review} risicoitems)`,
              `📷 Fotoverzicht alle borgingspunten (${stats.totaal} foto's)`,
              '📐 NEN-normen compliance tabel',
              '✍️ Handtekening kwaliteitsborger',
            ]
        ).map((line, i) => (
          <View key={i} style={st.previewLine}>
            <Text style={[st.previewText, { color: c.textPrimary }]}>{line}</Text>
          </View>
        ))}
      </View>

      {/* ── Acties ── */}
      {generated && (
        <View style={[st.successBanner, { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }]}>
          <Text style={{ color: '#065f46', fontWeight: '800' }}>
            ✓ Rapport gegenereerd — het venster is geopend
          </Text>
        </View>
      )}

      <View style={st.actionRow}>
        <TouchableOpacity
          onPress={() => handleGenerate('print')}
          disabled={generating}
          activeOpacity={0.85}
          style={[st.btnPrimary, { backgroundColor: c.accent, opacity: generating ? 0.6 : 1 }]}
        >
          <Text style={st.btnPrimaryText}>
            {generating ? '⏳ Genereren…' : '🖨️ Genereer & Afdrukken'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleGenerate('download')}
          disabled={generating}
          activeOpacity={0.85}
          style={[st.btnSecondary, { borderColor: c.border, backgroundColor: c.surface, opacity: generating ? 0.6 : 1 }]}
        >
          <Text style={[st.btnSecondaryText, { color: c.textPrimary }]}>
            📥 Download HTML
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Wettelijke referentie ── */}
      <View style={[st.legalNote, { borderColor: c.border }]}>
        <Text style={[st.legalText, { color: c.textSecondary }]}>
          {rapportType === 'gemeente'
            ? 'Gegenereerd conform Wet Kwaliteitsborging voor het bouwen (Stb. 2019, 382), Besluit kwaliteitsborging voor het bouwen (BKL) art. 7.16 en de technische eisen uit het Besluit bouwwerken leefomgeving (Bbl).'
            : 'Dit technisch rapport is vertrouwelijk en uitsluitend bestemd voor de kwaliteitsborger en direct betrokken partijen. Niet openbaar.'
          }
        </Text>
      </View>

    </ScrollView>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, colors, flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colors: Record<string, string>;
  flex?: boolean;
}) {
  return (
    <View style={[st.fieldWrap, flex ? { flex: 1 } : {}]}>
      <Text style={[st.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[st.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  pageSubtitle: { fontSize: 13 },

  statsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  typeSelector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  typeTitle: { fontSize: 13, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  typeSub: { fontSize: 11, textAlign: 'center' },
  typeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700' },
  fieldReadonly: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },

  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  previewLine: { flexDirection: 'row', alignItems: 'center' },
  previewText: { fontSize: 13 },

  successBanner: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnSecondaryText: { fontWeight: '800', fontSize: 14 },

  legalNote: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  legalText: { fontSize: 10.5, lineHeight: 16, fontStyle: 'italic' },
});
