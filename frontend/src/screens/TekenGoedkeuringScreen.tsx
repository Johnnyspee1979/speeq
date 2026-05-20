/**
 * TekenGoedkeuringScreen — publieke goedkeuringspagina voor bouwtekening-wijzigingen.
 *
 * Wordt geladen via /?approve=<token>  (geen login vereist).
 * Klant ziet de wijziging, voert naam + e-mail in en geeft akkoord of wijst af.
 * Na bevestiging wordt de juridische verklaring getoond.
 *
 * Warm Minimal: alle kleuren/fonts via designTokens; PrimaryButton voor akkoord,
 * SecondaryButton voor afwijzen + terug, StatusPill voor het wijzigings-type.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import {
  getChangeRequestByToken,
  approveChangeRequest,
  rejectChangeRequest,
  type DrawingChangeRequest,
} from '../services/DrawingChangeRequestService';
import { supabase } from '../lib/supabase';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { useTheme } from '../theme/ThemeProvider';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SecondaryButton } from '../components/ui/SecondaryButton';
import { StatusPill } from '../components/ui/StatusPill';

interface Props {
  token: string;
}

type Screen = 'loading' | 'notFound' | 'alreadyHandled' | 'form' | 'rejecting' | 'done';

export default function TekenGoedkeuringScreen({ token }: Props) {
  const { theme } = useTheme();
  const tenantBranding = useTenantBranding();
  const [screen, setScreen] = useState<Screen>('loading');
  const [request, setRequest] = useState<DrawingChangeRequest | null>(null);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [legalText, setLegalText] = useState('');

  useEffect(() => {
    (async () => {
      const req = await getChangeRequestByToken(token);
      if (!req) { setScreen('notFound'); return; }
      setRequest(req);

      if (req.status !== 'PENDING') { setScreen('alreadyHandled'); return; }

      if (req.floorPlanId) {
        const { data } = await supabase
          .from('floor_plans')
          .select('file_url')
          .eq('id', req.floorPlanId)
          .single();
        if (data?.file_url) setFloorPlanUrl(data.file_url as string);
      }

      setScreen('form');
    })();
  }, [token]);

  const handleApprove = async () => {
    if (!clientName.trim() || !clientEmail.trim()) {
      alert('Vul je naam en e-mailadres in.');
      return;
    }
    setBusy(true);
    const ok = await approveChangeRequest(token, clientName, clientEmail);
    setBusy(false);
    if (ok) {
      const legal = `Ik, ${clientName}, ga hierbij akkoord met de beschreven wijziging. Vastgelegd op ${new Date().toLocaleString('nl-NL')}.`;
      setLegalText(legal);
      setDoneMessage('✓ Akkoord gegeven');
      setScreen('done');
    } else {
      alert('Er is iets misgegaan. Probeer het opnieuw.');
    }
  };

  const handleReject = async () => {
    if (!clientName.trim() || !rejectReason.trim()) {
      alert('Vul je naam en reden van afwijzing in.');
      return;
    }
    setBusy(true);
    const ok = await rejectChangeRequest(token, clientName, rejectReason);
    setBusy(false);
    if (ok) {
      setDoneMessage('✗ Wijziging afgewezen');
      setScreen('done');
    } else {
      alert('Er is iets misgegaan. Probeer het opnieuw.');
    }
  };

  /* ─── Schermen ─── */

  const containerStyle = [st.container, { backgroundColor: theme.colors.background }];
  const centerStyle = [st.center, { backgroundColor: theme.colors.background }];

  if (screen === 'loading') {
    return (
      <View style={centerStyle}>
        <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        <Text
          style={[
            st.loadingText,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          Wijzigingsverzoek laden…
        </Text>
      </View>
    );
  }

  if (screen === 'notFound') {
    return (
      <View style={centerStyle}>
        <Text style={st.emoji}>🔍</Text>
        <Text
          style={[
            st.title,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline.fontFamily,
              fontWeight: theme.typography.headline.fontWeight,
              fontStyle: theme.typography.headline.fontStyle,
            },
          ]}
        >
          Link niet gevonden
        </Text>
        <Text
          style={[
            st.sub,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          Deze goedkeuringslink is ongeldig of verlopen.
        </Text>
      </View>
    );
  }

  if (screen === 'alreadyHandled' && request) {
    const handled = request.status === 'APPROVED';
    return (
      <View style={centerStyle}>
        <Text style={st.emoji}>{handled ? '✓' : '✗'}</Text>
        <Text
          style={[
            st.title,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline.fontFamily,
              fontWeight: theme.typography.headline.fontWeight,
              fontStyle: theme.typography.headline.fontStyle,
            },
          ]}
        >
          {handled ? 'Al goedgekeurd' : 'Al afgewezen'}
        </Text>
        <Text
          style={[
            st.sub,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          {handled
            ? `Goedgekeurd door ${request.clientName ?? '—'} op ${request.approvedAt ? new Date(request.approvedAt).toLocaleString('nl-NL') : '—'}.`
            : `Afgewezen door ${request.clientName ?? '—'}. Reden: ${request.rejectionReason ?? '—'}`}
        </Text>
        {request.legalStatement ? (
          <View
            style={[
              st.legalBox,
              { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderWarm },
            ]}
          >
            <Text style={[st.legalText, { color: theme.colors.textPrimary }]}>
              {request.legalStatement}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (screen === 'done') {
    return (
      <View style={centerStyle}>
        <Text style={st.emoji}>{doneMessage.startsWith('✓') ? '✓' : '✗'}</Text>
        <Text
          style={[
            st.title,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline.fontFamily,
              fontWeight: theme.typography.headline.fontWeight,
              fontStyle: theme.typography.headline.fontStyle,
            },
          ]}
        >
          {doneMessage}
        </Text>
        {legalText ? (
          <View
            style={[
              st.legalBox,
              { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderWarm },
            ]}
          >
            <Text
              style={[
                st.legalLabel,
                { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
              ]}
            >
              JURIDISCHE BEVESTIGING (OPGESLAGEN)
            </Text>
            <Text style={[st.legalText, { color: theme.colors.textPrimary }]}>{legalText}</Text>
          </View>
        ) : null}
        <Text
          style={[
            st.sub,
            {
              color: theme.colors.textSecondary,
              fontFamily: theme.typography.bodyData.fontFamily,
              marginTop: 24,
            },
          ]}
        >
          Je kunt dit venster sluiten.
        </Text>
      </View>
    );
  }

  if (screen === 'rejecting' && request) {
    return (
      <ScrollView contentContainerStyle={containerStyle}>
        <Text
          style={[
            st.headerTitle,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline.fontFamily,
              fontWeight: theme.typography.headline.fontWeight,
              fontStyle: theme.typography.headline.fontStyle,
            },
          ]}
        >
          Wijziging afwijzen
        </Text>
        <Text
          style={[
            st.label,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          JOUW NAAM *
        </Text>
        <TextInput
          style={[
            st.input,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
              color: theme.colors.textPrimary,
            },
          ]}
          placeholder="Volledige naam"
          placeholderTextColor={theme.colors.textMuted}
          value={clientName}
          onChangeText={setClientName}
        />
        <Text
          style={[
            st.label,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          REDEN VAN AFWIJZING *
        </Text>
        <TextInput
          style={[
            st.input,
            st.textarea,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
              color: theme.colors.textPrimary,
            },
          ]}
          placeholder="Geef een korte toelichting…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          value={rejectReason}
          onChangeText={setRejectReason}
        />
        <View style={st.row}>
          <SecondaryButton
            title="← Terug"
            onPress={() => setScreen('form')}
          />
          <TouchableOpacity
            style={[
              st.dangerBtn,
              {
                backgroundColor: theme.colors.statusWarning,
                borderColor: theme.colors.borderWarm,
                opacity: busy ? 0.5 : 1,
              },
            ]}
            onPress={handleReject}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <Text style={[st.dangerBtnText, { color: theme.colors.textPrimary }]}>
                Afwijzen bevestigen
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // screen === 'form'
  if (!request) return null;

  const changeTypeLabel: Record<string, string> = {
    AANPASSING: 'Aanpassing',
    NIEUWE_TEKENING: 'Nieuwe tekening',
    VERWIJDERING: 'Verwijdering',
    PIN_WIJZIGING: 'Pin-wijziging',
  };

  return (
    <ScrollView contentContainerStyle={containerStyle}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: theme.colors.borderWarm }]}>
        <Text
          style={[
            st.eyebrow,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          WIJZIGINGSVERZOEK
        </Text>
        <Text
          style={[
            st.headerTitle,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.headline.fontFamily,
              fontWeight: theme.typography.headline.fontWeight,
              fontStyle: theme.typography.headline.fontStyle,
            },
          ]}
        >
          Goedkeuring bouwtekening
        </Text>
        <Text
          style={[
            st.headerSub,
            { color: theme.colors.textSecondary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          Lees de wijziging zorgvuldig door en geef je akkoord of wijs af.
        </Text>
      </View>

      {/* Wijzigingsdetails */}
      <View
        style={[
          st.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm },
        ]}
      >
        <View style={st.chipRow}>
          <StatusPill
            status="neutral"
            label={changeTypeLabel[request.changeType] ?? request.changeType}
          />
        </View>
        <Text
          style={[
            st.cardLabel,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          OMSCHRIJVING
        </Text>
        <Text
          style={[
            st.cardValue,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          {request.changeDescription}
        </Text>

        <Text
          style={[
            st.cardLabel,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          AANGEVRAAGD DOOR
        </Text>
        <Text
          style={[
            st.cardValue,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          {request.requesterName ?? '—'}
        </Text>

        <Text
          style={[
            st.cardLabel,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          DATUM AANVRAAG
        </Text>
        <Text
          style={[
            st.cardValue,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          {new Date(request.requestedAt).toLocaleString('nl-NL')}
        </Text>
      </View>

      {/* Tekening preview */}
      {floorPlanUrl ? (
        <View
          style={[
            st.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm },
          ]}
        >
          <Text
            style={[
              st.cardLabel,
              { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
            ]}
          >
            BETROKKEN BOUWTEKENING
          </Text>
          <Image
            source={{ uri: floorPlanUrl }}
            style={[st.floorPlanImg, { backgroundColor: theme.colors.backgroundAlt }]}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {/* Formulier */}
      <View
        style={[
          st.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderWarm },
        ]}
      >
        <Text
          style={[
            st.sectionTitle,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.sectionTitle.fontFamily,
              fontWeight: theme.typography.sectionTitle.fontWeight,
            },
          ]}
        >
          Jouw gegevens
        </Text>

        <Text
          style={[
            st.label,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          VOLLEDIGE NAAM *
        </Text>
        <TextInput
          style={[
            st.input,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
              color: theme.colors.textPrimary,
            },
          ]}
          placeholder="Jan de Vries"
          placeholderTextColor={theme.colors.textMuted}
          value={clientName}
          onChangeText={setClientName}
          autoCapitalize="words"
        />

        <Text
          style={[
            st.label,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          E-MAILADRES *
        </Text>
        <TextInput
          style={[
            st.input,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.borderWarm,
              color: theme.colors.textPrimary,
            },
          ]}
          placeholder="jan@voorbeeld.nl"
          placeholderTextColor={theme.colors.textMuted}
          value={clientEmail}
          onChangeText={setClientEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Juridische mededeling — surfaceAlt + borderWarm voor rustige nadruk */}
      <View
        style={[
          st.legalBox,
          { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderWarm },
        ]}
      >
        <Text
          style={[
            st.legalLabel,
            { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
          ]}
        >
          ⚖ JURIDISCHE MEDEDELING
        </Text>
        <Text
          style={[
            st.legalText,
            { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyData.fontFamily },
          ]}
        >
          Door akkoord te gaan bevestigt u dat u de bovenstaande wijziging heeft gelezen
          en goedkeurt. Uw naam, e-mailadres en het tijdstip van goedkeuring worden
          vastgelegd als juridisch bewijs van uw toestemming.
        </Text>
      </View>

      {/* Actie-knoppen: Akkoord = Primary, Afwijzen = Secondary */}
      <View style={st.row}>
        <SecondaryButton title="✗ Afwijzen" onPress={() => setScreen('rejecting')} />
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="✓ Ik ga akkoord"
            onPress={handleApprove}
            loading={busy}
            disabled={busy}
          />
        </View>
      </View>

      <Text
        style={[
          st.footer,
          { color: theme.colors.textMuted, fontFamily: theme.typography.caption.fontFamily },
        ]}
      >
        {tenantBranding.companyName ? `${tenantBranding.companyName} • ` : ''}Veilig en versleuteld
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    padding: 20,
    paddingBottom: 60,
    maxWidth: 640,
    // @ts-ignore web only
    marginHorizontal: 'auto',
    width: '100%',
  },
  loadingText: { marginTop: 16, fontSize: 15 },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 28, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  header: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  headerTitle: { fontSize: 28, marginBottom: 6 },
  headerSub: { fontSize: 14, lineHeight: 20 },

  card: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', marginBottom: 12 },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 2,
  },
  cardValue: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, marginBottom: 12 },

  floorPlanImg: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    marginTop: 8,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },

  legalBox: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  legalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  legalText: { fontSize: 13, lineHeight: 19 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'center' },

  dangerBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dangerBtnText: { fontWeight: '700', fontSize: 15 },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
});
