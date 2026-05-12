/**
 * TenantBrandMark — toont het klant-logo + bedrijfsnaam in headers.
 *
 * Filosofie:
 *   - Op entry-screens (Landing, Login, CodeGate, TenantLogin) tonen we SpeeQ.
 *   - Zodra de gebruiker is ingelogd, hoort de tool VAN de klant te zijn:
 *     hun logo, hun naam, in de header en in PDF-exports.
 *
 * Fallback: zolang er geen branding is geüpload tonen we alleen de naam
 * (of niets), zodat SpeeQ-branding niet per ongeluk in de klant-context
 * blijft hangen.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTenantBranding } from '../hooks/useTenantBranding';

interface Props {
  /** Override de bedrijfsnaam (bv. projectnaam tonen) */
  fallbackName?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Toon naam naast logo (default true) */
  showName?: boolean;
  theme?: { colors: { textPrimary: string; textSecondary: string } };
}

const SIZE_MAP = {
  sm: { logo: 24, font: 12 },
  md: { logo: 36, font: 14 },
  lg: { logo: 56, font: 18 },
};

export default function TenantBrandMark({
  fallbackName,
  size = 'md',
  showName = true,
  theme,
}: Props) {
  const { companyName, logoUrl } = useTenantBranding();
  const dims = SIZE_MAP[size];
  const name = companyName ?? fallbackName ?? '';
  const nameColor = theme?.colors.textPrimary ?? '#0f172a';

  if (!logoUrl && !name) return null;

  return (
    <View style={styles.row}>
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={[styles.logo, { width: dims.logo, height: dims.logo }]}
          resizeMode="contain"
          accessibilityLabel={name ? `${name} logo` : 'Bedrijfslogo'}
        />
      ) : null}
      {showName && name ? (
        <Text style={[styles.name, { fontSize: dims.font, color: nameColor }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    borderRadius: 6,
  },
  name: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
