/**
 * JaaroverzichtService — leeslaag die de Wkb-cijfers van de ingelogde aannemer
 * (tenant) samenvat over een periode. "Jouw dossier is jouw stem in de evaluatie."
 *
 * Puur een lees- en samenvatlaag bovenop bestaande tabellen: geen nieuwe invoer,
 * geen migratie, geen dubbele opslag. Deze service rekent KPI's + maandtrend uit
 * rijen die de datalaag al levert (RLS zorgt voor tenant-isolatie). Geen
 * benchmarking tegen andere aannemers — puur de eigen cijfers.
 *
 * Zie docs/features/jaaroverzicht-queries.md.
 */

export interface OverzichtProject {
  id: string;
  /** ISO-datum waarop het project is opgeleverd/gereedgemeld, of null. */
  opgeleverdAt?: string | null;
}

export interface OverzichtControlepunt {
  id: string;
  projectId: string;
  /** ISO-datum van vastleggen. */
  vastgelegdAt: string;
  heeftFoto: boolean;
}

export interface OverzichtDossier {
  id: string;
  /** 'bevoegd-gezag' | 'consument' — beide tellen als opgeleverd dossier. */
  soort: string;
  gegenereerdAt: string;
}

export interface Periode {
  /** ISO-datum, inclusief. */
  van: string;
  /** ISO-datum, inclusief tot einde van die dag. */
  tot: string;
}

export interface JaaroverzichtKpi {
  projecten: number;
  controlepunten: number;
  fotos: number;
  dossiers: number;
  /** Afgerond op 1 decimaal. */
  gemiddeldControlepuntenPerProject: number;
}

export interface MaandPunt {
  /** 'YYYY-MM'. */
  maand: string;
  aantal: number;
}

export interface Jaaroverzicht {
  periode: Periode;
  kpi: JaaroverzichtKpi;
  maandtrend: MaandPunt[];
  leeg: boolean;
}

/** Lopend kalenderjaar als default-periode. */
export const lopendKalenderjaar = (nu: Date = new Date()): Periode => {
  const jaar = nu.getUTCFullYear();
  return {
    van: `${jaar}-01-01`,
    tot: `${jaar}-12-31`,
  };
};

const binnenPeriode = (isoDatum: string, periode: Periode): boolean => {
  const t = new Date(isoDatum).getTime();
  if (Number.isNaN(t)) return false;
  const van = new Date(`${periode.van}T00:00:00.000Z`).getTime();
  const tot = new Date(`${periode.tot}T23:59:59.999Z`).getTime();
  return t >= van && t <= tot;
};

const maandSleutel = (isoDatum: string): string => isoDatum.slice(0, 7);

/**
 * Bouwt het jaaroverzicht uit de al-gefilterde tenant-rijen. Alle bronnen worden
 * nogmaals op de periode gefilterd zodat de cijfers consistent zijn. Een lege
 * periode geeft een nette nul-staat (`leeg: true`), geen crash.
 */
export const bouwJaaroverzicht = (
  bron: {
    projecten: OverzichtProject[];
    controlepunten: OverzichtControlepunt[];
    dossiers: OverzichtDossier[];
  },
  periode: Periode
): Jaaroverzicht => {
  const controlepunten = bron.controlepunten.filter((c) =>
    binnenPeriode(c.vastgelegdAt, periode)
  );
  const dossiers = bron.dossiers.filter((d) => binnenPeriode(d.gegenereerdAt, periode));

  // Een project telt mee als het in de periode is opgeleverd óf in de periode
  // controlepunten heeft (aantoonbare activiteit). Zo telt een lopend project
  // zonder activiteit niet onterecht mee in elke periode.
  const projectenMetActiviteit = new Set(controlepunten.map((c) => c.projectId));
  const projecten = bron.projecten.filter(
    (p) =>
      (p.opgeleverdAt && binnenPeriode(p.opgeleverdAt, periode)) ||
      projectenMetActiviteit.has(p.id)
  );

  const aantalProjecten = projecten.length;
  const aantalControlepunten = controlepunten.length;
  const fotos = controlepunten.filter((c) => c.heeftFoto).length;
  const gemiddelde =
    aantalProjecten === 0
      ? 0
      : Math.round((aantalControlepunten / aantalProjecten) * 10) / 10;

  const kpi: JaaroverzichtKpi = {
    projecten: aantalProjecten,
    controlepunten: aantalControlepunten,
    fotos,
    dossiers: dossiers.length,
    gemiddeldControlepuntenPerProject: gemiddelde,
  };

  // Maandtrend: controlepunten per maand, oplopend gesorteerd.
  const perMaand = new Map<string, number>();
  for (const c of controlepunten) {
    const m = maandSleutel(c.vastgelegdAt);
    perMaand.set(m, (perMaand.get(m) ?? 0) + 1);
  }
  const maandtrend: MaandPunt[] = [...perMaand.entries()]
    .map(([maand, aantal]) => ({ maand, aantal }))
    .sort((a, b) => a.maand.localeCompare(b.maand));

  const leeg =
    aantalProjecten === 0 && aantalControlepunten === 0 && dossiers.length === 0;

  return { periode, kpi, maandtrend, leeg };
};
