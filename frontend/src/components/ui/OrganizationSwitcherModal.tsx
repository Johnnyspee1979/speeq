// frontend/src/components/ui/OrganizationSwitcherModal.tsx
//
// Multi-tenant organisatie-switcher ("Open als klant").
//
// VEILIGHEID: het geselecteerde tenant_id wordt UITSLUITEND als lokale React-
// state beheerd en NOOIT in JWT custom claims geïnjecteerd (voorkomt
// revocation lag). De PostgreSQL RLS-functie
// `get_user_enrolled_organization_ids()` valideert elke API-call live tegen
// `auth.uid()` → enrolled organizations.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeProvider';
import { SecondaryButton } from './SecondaryButton';
import { StatusPill } from './StatusPill';
import { EmptyState } from './EmptyState';

interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface OrganizationSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  currentTenantId: string | null;
  onSelectTenant: (tenantId: string) => void;
}

export const OrganizationSwitcherModal = ({
  visible,
  onClose,
  currentTenantId,
  onSelectTenant,
}: OrganizationSwitcherModalProps) => {
  const { theme } = useTheme();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      void fetchAvailableTenants();
    }
  }, [visible]);

  const fetchAvailableTenants = async () => {
    setLoading(true);

    // Haal alle profielen op voor de huidige auth.uid().
    // profiles.id == auth.uid() (PK), profiles.tenant_id (text) → enrolled tenant.
    // RLS dwingt veilig af dat we alleen onze eigen profielen zien.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setTenants([]);
      setLoading(false);
      return;
    }

    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id);

    if (profilesError || !profileRows) {
      setTenants([]);
      setLoading(false);
      return;
    }

    // Lookup tenant-namen los — tenants.company_id is PK, geen embed via FK.
    const tenantIds = Array.from(
      new Set(profileRows.map((r) => r.tenant_id).filter((t): t is string => !!t)),
    );

    let nameMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: tenantRows } = await supabase
        .from('tenants')
        .select('company_id, name')
        .in('company_id', tenantIds);
      if (tenantRows) {
        nameMap = new Map(tenantRows.map((t) => [t.company_id as string, t.name as string]));
      }
    }

    const formattedTenants: Tenant[] = profileRows
      .filter((r) => !!r.tenant_id)
      .map((r) => ({
        id: r.tenant_id as string,
        name: nameMap.get(r.tenant_id as string) ?? (r.tenant_id as string),
        role: (r.role as string) ?? 'TEAMLID',
      }));

    setTenants(formattedTenants);
    setLoading(false);
  };

  const renderTenantItem = ({ item }: { item: Tenant }) => {
    const isActive = item.id === currentTenantId;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          onSelectTenant(item.id);
          onClose();
        }}
        style={[
          styles.tenantCard,
          {
            backgroundColor: isActive ? theme.colors.backgroundAlt : theme.colors.background,
            borderColor: isActive ? theme.colors.textPrimary : theme.colors.borderWarm,
          },
        ]}
      >
        <Text
          style={[
            styles.tenantName,
            {
              fontFamily: theme.typography.sectionTitle.fontFamily,
              color: theme.colors.textPrimary,
            },
          ]}
        >
          {item.name}
        </Text>
        <StatusPill
          status={isActive ? 'success' : 'neutral'}
          label={isActive ? 'Actief' : item.role}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderWarm,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                fontFamily: theme.typography.headline.fontFamily,
                color: theme.colors.textPrimary,
              },
            ]}
          >
            Open als klant
          </Text>

          <View style={styles.listContainer}>
            {!loading && tenants.length === 0 ? (
              <EmptyState
                title="Geen organisaties"
                subtitle="U bent nog niet gekoppeld aan een Wkb-tenant."
              />
            ) : (
              <FlatList
                data={tenants}
                keyExtractor={(item) => item.id}
                renderItem={renderTenantItem}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                removeClippedSubviews={true}
              />
            )}
          </View>

          <View style={styles.buttonRow}>
            <SecondaryButton title="Annuleren" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 43, 43, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 450,
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
    flexDirection: 'column',
    maxHeight: '80%',
    shadowColor: '#2B2B2B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  listContainer: {
    flex: 1,
    marginBottom: 24,
  },
  tenantCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 12,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
