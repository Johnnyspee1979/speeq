/**
 * ContextForm — locatie- en ruimtecontext bij een borgingspunt.
 *
 * Altijd zichtbaar:
 *   • Binnen / Buiten toggle
 *   • Etage picker
 *   • Ruimtenummer / omschrijving
 *
 * Discipline-specifiek (op basis van categoryId):
 *   INSTALLATIE   → sanitair checklist (toilet, douche, bad, wastafel...)
 *   BOUW          → constructie-element, materiaal
 *   BOUWFYSICA    → isolatietype, materiaal, dikte
 *   BRANDVEILIGHEID → doorvoertype, medium, maat
 *   ELEKTRA       → type elektra, spanning
 *   AFBOUW_SCHILDER → type afbouw, oppervlak
 */

import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextData {
  binnenbuiten: 'BINNEN' | 'BUITEN';
  etage: string;          // 'B2' | 'B1' | 'BG' | '1' | '2' | ... | 'DAK'
  huisnummer: string;
  ruimtenummer: string;   // vrij tekstveld, bijv. "2.14" of "Badkamer links"
  locatieDetail: string;  // bijv. "Gevel West", "Achtergevel", "Badkamer"
  extra: Record<string, unknown>; // discipline-specifiek
}

export const defaultContextData = (): ContextData => ({
  binnenbuiten: 'BINNEN',
  etage: 'BG',
  huisnummer: '',
  ruimtenummer: '',
  locatieDetail: '',
  extra: {},
});

interface ContextFormProps {
  value: ContextData;
  onChange: (updated: ContextData) => void;
  /** categoryId van het geselecteerde borgingspunt */
  categoryId?: string;
  /** Inspectionpuntomschrijving voor slimme defaults */
  taskTitle?: string;
}

// ─── Constanten ───────────────────────────────────────────────────────────────

const ETAGES = ['B2', 'B1', 'BG', '1', '2', '3', '4', '5', '6', '7+', 'DAK'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContextForm({
  value,
  onChange,
  categoryId = '',
  taskTitle = '',
}: ContextFormProps) {
  const { theme } = useTheme();
  const isDark = theme.name === 'dark';
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setField = useCallback(
    (key: keyof Omit<ContextData, 'extra'>, val: string) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange]
  );

  const setExtra = useCallback(
    (key: string, val: unknown) => {
      onChange({ ...value, extra: { ...value.extra, [key]: val } });
    },
    [value, onChange]
  );

  const toggleExtra = useCallback(
    (key: string) => {
      onChange({
        ...value,
        extra: { ...value.extra, [key]: !value.extra[key] },
      });
    },
    [value, onChange]
  );

  const setExtraCount = useCallback(
    (key: string, delta: number) => {
      const current = (value.extra[key] as number) ?? 0;
      const next = Math.max(0, current + delta);
      onChange({ ...value, extra: { ...value.extra, [key]: next } });
    },
    [value, onChange]
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>
        📍 LOCATIE & CONTEXT
      </Text>

      {/* ── Binnen / Buiten ── */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          WERKLOCATIE
        </Text>
        <View style={styles.toggleRow}>
          {(['BINNEN', 'BUITEN'] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.toggleBtn,
                value.binnenbuiten === opt && styles.toggleBtnActive,
                { borderColor: value.binnenbuiten === opt ? theme.colors.accent : theme.colors.border },
              ]}
              onPress={() => setField('binnenbuiten', opt)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  { color: value.binnenbuiten === opt ? theme.colors.accent : theme.colors.textSecondary },
                ]}
              >
                {opt === 'BINNEN' ? '🏠 Binnen' : '🌤️ Buiten'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Etage ── */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          VERDIEPING / ETAGE
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.etageRow}
        >
          {ETAGES.map((e) => (
            <TouchableOpacity
              key={e}
              style={[
                styles.etageBtn,
                value.etage === e && styles.etageBtnActive,
                {
                  borderColor: value.etage === e ? theme.colors.accent : theme.colors.border,
                  backgroundColor: value.etage === e
                    ? `${theme.colors.accent}18`
                    : theme.colors.surface,
                },
              ]}
              onPress={() => setField('etage', e)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.etageBtnText,
                  { color: value.etage === e ? theme.colors.accent : theme.colors.textSecondary },
                ]}
              >
                {e}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Ruimtenummer ── */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          RUIMTENUMMER / OMSCHRIJVING
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
          value={value.ruimtenummer}
          onChangeText={(t) => setField('ruimtenummer', t)}
          placeholder="bijv. 2.14 · Badkamer links · Unit 3B"
          placeholderTextColor={theme.colors.textSecondary + '88'}
        />
      </View>

      {/* ── Discipline-specifiek ── */}
      {(categoryId === 'INSTALLATIE') && (
        <SanitairSection
          extra={value.extra}
          onToggle={toggleExtra}
          onCount={setExtraCount}
          onSet={setExtra}
          theme={theme}
          isDark={isDark}
          styles={styles}
        />
      )}

      {(categoryId === 'BOUW' || categoryId === 'STRUCTURAL') && (
        <BouwSection
          extra={value.extra}
          onToggle={toggleExtra}
          onSet={setExtra}
          theme={theme}
          styles={styles}
        />
      )}

      {categoryId === 'BOUWFYSICA' && (
        <BouwfysicaSection
          extra={value.extra}
          onSet={setExtra}
          theme={theme}
          styles={styles}
        />
      )}

      {categoryId === 'BRANDVEILIGHEID' && (
        <BrandveiligheidSection
          extra={value.extra}
          onSet={setExtra}
          theme={theme}
          styles={styles}
        />
      )}

      {categoryId === 'ELEKTRA' && (
        <ElektraSection
          extra={value.extra}
          onSet={setExtra}
          theme={theme}
          styles={styles}
        />
      )}

      {categoryId === 'AFBOUW_SCHILDER' && (
        <AfbouwSection
          extra={value.extra}
          onSet={setExtra}
          theme={theme}
          styles={styles}
        />
      )}
    </View>
  );
}

// ─── Sub-section: Sanitair (INSTALLATIE) ─────────────────────────────────────

function SanitairSection({
  extra, onToggle, onCount, onSet, theme, isDark, styles,
}: {
  extra: Record<string, unknown>;
  onToggle: (key: string) => void;
  onCount: (key: string, delta: number) => void;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  isDark: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const items: { key: string; label: string; emoji: string }[] = [
    { key: 'toilet',       label: 'Toilet',                  emoji: '🚽' },
    { key: 'douche',       label: 'Douche / Douchebak',      emoji: '🚿' },
    { key: 'wastafel',     label: 'Wastafel / Fonteintje',   emoji: '🪣' },
    { key: 'bad',          label: 'Ligbad / Bad',            emoji: '🛁' },
    { key: 'urinoir',      label: 'Urinoir',                 emoji: '🚻' },
    { key: 'handgreep',    label: 'Handgreep / Steunbeugel', emoji: '🦯' },
    { key: 'nuldrempel',   label: 'Sta-in douche (nuldrempel)', emoji: '♿' },
    { key: 'thermostatisch', label: 'Thermostatische kraan',   emoji: '🌡️' },
    { key: 'ventilatie',   label: 'Mechanische ventilatie',  emoji: '💨' },
    { key: 'spiegel',      label: 'Spiegel aanwezig',        emoji: '🪞' },
  ];

  const countItems: { key: string; label: string }[] = [
    { key: 'aantalToiletten', label: 'Aantal toiletten' },
    { key: 'aantalDouches',   label: 'Aantal douches' },
    { key: 'aantalWastafels', label: 'Aantal wastafels' },
  ];

  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        🚿 SANITAIRE VOORZIENINGEN
      </Text>
      <Text style={[styles.disciplineHint, { color: theme.colors.textSecondary }]}>
        Vink aan wat aanwezig is in deze ruimte
      </Text>

      <View style={styles.checkGrid}>
        {items.map((item) => {
          const checked = !!extra[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.checkChip,
                {
                  borderColor: checked ? theme.colors.accent : theme.colors.border,
                  backgroundColor: checked ? `${theme.colors.accent}15` : theme.colors.surface,
                },
              ]}
              onPress={() => onToggle(item.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.checkEmoji}>{item.emoji}</Text>
              <Text style={[
                styles.checkLabel,
                { color: checked ? theme.colors.accent : theme.colors.textSecondary },
              ]}>
                {item.label}
              </Text>
              {checked && <Text style={[styles.checkMark, { color: theme.colors.accent }]}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Aantallen */}
      <View style={styles.countRow}>
        {countItems.map((ci) => {
          const val = (extra[ci.key] as number) ?? 0;
          return (
            <View key={ci.key} style={[styles.countCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.countLabel, { color: theme.colors.textSecondary }]}>
                {ci.label}
              </Text>
              <View style={styles.countControls}>
                <TouchableOpacity
                  style={[styles.countBtn, { borderColor: theme.colors.border }]}
                  onPress={() => onCount(ci.key, -1)}
                >
                  <Text style={[styles.countBtnText, { color: theme.colors.textSecondary }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.countValue, { color: theme.colors.textPrimary }]}>
                  {val}
                </Text>
                <TouchableOpacity
                  style={[styles.countBtn, { borderColor: theme.colors.border }]}
                  onPress={() => onCount(ci.key, 1)}
                >
                  <Text style={[styles.countBtnText, { color: theme.colors.accent }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Ruimtetype samenvatting */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>RUIMTETYPE</Text>
        <View style={styles.checkGrid}>
          {[
            { key: 'TOILET_ONLY',   label: 'Alleen toilet' },
            { key: 'DOUCHE_TOILET', label: 'Douche + toilet' },
            { key: 'VOLLEDIG',      label: 'Volledig sanitair' },
            { key: 'BAD_SUITE',     label: 'Badkamersuite (bad)' },
            { key: 'INVALIDE',      label: 'Aangepaste ruimte' },
          ].map((rt) => {
            const active = extra.ruimtetype === rt.key;
            return (
              <TouchableOpacity
                key={rt.key}
                style={[
                  styles.typeChip,
                  {
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    backgroundColor: active ? `${theme.colors.accent}15` : theme.colors.surface,
                  },
                ]}
                onPress={() => onSet('ruimtetype', rt.key)}
              >
                <Text style={[
                  styles.typeChipText,
                  { color: active ? theme.colors.accent : theme.colors.textSecondary },
                ]}>
                  {active ? '✓ ' : ''}{rt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Sub-section: Bouw (BOUW / STRUCTURAL) ───────────────────────────────────

function BouwSection({
  extra, onToggle, onSet, theme, styles,
}: {
  extra: Record<string, unknown>;
  onToggle: (key: string) => void;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        🏗️ CONSTRUCTIE-ELEMENT
      </Text>
      <OptionPicker
        label="TYPE ELEMENT"
        options={['Fundering', 'Buitenwand', 'Binnenwand', 'Vloer', 'Plafond', 'Dakconstructie', 'Kolom', 'Ligger', 'Balkon']}
        value={extra.elementType as string}
        onSelect={(v) => onSet('elementType', v)}
        theme={theme}
        styles={styles}
      />
      <OptionPicker
        label="MATERIAAL"
        options={['Beton', 'Gewapend beton', 'Staal', 'Hout', 'Metselwerk', 'Cellenbeton (Ytong)', 'Gemengd']}
        value={extra.materiaal as string}
        onSelect={(v) => onSet('materiaal', v)}
        theme={theme}
        styles={styles}
      />
      <CheckItems
        label="AANDACHTSPUNTEN"
        items={[
          { key: 'wapening_zichtbaar', label: '📐 Wapening zichtbaar' },
          { key: 'betondekking_ok',    label: '✅ Betondekking correct' },
          { key: 'stort_gereed',       label: '🏗️ Gereed voor stort' },
          { key: 'naad_zichtbaar',     label: '🔲 Dilatatienaad zichtbaar' },
        ]}
        extra={extra}
        onToggle={onToggle}
        theme={theme}
        styles={styles}
      />
    </View>
  );
}

// ─── Sub-section: Bouwfysica (BOUWFYSICA) ────────────────────────────────────

function BouwfysicaSection({
  extra, onSet, theme, styles,
}: {
  extra: Record<string, unknown>;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        🌡️ ISOLATIE & BOUWFYSICA
      </Text>
      <OptionPicker
        label="TYPE ISOLATIE"
        options={['Dakisolatie', 'Gevlisolatie', 'Vloerisolatie', 'Spouwisolatie', 'Bodemisolatie', 'Leidingwarmte-isolatie']}
        value={extra.isolatieType as string}
        onSelect={(v) => onSet('isolatieType', v)}
        theme={theme}
        styles={styles}
      />
      <OptionPicker
        label="ISOLATIEMATERIAAL"
        options={['EPS', 'XPS', 'PUR', 'PIR', 'Mineraalwol (Rockwool)', 'Glaswol', 'Cellulose', 'Spuitschuim']}
        value={extra.isolatieMat as string}
        onSelect={(v) => onSet('isolatieMat', v)}
        theme={theme}
        styles={styles}
      />
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          DIKTE (MM) · RC-WAARDE (M²K/W)
        </Text>
        <View style={styles.twoInputRow}>
          <TextInput
            style={[styles.inputSmall, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            value={String(extra.dikte ?? '')}
            onChangeText={(t) => onSet('dikte', t)}
            placeholder="bijv. 120"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.inputSmall, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            value={String(extra.rcWaarde ?? '')}
            onChangeText={(t) => onSet('rcWaarde', t)}
            placeholder="bijv. 3.5"
            placeholderTextColor={theme.colors.textSecondary + '88'}
            keyboardType="numeric"
          />
        </View>
      </View>
    </View>
  );
}

// ─── Sub-section: Brandveiligheid ────────────────────────────────────────────

function BrandveiligheidSection({
  extra, onSet, theme, styles,
}: {
  extra: Record<string, unknown>;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        🔥 BRANDVEILIGHEID
      </Text>
      <OptionPicker
        label="TYPE MAATREGEL"
        options={['Brandwerende doorvoer', 'Brandwerende afdichting', 'Brandmeldinstallatie', 'Sprinkler', 'Vluchtroutebord / Noodverlichting', 'Brandwerende deur', 'Rookmelding']}
        value={extra.brandType as string}
        onSelect={(v) => onSet('brandType', v)}
        theme={theme}
        styles={styles}
      />
      <OptionPicker
        label="DOORVOER MEDIUM"
        options={['Elektrische kabel', 'Waterleiding', 'Gasleiding', 'Klimaatkanaal (rond)', 'Klimaatkanaal (rechthoekig)', 'Datatracé', 'Gemengd']}
        value={extra.doorvoerMedium as string}
        onSelect={(v) => onSet('doorvoerMedium', v)}
        theme={theme}
        styles={styles}
      />
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          DOORVOERMAAT (MM)
        </Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          value={String(extra.doorvoerMaat ?? '')}
          onChangeText={(t) => onSet('doorvoerMaat', t)}
          placeholder="bijv. 110 of 200x100"
          placeholderTextColor={theme.colors.textSecondary + '88'}
        />
      </View>
    </View>
  );
}

// ─── Sub-section: Elektra ─────────────────────────────────────────────────────

function ElektraSection({
  extra, onSet, theme, styles,
}: {
  extra: Record<string, unknown>;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        ⚡ ELEKTRA
      </Text>
      <OptionPicker
        label="TYPE WERKZAAMHEDEN"
        options={['Aardingsinspectie', 'Groepenkast', 'Kabelgoot / Kabeltracé', 'Wandcontactdoos', 'Lichtpunt', 'Noodverlichting', 'EV-laadpunt', 'Zonnesysteem (PV)', 'Data / Telecom']}
        value={extra.elektraType as string}
        onSelect={(v) => onSet('elektraType', v)}
        theme={theme}
        styles={styles}
      />
      <OptionPicker
        label="SPANNING"
        options={['230V (enkelfasig)', '400V (driefasig)', '24V (extra laagspanning)', '12V DC', 'PoE (Power over Ethernet)']}
        value={extra.spanning as string}
        onSelect={(v) => onSet('spanning', v)}
        theme={theme}
        styles={styles}
      />
    </View>
  );
}

// ─── Sub-section: Afbouw ─────────────────────────────────────────────────────

function AfbouwSection({
  extra, onSet, theme, styles,
}: {
  extra: Record<string, unknown>;
  onSet: (key: string, val: unknown) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.disciplineSection}>
      <Text style={[styles.disciplineTitle, { color: theme.colors.textSecondary }]}>
        🖌️ AFBOUW & SCHILDER
      </Text>
      <OptionPicker
        label="TYPE AFBOUW"
        options={['Kitaansluiting', 'Tegelwerk (vloer)', 'Tegelwerk (wand)', 'Schilderwerk', 'Stucwerk / Pleister', 'PVC-vloer / Vinyl', 'Parket / Laminaat', 'Systeemplafond']}
        value={extra.afbouwType as string}
        onSelect={(v) => onSet('afbouwType', v)}
        theme={theme}
        styles={styles}
      />
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          OPPERVLAK (M²)
        </Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          value={String(extra.oppervlak ?? '')}
          onChangeText={(t) => onSet('oppervlak', t)}
          placeholder="bijv. 12.5"
          placeholderTextColor={theme.colors.textSecondary + '88'}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

// ─── Reusable sub-components ─────────────────────────────────────────────────

function OptionPicker({
  label, options, value, onSelect, theme, styles,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onSelect: (v: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionChip,
                {
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  backgroundColor: active ? `${theme.colors.accent}15` : theme.colors.surface,
                },
              ]}
              onPress={() => onSelect(opt)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.optionChipText,
                { color: active ? theme.colors.accent : theme.colors.textSecondary },
              ]}>
                {active ? '✓ ' : ''}{opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function CheckItems({
  label, items, extra, onToggle, theme, styles,
}: {
  label: string;
  items: { key: string; label: string }[];
  extra: Record<string, unknown>;
  onToggle: (key: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <View style={styles.optionGrid}>
        {items.map((item) => {
          const active = !!extra[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.optionChip,
                {
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  backgroundColor: active ? `${theme.colors.accent}15` : theme.colors.surface,
                },
              ]}
              onPress={() => onToggle(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.optionChipText,
                { color: active ? theme.colors.accent : theme.colors.textSecondary },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: ReturnType<typeof useTheme>['theme'], isDark: boolean) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      padding: 14,
      gap: 14,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
    },

    // Rows
    row: { gap: 8 },
    label: { fontSize: 9, fontWeight: '800', letterSpacing: 2 },

    // Binnen/Buiten toggle
    toggleRow: { flexDirection: 'row', gap: 8 },
    toggleBtn: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 9,
      alignItems: 'center',
    },
    toggleBtnActive: {},
    toggleBtnText: { fontSize: 13, fontWeight: '700' },

    // Etage
    etageRow: { gap: 6, paddingVertical: 2 },
    etageBtn: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 42,
      alignItems: 'center',
    },
    etageBtnActive: {},
    etageBtnText: { fontSize: 12, fontWeight: '800' },

    // Input
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    twoInputRow: { flexDirection: 'row', gap: 10 },
    inputSmall: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },

    // Discipline section
    disciplineSection: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 14,
      gap: 12,
    },
    disciplineTitle: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 2,
    },
    disciplineHint: {
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: -6,
    },

    // Check chips (sanitair)
    checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    checkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
    },
    checkEmoji: { fontSize: 14 },
    checkLabel: { fontSize: 12, fontWeight: '600' },
    checkMark: { fontSize: 11, fontWeight: '900' },

    // Count controls
    countRow: { flexDirection: 'row', gap: 8 },
    countCard: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      alignItems: 'center',
      gap: 6,
    },
    countLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
    countControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    countBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBtnText: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
    countValue: { fontSize: 18, fontWeight: '900', minWidth: 24, textAlign: 'center' },

    // Option/type chips
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    optionChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1,
    },
    optionChipText: { fontSize: 12, fontWeight: '600' },
    typeChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1,
    },
    typeChipText: { fontSize: 12, fontWeight: '600' },
  });
