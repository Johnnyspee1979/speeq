/**
 * EkvMontageService — EKV (erkende kwaliteitsverklaring) + montage-spoor als
 * uitbreiding van het bestaande projectdossier voor prefab/industrieel bouwen.
 *
 * Een EKV borgt de fabriek, niet de hele woning. De aansprakelijkheid blijft bij
 * de aannemer, dus hij moet zowel de fabrieks-EKV als de montage op de bouwplaats
 * kunnen aantonen. Deze laag koppelt de EKV en volgt de montage-stappen als apart
 * spoor — geen tweede dossier-engine.
 *
 * Zuiver: beoordelen + samenvatten. Opslag/sync/UI/export zit eromheen.
 * Zie docs/wkb/ekv-montage-dossier.md.
 */

export type EkvStatus = 'GELDIG' | 'VERLOPEN' | 'ONVOLLEDIG' | 'GEEN';
export type MontageStatus = 'OPEN' | 'AKKOORD' | 'AFGEKEURD';

export interface Ekv {
  /** Verklaringsnummer. */
  nummer?: string | null;
  /** Uitgevende instantie. */
  uitgever?: string | null;
  /** Geldig tot (ISO-datum). */
  geldigTot?: string | null;
  /** Pad naar geüpload PDF/foto-bewijs. */
  bewijsPath?: string | null;
}

export interface MontageCheck {
  id: string;
  omschrijving: string;
  status: MontageStatus;
  vastgelegdAt?: string | null;
  verantwoordelijke?: string | null;
  fotoPath?: string | null;
}

export interface EkvBeoordeling {
  status: EkvStatus;
  /** Heeft de EKV een bewijsbestand? */
  heeftBewijs: boolean;
  /** Korte, eerlijke uitleg. */
  uitleg: string;
}

export interface MontageVoortgang {
  totaal: number;
  akkoord: number;
  afgekeurd: number;
  open: number;
  /** Alle checks akkoord (en er is er minstens één). */
  gereed: boolean;
}

/**
 * Beoordeelt de EKV. Vergelijkt geldigTot met een referentiemoment (default nu,
 * injecteerbaar voor deterministische tests).
 */
export const beoordeelEkv = (
  ekv: Ekv | null | undefined,
  nu: Date = new Date()
): EkvBeoordeling => {
  const heeftBewijs = !!ekv?.bewijsPath;

  if (!ekv || (!ekv.nummer && !ekv.uitgever && !ekv.geldigTot)) {
    return { status: 'GEEN', heeftBewijs, uitleg: 'Geen EKV vastgelegd.' };
  }
  if (!ekv.nummer || !ekv.uitgever) {
    return {
      status: 'ONVOLLEDIG',
      heeftBewijs,
      uitleg: 'EKV onvolledig — vul verklaringsnummer en uitgever aan.',
    };
  }
  if (ekv.geldigTot && new Date(ekv.geldigTot).getTime() < nu.getTime()) {
    return {
      status: 'VERLOPEN',
      heeftBewijs,
      uitleg: 'EKV is verlopen — vraag een actuele verklaring op.',
    };
  }
  return {
    status: 'GELDIG',
    heeftBewijs,
    uitleg: heeftBewijs
      ? 'EKV geldig en met bewijsbestand vastgelegd.'
      : 'EKV geldig; voeg nog het bewijsbestand (PDF/foto) toe.',
  };
};

/** Telt de montage-checks en bepaalt of het spoor gereed is. */
export const montageVoortgang = (checks: MontageCheck[]): MontageVoortgang => {
  const akkoord = checks.filter((c) => c.status === 'AKKOORD').length;
  const afgekeurd = checks.filter((c) => c.status === 'AFGEKEURD').length;
  const open = checks.filter((c) => c.status === 'OPEN').length;
  return {
    totaal: checks.length,
    akkoord,
    afgekeurd,
    open,
    gereed: checks.length > 0 && akkoord === checks.length,
  };
};

/** Is het montage-spoor volledig afgetekend? */
export const montageGereed = (checks: MontageCheck[]): boolean =>
  montageVoortgang(checks).gereed;

/** Korte EKV-regel voor UI/export. */
export const formatEkvRegel = (ekv: Ekv | null | undefined, nu?: Date): string => {
  const b = beoordeelEkv(ekv, nu);
  if (b.status === 'GEEN') return 'EKV: niet vastgelegd';
  const nr = ekv?.nummer ? ` ${ekv.nummer}` : '';
  const labels: Record<EkvStatus, string> = {
    GELDIG: 'geldig',
    VERLOPEN: 'verlopen',
    ONVOLLEDIG: 'onvolledig',
    GEEN: 'niet vastgelegd',
  };
  return `EKV${nr}: ${labels[b.status]}`;
};

/**
 * Eén regel voor in het complete dossier/export: EKV-status + montage-voortgang.
 * Breekt de bestaande exportstructuur niet — het is een extra blok.
 */
export const vatDossierbijdrageSamen = (
  ekv: Ekv | null | undefined,
  checks: MontageCheck[],
  nu?: Date
): string => {
  const v = montageVoortgang(checks);
  const montage =
    v.totaal === 0
      ? 'montage: geen checks'
      : `montage: ${v.akkoord}/${v.totaal} akkoord${v.gereed ? ' (gereed)' : ''}`;
  return `${formatEkvRegel(ekv, nu)} · ${montage}`;
};
