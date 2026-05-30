// frontend/src/components/kyp/KypPlanningCard.tsx
//
// Read-only planning-kaart die de KYP-mijlpalen van één SpeeQ-project toont.
// Stale-while-revalidate: toont eerst de lokale cache, ververst dan live uit KYP.
//
// Zelfstandig component — krijgt alleen `speeqProjectId` mee. Toont een nette
// lege staat zolang er geen token of koppeling is; crasht nooit.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { StatusPill } from '../ui/StatusPill';
import { PrimaryButton } from '../ui/PrimaryButton';
import { EmptyState } from '../ui/EmptyState';
import {
  getCachedPlanning,
  getKypConfig,
  getProjectMapping,
  syncProjectPlanning,
  type KypMilestone,
  type KypMilestoneStatus,
} from '../../services/KypService';

interface KypPlanningCardProps {
  speeqProjectId: string;
}

type SetupState = 'checking' | 'no_token' | 'no_mapping' | 'ready';

const STATUS_PILL: Record<
  KypMilestoneStatus,
  { type: 'success' | 'warning' | 'neutral'; label: string }
> = {
  afgerond: { type: 'success', label: 'Afgerond' },
  te_laat: { type: 'warning', label: 'Te laat' },
  gepland: { type: 'neutral', label: 'Gepland' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Groepeer mijlpalen op fase, met behoud van volgorde. */
function groupByPhase(
  milestones: KypMilestone[],
): { phase: string; items: KypMilestone[] }[] {
  const order: string[] = [];
  const map = new Map<string, KypMilestone[]>();
  for (const m of milestones) {
    const key = m.phaseName ?? 'Overig';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(m);
  }
  return order.map((phase) => ({ phase, items: map.get(phase)! }));
}

export const KypPlanningCard = ({ speeqProjectId }: KypPlanningCardProps) => {
  const { theme } = useTheme();
  const [setup, setSetup] = useState<SetupState>('checking');
  const [milestones, setMilestones] = useState<KypMilestone[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCache = useCallback(async () => {
    const rows = await getCachedPlanning(speeqProjectId);
    setMilestones(rows);
  }, [speeqProjectId]);

  const revalidate = useCallback(async () => {
    setSyncing(true);
    setError(null);
    const res = await syncProjectPlanning(speeqProjectId);
    if (res.ok) {
      await loadCache();
      setLastSyncedAt(new Date());
    } else {
      setError(res.error);
    }
    setSyncing(false);
  }, [speeqProjectId, loadCache]);

  // Mount: bepaal setup-staat, toon cache, ververs als alles klaarstaat.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSetup('checking');
      const config = await getKypConfig();
      if (cancelled) return;
      if (!config) {
        setSetup('no_token');
        return;
      }
      const mapping = await getProjectMapping(speeqProjectId);
      if (cancelled) return;
      if (!mapping) {
        setSetup('no_mapping');
        return;
      }
      setSetup('ready');
      await loadCache();
      if (!cancelled) await revalidate();
    })();
    return () => {
      cancelled = true;
    };
  }, [speeqProjectId, loadCache, revalidate]);

  const grouped = useMemo(() => groupByPhase(milestones), [milestones]);

  // ── Lege staten ────────────────────────────────────────────────────────────
  if (setup === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (setup === 'no_token') {
    return (
      <EmptyState
        icon="🔌"
        title="KYP nog niet gekoppeld"
        subtitle="Er is nog geen KYP-token ingesteld. Een beheerder (KEYUSER) stelt dit in via het KYP-configuratiescherm. Daarna verschijnt hier de planning."
      />
    );
  }

  if (setup === 'no_mapping') {
    return (
      <EmptyState
        icon="🔗"
        title="Project nog niet aan KYP gekoppeld"
        subtitle="Kies in het KYP-configuratiescherm welk KYP-project bij dit SpeeQ-project hoort. Daarna laadt de planning automatisch."
      />
    );
  }

  // ── Klaar: toon planning ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Planning uit KYP
          </Text>
          <Text style={[styles.subtle, { color: theme.colors.textSecondary }]}>
            {lastSyncedAt
              ? `Bijgewerkt ${lastSyncedAt.toLocaleTimeString('nl-NL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Lokale gegevens'}
          </Text>
        </View>
        <PrimaryButton
          label={syncing ? 'Verversen…' : 'Ververs'}
          size="sm"
          loading={syncing}
          onPress={revalidate}
        />
      </View>

      {error ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.danger },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {error}
          </Text>
        </View>
      ) : null}

      {milestones.length === 0 && !syncing ? (
        <EmptyState
          icon="📅"
          title="Nog geen mijlpalen"
          subtitle="KYP heeft (nog) geen planning-activiteiten voor dit project teruggegeven."
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          {grouped.map((group) => (
            <View key={group.phase} style={styles.phaseBlock}>
              <Text
                style={[styles.phaseTitle, { color: theme.colors.textSecondary }]}
              >
                {group.phase}
              </Text>
              {group.items.map((m) => {
                const pill = STATUS_PILL[m.status];
                return (
                  <View
                    key={`${m.activityId}-${m.activityName}`}
                    style={[
                      styles.row,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <View style={styles.rowMain}>
                      <Text
                        style={[styles.activity, { color: theme.colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {m.activityName ?? 'Onbenoemde activiteit'}
                      </Text>
                      <Text style={[styles.dates, { color: theme.colors.textSecondary }]}>
                        {formatDate(m.startDate)} → {formatDate(m.endDate)}
                        {m.responsible ? `  ·  ${m.responsible}` : ''}
                      </Text>
                    </View>
                    <StatusPill status={pill.type} label={pill.label} />
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700' },
  subtle: { fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  phaseBlock: { marginBottom: 18 },
  phaseTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowMain: { flex: 1 },
  activity: { fontSize: 15, fontWeight: '600' },
  dates: { fontSize: 12, marginTop: 4 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13 },
});
