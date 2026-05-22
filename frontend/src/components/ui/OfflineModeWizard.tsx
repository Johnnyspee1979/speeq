/**
 * OfflineModeWizard — Week 8 van de Offline-Mode roadmap.
 *
 * Onboarding-wizard die de klant ziet wanneer de KEYUSER de offline-mode
 * toggle aanzet in TenantFeaturesScreen.
 *
 * Drie stappen:
 *   1. Wat krijgt u? (uitleg + voordeel)
 *   2. Wat heeft u nodig? (eenmalig ~40 MB download)
 *   3. Klaar — workspace gaat over op offline-mode
 *
 * Plus expliciete waarschuwing: sommige features (KiK-koppeling,
 * tenant-switch) blijven cloud-only.
 *
 * Volgt Warm Minimal design-tokens. Werkt op web + mobile (Modal).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

type Step = 0 | 1 | 2 | 3;

export const OfflineModeWizard: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);

  const reset = (): void => {
    setStep(0);
    setBusy(false);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleNext = async (): Promise<void> => {
    if (step === 2) {
      setBusy(true);
      try {
        await onConfirm();
        setStep(3);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step < 3) {
      setStep(((step as number) + 1) as Step);
    }
  };

  const stepCount = 3; // 0, 1, 2 — afsluit-step 3 is bevestiging

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(43,43,43,0.5)' }]}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
            },
          ]}
        >
          {/* Step-indicator */}
          <View style={styles.stepRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      i <= step
                        ? theme.colors.statusSuccess
                        : theme.colors.borderWarm,
                  },
                ]}
              />
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {step === 0 && (
              <>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.headline.fontFamily,
                      fontWeight: '700',
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  Werkt zonder netwerk.
                </Text>
                <Text style={[styles.lead, { color: theme.colors.textSecondary }]}>
                  Foto's, GPS en weer worden lokaal op uw toestel opgeslagen
                  zodra u offline-mode aanzet. Het synchroniseren met de cloud
                  gebeurt automatisch zodra het netwerk er weer is.
                </Text>
                <Text style={[styles.subhead, { color: theme.colors.textPrimary }]}>
                  Wat u krijgt:
                </Text>
                <Bullet color={theme.colors.statusSuccess} text="Foto-vastlegging werkt overal — ook in de kelder of in een metalen casco." />
                <Bullet color={theme.colors.statusSuccess} text="Lokale AI-precheck voor scherpheid — direct in plaats van 2-4 seconden wachten." />
                <Bullet color={theme.colors.statusSuccess} text="PDF-borgingsdossier genereren zonder backend." />
                <Bullet color={theme.colors.statusSuccess} text="Eigen branding en login tot 30 dagen offline." />
              </>
            )}

            {step === 1 && (
              <>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.headline.fontFamily,
                      fontWeight: '700',
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  Wat heeft u nodig?
                </Text>
                <Text style={[styles.lead, { color: theme.colors.textSecondary }]}>
                  Bij activatie wordt er eenmalig een klein pakket gedownload
                  zodat de app autonoom kan werken. Daarna is geen netwerk
                  meer nodig voor de basis-functies.
                </Text>
                <Bullet color={theme.colors.statusSuccess} text="Initial download ~40 MB (lokale AI-modellen + database-schema)." />
                <Bullet color={theme.colors.statusSuccess} text="Opslag op het toestel: tot 1 GB per project (foto-cache)." />
                <Bullet color={theme.colors.statusSuccess} text="Werkt op iOS, Android en web-browser." />
                <Text style={[styles.subhead, { color: theme.colors.textPrimary, marginTop: 16 }]}>
                  Wat blijft cloud-only:
                </Text>
                <Bullet color={theme.colors.statusWarning} text="KiK-koppeling (externe synchronisatie)." />
                <Bullet color={theme.colors.statusWarning} text="Team uitnodigen, tenant-instellingen." />
                <Bullet color={theme.colors.statusWarning} text="Geavanceerde AI-analyse (semantische check)." />
              </>
            )}

            {step === 2 && (
              <>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.headline.fontFamily,
                      fontWeight: '700',
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  Klaar om aan te zetten?
                </Text>
                <Text style={[styles.lead, { color: theme.colors.textSecondary }]}>
                  Na activatie schakelt deze workspace over op offline-mode.
                  U kunt op elk moment terug naar cloud-mode — uw data blijft
                  bewaard in beide gevallen.
                </Text>
                <View
                  style={[
                    styles.notice,
                    {
                      backgroundColor: theme.colors.surfaceAlt,
                      borderColor: theme.colors.borderWarm,
                    },
                  ]}
                >
                  <Text style={[styles.noticeTitle, { color: theme.colors.textPrimary }]}>
                    Belangrijk:
                  </Text>
                  <Text style={[styles.noticeText, { color: theme.colors.textSecondary }]}>
                    Bij eerste activatie kost het downloaden 1-2 minuten op
                    een goede WiFi-verbinding. Doe dit op kantoor, niet op
                    de bouwplaats.
                  </Text>
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.textPrimary,
                      fontFamily: theme.typography.headline.fontFamily,
                      fontWeight: '700',
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  ✓ Offline-mode actief
                </Text>
                <Text style={[styles.lead, { color: theme.colors.textSecondary }]}>
                  Klaar — uw workspace staat nu op offline-mode. Foto's en
                  bewijslast worden lokaal opgeslagen en synchroniseren
                  automatisch wanneer er netwerk is.
                </Text>
                <Text style={[styles.subhead, { color: theme.colors.textPrimary }]}>
                  Onderaan elk scherm ziet u nu een sync-status:
                </Text>
                <Bullet color={theme.colors.statusSuccess} text="✓ Gesynchroniseerd — alle wijzigingen staan in de cloud." />
                <Bullet color={theme.colors.statusSuccess} text="↻ Synchroniseren — bezig met uploaden." />
                <Bullet color={theme.colors.statusWarning} text="⚠ Wacht op netwerk — automatisch opnieuw proberen." />
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              { borderTopColor: theme.colors.borderWarm },
            ]}
          >
            {step === 3 ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Sluiten" onPress={handleClose} />
              </View>
            ) : (
              <>
                <SecondaryButton title="Annuleer" onPress={handleClose} />
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={
                      step === 2 ? 'Activeer offline-mode' : 'Volgende →'
                    }
                    onPress={() => void handleNext()}
                    loading={busy}
                    disabled={busy}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Sub-component ──────────────────────────────────────────────────────────

const Bullet: React.FC<{ color: string; text: string }> = ({ color, text }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: color }]} />
      <Text style={[styles.bulletText, { color: theme.colors.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 20,
    paddingBottom: 0,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  body: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    marginBottom: 12,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
