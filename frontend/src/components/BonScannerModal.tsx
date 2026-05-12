/**
 * BonScannerModal — full-screen modal voor het scannen van een bon/leveringsbrief.
 *
 * Flow (mobiel + desktop):
 *   1. Open modal → camera-input verschijnt
 *   2. Foto gemaakt → preview + OCR-knop
 *   3. Tesseract leest de tekst (5–15s)
 *   4. Type-detector + veld-extractor toont resultaat
 *   5. Bevestigen → upload + opslaan in project_documents
 *   6. Optioneel: PDF openen
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import {
  runOcr,
  saveScannedDocument,
  openDocumentAsPrintablePdf,
  type DocType,
  type OcrResult,
  type ProjectDocument,
} from '../services/BonScannerService';
import { getProjects, type WkbProject } from '../services/ProjectService';

interface Theme {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
  name?: string;
}

interface Props {
  visible: boolean;
  /** Voor-ingevuld project. Leeg = picker tonen. */
  projectId?: string | null;
  theme: Theme;
  onClose: () => void;
  onSaved?: (doc: ProjectDocument) => void;
}

type Stage = 'select-project' | 'capture' | 'preview' | 'ocr' | 'result' | 'saving' | 'done';

const DOC_TYPE_OPTIONS: { value: DocType; label: string; emoji: string }[] = [
  { value: 'LEVERINGSBON', label: 'Leveringsbon', emoji: '📦' },
  { value: 'CERTIFICAAT', label: 'Certificaat', emoji: '🛡️' },
  { value: 'FACTUUR', label: 'Factuur', emoji: '💶' },
  { value: 'WERKBON', label: 'Werkbon', emoji: '🔧' },
  { value: 'BON', label: 'Bon', emoji: '🧾' },
  { value: 'OVERIG', label: 'Overig', emoji: '📄' },
];

export default function BonScannerModal({
  visible,
  projectId: presetProjectId,
  theme,
  onClose,
  onSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Initialer stage: als project meegegeven → direct capture, anders project kiezen
  const initialStage: Stage = presetProjectId ? 'capture' : 'select-project';
  const [stage, setStage] = useState<Stage>(initialStage);
  const [chosenProjectId, setChosenProjectId] = useState<string>(presetProjectId ?? '');
  const [chosenProjectName, setChosenProjectName] = useState<string>('');
  const [projects, setProjects] = useState<WkbProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [docType, setDocType] = useState<DocType>('BON');
  const [title, setTitle] = useState<string>('');
  const [savedDoc, setSavedDoc] = useState<ProjectDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Projecten laden zodra modal opent zonder voor-ingevuld project
  React.useEffect(() => {
    if (!visible) return;
    if (presetProjectId) {
      setChosenProjectId(presetProjectId);
      return;
    }
    setProjectsLoading(true);
    getProjects()
      .then((list) => {
        setProjects(list);
        setProjectsLoading(false);
      })
      .catch(() => setProjectsLoading(false));
  }, [visible, presetProjectId]);

  const reset = () => {
    if (photoUri) URL.revokeObjectURL(photoUri);
    setPhotoFile(null);
    setPhotoUri(null);
    setOcr(null);
    setDocType('BON');
    setTitle('');
    setSavedDoc(null);
    setError(null);
    setStage(presetProjectId ? 'capture' : 'select-project');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChosen = (file: File) => {
    setPhotoFile(file);
    setPhotoUri(URL.createObjectURL(file));
    setStage('preview');
  };

  const handleRunOcr = async () => {
    if (!photoFile) return;
    setStage('ocr');
    setError(null);
    try {
      const result = await runOcr(photoFile);
      setOcr(result);
      setDocType(result.docType);
      setTitle(result.detectedFields.leverancier ?? result.detectedFields.nummer ?? '');
      setStage('result');
    } catch (err) {
      console.error('OCR mislukt', err);
      setError('OCR mislukt. Je kunt nog steeds opslaan zonder tekst.');
      setOcr({ text: '', confidence: 0, docType: 'OVERIG', detectedFields: {} });
      setStage('result');
    }
  };

  const handleSave = async () => {
    if (!photoFile || !ocr) return;
    setStage('saving');
    try {
      const doc = await saveScannedDocument({
        projectId: chosenProjectId || 'ALGEMEEN',
        file: photoFile,
        title: title.trim() || null,
        ocr: { ...ocr, docType },
      });
      if (!doc) {
        setError('Opslaan in dossier faalde. Probeer opnieuw.');
        setStage('result');
        return;
      }
      setSavedDoc(doc);
      setStage('done');
      onSaved?.(doc);
    } catch (err) {
      console.error('Save bon faalde', err);
      setError('Opslaan mislukt: ' + String(err));
      setStage('result');
    }
  };

  if (!visible) return null;

  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: theme.colors.background },
      ]}
      pointerEvents="auto"
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>📄 Bon scannen</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.closeBtn, { color: theme.colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Project-banner (zichtbaar zodra project gekozen) */}
          {chosenProjectId && stage !== 'select-project' && (
            <View
              style={[
                styles.projectBanner,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.projectBannerLabel, { color: theme.colors.textSecondary }]}>
                📁 Project
              </Text>
              <View style={styles.projectBannerRow}>
                <Text
                  style={[styles.projectBannerName, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {chosenProjectName || chosenProjectId}
                </Text>
                {!presetProjectId && (
                  <TouchableOpacity
                    onPress={() => {
                      setChosenProjectId('');
                      setChosenProjectName('');
                      setStage('select-project');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.projectBannerChange, { color: theme.colors.accent }]}>
                      Wijzigen
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* STAGE: SELECT PROJECT */}
          {stage === 'select-project' && (
            <View style={styles.captureCard}>
              <Text style={[styles.captureHint, { color: theme.colors.textSecondary }]}>
                Aan welk project hoort deze bon? Kies hieronder of sla over voor algemene bonnen.
              </Text>

              {projectsLoading ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={[styles.loadingText, { color: theme.colors.textPrimary }]}>
                    Projecten laden…
                  </Text>
                </View>
              ) : (
                <>
                  {projects.length === 0 ? (
                    <Text style={[styles.captureHint, { color: theme.colors.textSecondary }]}>
                      Nog geen projecten gevonden. Je kunt de bon ook zonder project opslaan.
                    </Text>
                  ) : (
                    <View style={{ gap: 8, maxHeight: 360 }}>
                      <ScrollView style={{ maxHeight: 360 }}>
                        {projects.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.projectRow,
                              {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border,
                              },
                            ]}
                            onPress={() => {
                              setChosenProjectId(p.id);
                              setChosenProjectName(p.name);
                              setStage('capture');
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[styles.projectRowName, { color: theme.colors.textPrimary }]}
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                            {p.address ? (
                              <Text
                                style={[
                                  styles.projectRowAddress,
                                  { color: theme.colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {p.address}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: theme.colors.border, marginTop: 10 }]}
                    onPress={() => {
                      setChosenProjectId('ALGEMEEN');
                      setChosenProjectName('Algemene bonnen (geen project)');
                      setStage('capture');
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>
                      ⏭️ Zonder project opslaan (algemeen)
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* STAGE: CAPTURE */}
          {stage === 'capture' && Platform.OS === 'web' && (
            <View style={styles.captureCard}>
              <Text style={[styles.captureHint, { color: theme.colors.textSecondary }]}>
                Maak een foto van de bon, leveringsbrief, certificaat of factuur. De tekst wordt
                automatisch uitgelezen en in het dossier opgeslagen.
              </Text>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChosen(f);
                }}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.colors.accent }]}
                onPress={() => fileInputRef.current?.click()}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>📷 Foto maken</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                    fileInputRef.current.setAttribute('capture', 'environment');
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>
                  📁 Of kies uit galerij
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STAGE: PREVIEW */}
          {stage === 'preview' && photoUri && (
            <View>
              <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.colors.border, flex: 1 }]}
                  onPress={() => {
                    if (photoUri) URL.revokeObjectURL(photoUri);
                    setPhotoUri(null);
                    setPhotoFile(null);
                    setStage('capture');
                  }}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>↺ Opnieuw</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.colors.accent, flex: 2 }]}
                  onPress={handleRunOcr}
                >
                  <Text style={styles.primaryBtnText}>🔍 Tekst lezen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STAGE: OCR (loading) */}
          {stage === 'ocr' && (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textPrimary }]}>
                Tekst aan het uitlezen…
              </Text>
              <Text style={[styles.loadingHint, { color: theme.colors.textSecondary }]}>
                Duurt max 12 seconden. Lukt het niet? Sla gewoon op — de foto blijft de hoofdbron.
              </Text>
              <TouchableOpacity
                style={[styles.secondaryBtn, { marginTop: 16, borderColor: '#f97316' }]}
                onPress={() => {
                  setOcr({ text: '', confidence: 0, docType: 'OVERIG', detectedFields: {} });
                  setStage('result');
                }}
              >
                <Text style={[styles.secondaryBtnText, { color: '#f97316' }]}>
                  ⏭ Overslaan en zonder tekst opslaan
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STAGE: RESULT */}
          {stage === 'result' && ocr && (
            <View>
              {photoUri && (
                <Image source={{ uri: photoUri }} style={styles.previewSmall} resizeMode="contain" />
              )}
              {error && (
                <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                  <Text style={{ color: '#991b1b' }}>{error}</Text>
                </View>
              )}

              {/* OCR zekerheid waarschuwing */}
              {ocr && ocr.confidence > 0 && ocr.confidence < 0.55 && (
                <View style={[styles.errorBox, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                  <Text style={{ color: '#78350f', fontWeight: '700' }}>
                    ⚠️ OCR-zekerheid: {Math.round(ocr.confidence * 100)}%
                  </Text>
                  <Text style={{ color: '#78350f', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                    De tekst is moeilijk leesbaar (vaag/glans/handschrift). De foto blijft de hoofdbron.
                    Je kunt nog opnieuw scannen met betere belichting, of gewoon opslaan — de keurmeester ziet altijd de originele foto.
                  </Text>
                </View>
              )}
              {ocr && ocr.confidence >= 0.55 && ocr.confidence < 0.8 && (
                <View style={[styles.errorBox, { backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}>
                  <Text style={{ color: '#9a3412', fontSize: 13 }}>
                    ℹ️ OCR-zekerheid: {Math.round(ocr.confidence * 100)}% — controleer de gelezen tekst hieronder.
                  </Text>
                </View>
              )}

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>📂 Type</Text>
              <View style={styles.chipRow}>
                {DOC_TYPE_OPTIONS.map((opt) => {
                  const active = docType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.colors.accent : 'transparent',
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                        },
                      ]}
                      onPress={() => setDocType(opt.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? '#fff' : theme.colors.textPrimary },
                        ]}
                      >
                        {opt.emoji} {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>🏷️ Titel</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Bijv. 'Bouwmaat — beton 30L'"
                placeholderTextColor={theme.colors.textSecondary + '88'}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                  },
                ]}
              />

              {Object.keys(ocr.detectedFields).length > 0 && (
                <View style={[styles.fieldsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.fieldsTitle, { color: theme.colors.textSecondary }]}>
                    ✨ Automatisch herkend
                  </Text>
                  {Object.entries(ocr.detectedFields).map(([k, v]) => (
                    <Text key={k} style={[styles.fieldRow, { color: theme.colors.textPrimary }]}>
                      <Text style={{ fontWeight: '700' }}>{k}:</Text> {v}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                📝 OCR tekst (kun je nog aanpassen)
              </Text>
              <TextInput
                value={ocr.text}
                onChangeText={(t) => setOcr({ ...ocr, text: t })}
                multiline
                style={[
                  styles.ocrInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                  },
                ]}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.colors.border, flex: 1 }]}
                  onPress={reset}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>↺ Opnieuw</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.colors.accent, flex: 2 }]}
                  onPress={handleSave}
                >
                  <Text style={styles.primaryBtnText}>💾 In dossier opslaan</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STAGE: SAVING */}
          {stage === 'saving' && (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, { color: theme.colors.textPrimary }]}>
                Opslaan in dossier…
              </Text>
            </View>
          )}

          {/* STAGE: DONE */}
          {stage === 'done' && savedDoc && (
            <View>
              <View style={[styles.successCard, { backgroundColor: '#dcfce7', borderColor: '#22c55e' }]}>
                <Text style={[styles.successTitle, { color: '#15803d' }]}>
                  ✅ Opgeslagen in dossier
                </Text>
                <Text style={{ color: '#166534', marginTop: 4 }}>
                  Type: {savedDoc.docType}
                  {savedDoc.title ? ` · ${savedDoc.title}` : ''}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.colors.accent, marginTop: 14 }]}
                onPress={() => openDocumentAsPrintablePdf(savedDoc)}
              >
                <Text style={styles.primaryBtnText}>📄 PDF tonen / opslaan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: theme.colors.border, marginTop: 10 }]}
                onPress={reset}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>
                  ➕ Nog een bon scannen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: theme.colors.border, marginTop: 10 }]}
                onPress={handleClose}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>
                  ← Terug naar camera
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    // @ts-ignore — web-only
    ...(Platform.OS === 'web' ? { height: '100vh' as unknown as number } : null),
  },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: { fontSize: 24, fontWeight: '700' },
  body: { padding: 18, paddingBottom: 60 },
  captureCard: { gap: 14 },
  captureHint: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  preview: { width: '100%', height: 320, borderRadius: 12, marginBottom: 14 },
  previewSmall: { width: '100%', height: 180, borderRadius: 10, marginBottom: 14 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  loadingCard: { alignItems: 'center', padding: 40, gap: 14 },
  loadingText: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  loadingHint: { fontSize: 13, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  ocrInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  fieldsBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  fieldsTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  fieldRow: { fontSize: 14 },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  successCard: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 6 },
  successTitle: { fontSize: 16, fontWeight: '800' },
  projectBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  projectBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  projectBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  projectBannerName: { fontSize: 16, fontWeight: '700', flex: 1 },
  projectBannerChange: { fontSize: 14, fontWeight: '700' },
  projectRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  projectRowName: { fontSize: 15, fontWeight: '700' },
  projectRowAddress: { fontSize: 13, marginTop: 2 },
});
