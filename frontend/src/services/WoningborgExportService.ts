/**
 * WoningborgExportService — eerste eenrichtings-export van SpeeQ-bewijs naar de
 * Woningborg-WKI-werkwijze. Geen live API (V1): een stabiel, zelf-gedefinieerd
 * uitwisselpakket (gestructureerde data + foto-referenties) dat de
 * kwaliteitsborger kan inlezen of overnemen.
 *
 * Zuiver: stelt het exportpakket samen uit (lokaal gecachte) projectdata + een
 * per-tenant mapping. Geen netwerk, geen opslag — offline-first respecteert dit
 * vanzelf. Zie docs/integraties/Woningborg-WKI.md.
 */

export const WONINGBORG_EXPORT_PROFIEL = 'woningborg-wki';
export const WONINGBORG_EXPORT_VERSIE = '1.0';

/** SpeeQ-review-status zoals op evidence/controlepunten. */
export type SpeeqStatus =
  | 'APPROVED'
  | 'FINALIZED'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | string
  | null
  | undefined;

export type WoningborgStatus = 'akkoord' | 'in_behandeling' | 'afgekeurd' | 'onbekend';

export interface Controlepunt {
  controlepuntId: string;
  omschrijving: string;
  status: SpeeqStatus;
  vastlegdatum?: string | null;
  verantwoordelijke?: string | null;
  fotoReferenties?: string[];
}

export interface CheckpointMapping {
  speeqControlepuntId: string;
  woningborgCode: string;
  woningborgOmschrijving?: string | null;
}

export interface ProjectMeta {
  projectId: string;
  naam?: string | null;
}

export interface WoningborgPunt {
  woningborgCode: string;
  omschrijving: string;
  status: WoningborgStatus;
  vastlegdatum: string | null;
  verantwoordelijke: string | null;
  fotoReferenties: string[];
}

export interface NietGemaptPunt {
  controlepuntId: string;
  omschrijving: string;
}

export interface WoningborgExportPakket {
  profiel: typeof WONINGBORG_EXPORT_PROFIEL;
  versie: typeof WONINGBORG_EXPORT_VERSIE;
  project: { projectId: string; naam: string | null; gegenereerdAt: string };
  punten: WoningborgPunt[];
  nietGemapt: NietGemaptPunt[];
}

/** Mapt de SpeeQ-review-status naar een Woningborg-leesbare status. */
export const mapStatus = (status: SpeeqStatus): WoningborgStatus => {
  switch (status) {
    case 'APPROVED':
    case 'FINALIZED':
      return 'akkoord';
    case 'PENDING_REVIEW':
      return 'in_behandeling';
    case 'REJECTED':
      return 'afgekeurd';
    default:
      return 'onbekend';
  }
};

/**
 * Stelt het Woningborg-WKI-exportpakket samen. Controlepunten zonder mapping
 * verdwijnen niet stilletjes — ze komen in `nietGemapt` zodat de borger ziet wat
 * nog handmatig moet.
 */
export const bouwWoningborgExport = (
  project: ProjectMeta,
  controlepunten: Controlepunt[],
  mappings: CheckpointMapping[],
  gegenereerdAt: string = new Date().toISOString()
): WoningborgExportPakket => {
  const mapByControlepunt = new Map(
    mappings.map((m) => [m.speeqControlepuntId, m])
  );

  const punten: WoningborgPunt[] = [];
  const nietGemapt: NietGemaptPunt[] = [];

  for (const cp of controlepunten) {
    const mapping = mapByControlepunt.get(cp.controlepuntId);
    if (!mapping) {
      nietGemapt.push({
        controlepuntId: cp.controlepuntId,
        omschrijving: cp.omschrijving,
      });
      continue;
    }
    punten.push({
      woningborgCode: mapping.woningborgCode,
      omschrijving: mapping.woningborgOmschrijving || cp.omschrijving,
      status: mapStatus(cp.status),
      vastlegdatum: cp.vastlegdatum ?? null,
      verantwoordelijke: cp.verantwoordelijke ?? null,
      fotoReferenties: cp.fotoReferenties ?? [],
    });
  }

  return {
    profiel: WONINGBORG_EXPORT_PROFIEL,
    versie: WONINGBORG_EXPORT_VERSIE,
    project: {
      projectId: project.projectId,
      naam: project.naam ?? null,
      gegenereerdAt,
    },
    punten,
    nietGemapt,
  };
};

/** Korte samenvattingsregel voor de UI. */
export const formatExportSamenvatting = (pakket: WoningborgExportPakket): string => {
  const n = pakket.punten.length;
  const open = pakket.nietGemapt.length;
  const ongemapt = open > 0 ? ` · ${open} niet gemapt` : '';
  return `${n} punt${n === 1 ? '' : 'en'} geëxporteerd${ongemapt}`;
};
