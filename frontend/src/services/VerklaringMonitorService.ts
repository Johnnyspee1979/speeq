/**
 * VerklaringMonitorService — statusmonitor voor de verklaring van de
 * kwaliteitsborger. Eén blik, één kleur, één knop.
 *
 * Waarom apart van DossierCheckService: die rekent het hele opleverdossier
 * (bevoegd gezag) door; deze monitor focust specifiek op de input die de borger
 * nodig heeft om zijn *verklaring* af te tekenen. Doel: ruim vóór de geplande
 * gereedmelding waarschuwen als er iets ontbreekt, zodat een maatwerkbesluit
 * nooit nodig is.
 *
 * Zuiver + offline-first: de checklist wordt afgeleid uit het borgingsplan
 * (niet uit een vaste lijst). De UI/sync levert per item aan of het er is; deze
 * service aggregeert naar kleur + tijdlijn-trigger. Geen harde wetsclaims —
 * taal van de aannemer ("klaar voor aftekenen").
 *
 * Zie docs/wkb/verklaring-statusmonitor.md.
 */

export type VerklaringSoort =
  | 'foto'
  | 'keuringsrapport'
  | 'as-built'
  | 'afwijking'
  | 'overig';

/** Eén eis zoals die uit het borgingsplan komt. `kritisch` → ontbreekt = rood. */
export interface BorgingsplanEis {
  id: string;
  naam: string;
  soort: VerklaringSoort;
  kritisch?: boolean;
  /** Optionele eigen deadline (ISO) voor dit item. */
  deadline?: string | null;
}

/** Een af te vinken checklist-item: de eis + of het bewijs aanwezig is. */
export interface VerklaringItem {
  id: string;
  naam: string;
  soort: VerklaringSoort;
  kritisch: boolean;
  deadline: string | null;
  aanwezig: boolean;
}

export type VerklaringStatusKleur = 'rood' | 'oranje' | 'groen';

export interface VerklaringStatus {
  statusKleur: VerklaringStatusKleur;
  /** Klaar voor aftekenen: alles aanwezig. */
  gereed: boolean;
  aanwezig: number;
  totaal: number;
  /** 0–100, afgerond. */
  score: number;
  ontbrekend: VerklaringItem[];
  /** Ontbreekt er minstens één als kritisch gemarkeerd item? */
  kritischOntbreekt: boolean;
}

/**
 * Bouwt de checklist uit het borgingsplan. `gedekt` = id's waarvan het bewijs
 * aantoonbaar aanwezig is (foto met tijdstempel, keuringsrapport, etc.). Items
 * zonder expliciete `kritisch` zijn niet-kritisch (oranje i.p.v. rood).
 */
export const bouwVerklaringChecklist = (
  eisen: BorgingsplanEis[],
  gedekt: string[] = []
): VerklaringItem[] => {
  const aanwezigeIds = new Set(gedekt);
  return eisen.map((eis) => ({
    id: eis.id,
    naam: eis.naam,
    soort: eis.soort,
    kritisch: eis.kritisch ?? false,
    deadline: eis.deadline ?? null,
    aanwezig: aanwezigeIds.has(eis.id),
  }));
};

/**
 * Aggregeert de checklist naar kleur + score. Groen pas als álles aanwezig is;
 * rood zodra een kritisch item ontbreekt; anders oranje.
 */
export const bepaalVerklaringStatus = (
  items: VerklaringItem[]
): VerklaringStatus => {
  const totaal = items.length;
  const ontbrekend = items.filter((i) => !i.aanwezig);
  const aanwezig = totaal - ontbrekend.length;
  const kritischOntbreekt = ontbrekend.some((i) => i.kritisch);
  const gereed = totaal > 0 ? ontbrekend.length === 0 : true;
  const score = totaal === 0 ? 100 : Math.round((aanwezig / totaal) * 100);

  let statusKleur: VerklaringStatusKleur;
  if (gereed) {
    statusKleur = 'groen';
  } else if (kritischOntbreekt) {
    statusKleur = 'rood';
  } else {
    statusKleur = 'oranje';
  }

  return {
    statusKleur,
    gereed,
    aanwezig,
    totaal,
    score,
    ontbrekend,
    kritischOntbreekt,
  };
};

// ── Tijdlijn-trigger ─────────────────────────────────────────────────────────

/** Aantal hele werkdagen (ma–vr) tussen `van` en `tot`, exclusief `van`. */
export const werkdagenTussen = (van: Date, tot: Date): number => {
  if (tot <= van) return 0;
  let werkdagen = 0;
  const cursor = new Date(
    Date.UTC(van.getUTCFullYear(), van.getUTCMonth(), van.getUTCDate())
  );
  const eind = new Date(
    Date.UTC(tot.getUTCFullYear(), tot.getUTCMonth(), tot.getUTCDate())
  );
  while (cursor < eind) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dag = cursor.getUTCDay(); // 0 = zo, 6 = za
    if (dag !== 0 && dag !== 6) werkdagen += 1;
  }
  return werkdagen;
};

export const STANDAARD_DREMPEL_WERKDAGEN = 10;

export interface TijdlijnTrigger {
  /** Waarschuwen? True als drempel bereikt en status niet groen. */
  waarschuw: boolean;
  werkdagenResterend: number;
  drempel: number;
  /** Datum al verstreken terwijl status niet groen is. */
  verstreken: boolean;
  reden: string;
}

/**
 * Rekent terug vanaf de geplande gereedmeldingsdatum en bepaalt of er
 * gewaarschuwd moet worden. Waarschuwt zodra er minder dan `drempel` werkdagen
 * resten en de verklaring nog niet groen is. Geen datum → geen trigger.
 */
export const evalueerTijdlijn = (params: {
  gereedmeldingDatum: string | null;
  status: VerklaringStatus;
  nu?: Date;
  drempel?: number;
}): TijdlijnTrigger => {
  const { gereedmeldingDatum, status } = params;
  const drempel = params.drempel ?? STANDAARD_DREMPEL_WERKDAGEN;
  const nu = params.nu ?? new Date();

  if (!gereedmeldingDatum) {
    return {
      waarschuw: false,
      werkdagenResterend: 0,
      drempel,
      verstreken: false,
      reden: 'Geen gereedmeldingsdatum ingevuld.',
    };
  }

  const datum = new Date(gereedmeldingDatum);
  if (Number.isNaN(datum.getTime())) {
    return {
      waarschuw: false,
      werkdagenResterend: 0,
      drempel,
      verstreken: false,
      reden: 'Ongeldige gereedmeldingsdatum.',
    };
  }

  const verstreken = datum.getTime() < nu.getTime();
  const werkdagenResterend = werkdagenTussen(nu, datum);

  if (status.gereed) {
    return {
      waarschuw: false,
      werkdagenResterend,
      drempel,
      verstreken,
      reden: 'Klaar voor aftekenen.',
    };
  }

  if (verstreken) {
    return {
      waarschuw: true,
      werkdagenResterend: 0,
      drempel,
      verstreken: true,
      reden: 'Gereedmeldingsdatum verstreken en nog niet klaar voor aftekenen.',
    };
  }

  const waarschuw = werkdagenResterend <= drempel;
  return {
    waarschuw,
    werkdagenResterend,
    drempel,
    verstreken: false,
    reden: waarschuw
      ? `Nog ${werkdagenResterend} werkdag(en) tot de gereedmelding en nog niet klaar.`
      : `Nog ${werkdagenResterend} werkdagen — ruim binnen de marge.`,
  };
};

/** Korte regel per checklist-item voor de UI/export. */
export const formatVerklaringRegel = (item: VerklaringItem): string => {
  const vink = item.aanwezig ? '✓' : '✗';
  const merk = item.kritisch && !item.aanwezig ? ' (kritisch)' : '';
  return `${vink}  ${item.naam}${merk}`;
};
