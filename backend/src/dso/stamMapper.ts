const getString = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const mapToStamPayload = (input: Record<string, unknown>) => {
  const bewijs = Array.isArray(input.bewijs) ? input.bewijs : [];

  return {
    projectReferentie: getString(input.project_id, 'onbekend'),
    kwaliteitsborgerId: getString(input.kwaliteitsborger_regnr, 'onbekend'),
    typeMelding:
      input.type_melding === 'GEREEDMELDING' ? 'GEREEDMELDING' : 'BOUWMELDING',
    bewijslast: bewijs.map((item, index) => {
      const record = item as Record<string, unknown>;
      const documentNaam =
        getString(record.document_naam, '') ||
        getString(record.id, '') ||
        getString(record.inspection_point_id, '') ||
        `bewijs-${index + 1}`;

      return {
        documentNaam,
        hashSha256: getString(record.exif_hash, '') || `WKB-HASH-PLACEHOLDER-${Date.now()}`,
        downloadUrl: getString(record.photo_uri, getString(record.download_url, 'https://storage.supabase.com/fallback')),
      };
    }),
    verklaringAkkoord: Boolean(input.verklaring_akkoord),
  };
};

module.exports = { mapToStamPayload };
