/**
 * TekenGoedkeuringScreen — publieke goedkeuringspagina voor bouwtekening-wijzigingen.
 *
 * Wordt geladen via /?approve=<token>  (geen login vereist).
 * Klant ziet de wijziging, voert naam + e-mail in en geeft akkoord of wijst af.
 * Na bevestiging wordt de juridische verklaring getoond.
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

interface Props {
  token: string;
}

type Screen = 'loading' | 'notFound' | 'alreadyHandled' | 'form' | 'rejecting' | 'done';

export default function TekenGoedkeuringScreen({ token }: Props) {
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

      // Laad tekening-URL als er een floor_plan_id is
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
      setDoneMessage('✅ Akkoord gegeven');
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
      setDoneMessage('❌ Wijziging afgewezen');
      setScreen('done');
    } else {
      alert('Er is iets misgegaan. Probeer het opnieuw.');
    }
  };

  /* ─── Schermen ─── */

  if (screen === 'loading') {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={st.loadingText}>Wijzigingsverzoek laden…</Text>
      </View>
    );
  }

  if (screen === 'notFound') {
    return (
      <View style={st.center}>
        <Text style={st.emoji}>🔍</Text>
        <Text style={st.title}>Link niet gevonden</Text>
        <Text style={st.sub}>Deze goedkeuringslink is ongeldig of verlopen.</Text>
      </View>
    );
  }

  if (screen === 'alreadyHandled' && request) {
    const handled = request.status === 'APPROVED';
    return (
      <View style={st.center}>
        <Text style={st.emoji}>{handled ? '✅' : '❌'}</Text>
        <Text style={st.title}>
          {handled ? 'Al goedgekeurd' : 'Al afgewezen'}
        </Text>
        <Text style={st.sub}>
          {handled
            ? `Goedgekeurd door ${request.clientName ?? '—'} op ${request.approvedAt ? new Date(request.approvedAt).toLocaleString('nl-NL') : '—'}.`
            : `Afgewezen door ${request.clientName ?? '—'}. Reden: ${request.rejectionReason ?? '—'}`}
        </Text>
        {request.legalStatement ? (
          <View style={st.legalBox}>
            <Text style={st.legalText}>{request.legalStatement}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (screen === 'done') {
    return (
      <View style={st.center}>
        <Text style={st.emoji}>{doneMessage.startsWith('✅') ? '✅' : '❌'}</Text>
        <Text style={st.title}>{doneMessage}</Text>
        {legalText ? (
          <View style={st.legalBox}>
            <Text style={st.legalLabel}>Juridische bevestiging (opgeslagen)</Text>
            <Text style={st.legalText}>{legalText}</Text>
          </View>
        ) : null}
        <Text style={[st.sub, { marginTop: 24 }]}>
          Je kunt dit venster sluiten.
        </Text>
      </View>
    );
  }

  if (screen === 'rejecting' && request) {
    return (
      <ScrollView contentContainerStyle={st.container}>
        <Text style={st.headerTitle}>❌ Wijziging afwijzen</Text>
        <Text style={st.label}>Jouw naam *</Text>
        <TextInput
          style={st.input}
          placeholder="Volledige naam"
          value={clientName}
          onChangeText={setClientName}
        />
        <Text style={st.label}>Reden van afwijzing *</Text>
        <TextInput
          style={[st.input, st.textarea]}
          placeholder="Geef een korte toelichting…"
          multiline
          value={rejectReason}
          onChangeText={setRejectReason}
        />
        <View style={st.row}>
          <TouchableOpacity
            style={[st.btn, st.btnSecondary]}
            onPress={() => setScreen('form')}
          >
            <Text style={st.btnSecondaryText}>← Terug</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.btn, st.btnDanger, busy && st.btnDisabled]}
            onPress={handleReject}
            disabled={busy}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.btnText}>Afwijzen bevestigen</Text>
            }
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
    <ScrollView contentContainerStyle={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerBadge}>📐 Wijzigingsverzoek</Text>
        <Text style={st.headerTitle}>Goedkeuring bouwtekening</Text>
        <Text style={st.headerSub}>
          Lees de wijziging zorgvuldig door en geef je akkoord of wijs af.
        </Text>
      </View>

      {/* Wijzigingsdetails */}
      <View style={st.card}>
        <View style={st.chipRow}>
          <View style={st.chip}>
            <Text style={st.chipText}>{changeTypeLabel[request.changeType] ?? request.changeType}</Text>
          </View>
        </View>
        <Text style={st.cardLabel}>Omschrijving</Text>
        <Text style={st.cardValue}>{request.changeDescription}</Text>

        <Text style={st.cardLabel}>Aangevraagd door</Text>
        <Text style={st.cardValue}>{request.requesterName ?? '—'}</Text>

        <Text style={st.cardLabel}>Datum aanvraag</Text>
        <Text style={st.cardValue}>
          {new Date(request.requestedAt).toLocaleString('nl-NL')}
        </Text>
      </View>

      {/* Tekening preview */}
      {floorPlanUrl ? (
        <View style={st.card}>
          <Text style={st.cardLabel}>Betrokken bouwtekening</Text>
          <Image
            source={{ uri: floorPlanUrl }}
            style={st.floorPlanImg}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {/* Formulier */}
      <View style={st.card}>
        <Text style={st.sectionTitle}>Jouw gegevens</Text>

        <Text style={st.label}>Volledige naam *</Text>
        <TextInput
          style={st.input}
          placeholder="Jan de Vries"
          value={clientName}
          onChangeText={setClientName}
          autoCapitalize="words"
        />

        <Text style={st.label}>E-mailadres *</Text>
        <TextInput
          style={st.input}
          placeholder="jan@voorbeeld.nl"
          value={clientEmail}
          onChangeText={setClientEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Juridische mededeling */}
      <View style={st.legalBox}>
        <Text style={st.legalLabel}>⚖️ Juridische mededeling</Text>
        <Text style={st.legalText}>
          Door akkoord te gaan bevestigt u dat u de bovenstaande wijziging heeft gelezen
          en goedkeurt. Uw naam, e-mailadres en het tijdstip van goedkeuring worden
          vastgelegd als juridisch bewijs van uw toestemming.
        </Text>
      </View>

      {/* Actie-knoppen */}
      <View style={st.row}>
        <TouchableOpacity
          style={[st.btn, st.btnDanger]}
          onPress={() => setScreen('rejecting')}
        >
          <Text style={st.btnText}>❌ Afwijzen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.btn, st.btnSuccess, busy && st.btnDisabled]}
          onPress={handleApprove}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={st.btnText}>✅ Ik ga akkoord</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={st.footer}>
        SpeeQ • Veilig en versleuteld
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
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    paddingBottom: 60,
    backgroundColor: '#f8fafc',
    maxWidth: 640,
    // @ts-ignore web only
    marginHorizontal: 'auto',
    width: '100%',
  },
  loadingText: { marginTop: 16, color: '#64748b', fontSize: 15 },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  header: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  headerSub: { fontSize: 14, color: '#64748b', lineHeight: 20 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    // @ts-ignore web
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  chipRow: { flexDirection: 'row', marginBottom: 12 },
  chip: {
    backgroundColor: '#dbeafe',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  cardLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 2 },
  cardValue: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },

  floorPlanImg: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#f1f5f9',
  },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },

  legalBox: {
    backgroundColor: '#fef9c3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  legalLabel: { fontSize: 12, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  legalText: { fontSize: 13, color: '#78350f', lineHeight: 19 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSuccess: { backgroundColor: '#059669' },
  btnDanger: { backgroundColor: '#dc2626' },
  btnSecondary: { backgroundColor: '#e2e8f0' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  btnSecondaryText: { color: '#374151', fontWeight: '600', fontSize: 15 },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
});
