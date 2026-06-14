/**
 * KwaliteitssamenvattingService — bouwt de 1-pagina kwaliteitssamenvatting die
 * vooraan het opleverdossier komt. Eén voorpagina die borger én bevoegd gezag in
 * één oogopslag overtuigt dat het dossier op orde is.
 *
 * Verschil met DossierCheckService: die controleert óf alles aanwezig is; deze
 * *presenteert* de kwaliteit van wat er ligt — leesbaar, feitelijk, op één A4.
 *
 * Zuiver + offline-first + nul extra invoer: alle cijfers komen uit bestaande
 * projectdata (controlepunten, afwijkingen). Ontbrekende data wordt eerlijk
 * benoemd, nooit stilzwijgend leeg gelaten. SpeeQ toetst niet, SpeeQ legt vast —
 * geen oordeel namens de borger, geen marketingtaal in het document.
 *
 * Zie docs/wkb/kwaliteitssamenvatting.md.
 */

/** Vaste volgorde van bouwfasen voor de dekkingsweergave. */
export const BOUWFASEN = [
  'fundering',
  'ruwbouw',
  'installaties',
  'afbouw',
  'oplevering',
] as const;

export type Bouwfase = (typeof BOUWFASEN)[number];

export interface SamenvattingProject {
  naam: string;
  adres?: string | null;
  gevolgklasse?: string | null;
  aannemer?: string | null;
  kwaliteitsborger?: string | null;
  instrument?: string | null;
  gereedmeldingDatum?: string | null;
}

export interface SamenvattingControlepunt {
  id: string;
  fase?: string | null;
  /** Afgerond/afgetekend (akkoord). */
  afgerond: boolean;
  heeftFoto: boolean;
  heeftTijdstempel: boolean;
  heeftLocatie: boolean;
}

export interface SamenvattingAfwijking {
  opgelost: boolean;
  openReden?: string | null;
}

export interface SamenvattingBron {
  project: SamenvattingProject;
  controlepunten: SamenvattingControlepunt[];
  afwijkingen?: SamenvattingAfwijking[];
}

export interface ControlepuntCijfers {
  totaal: number;
  metFoto: number;
  metTijdstempelLocatie: number;
  procentAfgerond: number;
}

export interface AfwijkingCijfers {
  geconstateerd: number;
  opgelost: number;
  open: number;
  openRedenen: string[];
}

export interface FaseDekking {
  fase: Bouwfase | 'overig';
  aantal: number;
}

export interface Kwaliteitssamenvatting {
  project: SamenvattingProject;
  controlepunten: ControlepuntCijfers;
  afwijkingen: AfwijkingCijfers;
  fasedekking: FaseDekking[];
  /** Eerlijke gaten, in mensentaal. Leeg = niets ontbreekt. */
  ontbrekend: string[];
  bewijsIntegriteit: string;
}

const procent = (deel: number, totaal: number): number =>
  totaal === 0 ? 0 : Math.round((deel / totaal) * 100);

const normaliseerFase = (raw: string | null | undefined): Bouwfase | 'overig' => {
  const v = String(raw ?? '').toLowerCase();
  return (BOUWFASEN as readonly string[]).includes(v) ? (v as Bouwfase) : 'overig';
};

/**
 * Bouwt de samenvatting volledig uit projectdata. Geen extra invoer; ontbrekende
 * dekking wordt expliciet benoemd in `ontbrekend`.
 */
export const bouwKwaliteitssamenvatting = (
  bron: SamenvattingBron
): Kwaliteitssamenvatting => {
  const cps = bron.controlepunten;
  const totaal = cps.length;
  const metFoto = cps.filter((c) => c.heeftFoto).length;
  const metTijdstempelLocatie = cps.filter(
    (c) => c.heeftTijdstempel && c.heeftLocatie
  ).length;
  const afgerond = cps.filter((c) => c.afgerond).length;

  const controlepunten: ControlepuntCijfers = {
    totaal,
    metFoto,
    metTijdstempelLocatie,
    procentAfgerond: procent(afgerond, totaal),
  };

  const afw = bron.afwijkingen ?? [];
  const opgelost = afw.filter((a) => a.opgelost).length;
  const openLijst = afw.filter((a) => !a.opgelost);
  const afwijkingen: AfwijkingCijfers = {
    geconstateerd: afw.length,
    opgelost,
    open: openLijst.length,
    openRedenen: openLijst
      .map((a) => a.openReden?.trim())
      .filter((r): r is string => !!r),
  };

  // Fasedekking in vaste volgorde + 'overig' als er punten buiten de fasen vallen.
  const telPerFase = new Map<Bouwfase | 'overig', number>();
  for (const c of cps) {
    const f = normaliseerFase(c.fase);
    telPerFase.set(f, (telPerFase.get(f) ?? 0) + 1);
  }
  const fasedekking: FaseDekking[] = BOUWFASEN.map((fase) => ({
    fase,
    aantal: telPerFase.get(fase) ?? 0,
  }));
  const overig = telPerFase.get('overig') ?? 0;
  if (overig > 0) fasedekking.push({ fase: 'overig', aantal: overig });

  // Eerlijke gaten.
  const ontbrekend: string[] = [];
  const zonderFoto = totaal - metFoto;
  if (zonderFoto > 0) ontbrekend.push(`Geen foto bij ${zonderFoto} controlepunt(en).`);
  const zonderTsLoc = totaal - metTijdstempelLocatie;
  if (zonderTsLoc > 0) {
    ontbrekend.push(`Geen tijdstempel/locatie bij ${zonderTsLoc} controlepunt(en).`);
  }
  for (const fase of BOUWFASEN) {
    if ((telPerFase.get(fase) ?? 0) === 0) {
      ontbrekend.push(`Geen controlepunten vastgelegd in fase "${fase}".`);
    }
  }
  if (afwijkingen.open > 0) {
    ontbrekend.push(`${afwijkingen.open} afwijking(en) nog open.`);
  }

  const bewijsIntegriteit =
    'Elke foto draagt een tijdstempel en (waar beschikbaar) locatie, offline ' +
    'vastgelegd op het apparaat — niet achteraf bijgewerkt.';

  return {
    project: bron.project,
    controlepunten,
    afwijkingen,
    fasedekking,
    ontbrekend,
    bewijsIntegriteit,
  };
};

/** Serialiseert de samenvatting naar leesbare 1-pagina-tekst (voor PDF/voorpagina). */
export const formatSamenvatting = (s: Kwaliteitssamenvatting): string => {
  const p = s.project;
  const regels: string[] = [];
  regels.push('KWALITEITSSAMENVATTING');
  regels.push('');
  regels.push(`Project: ${p.naam}`);
  if (p.adres) regels.push(`Adres: ${p.adres}`);
  if (p.gevolgklasse) regels.push(`Gevolgklasse: ${p.gevolgklasse}`);
  if (p.aannemer) regels.push(`Aannemer: ${p.aannemer}`);
  if (p.kwaliteitsborger) {
    regels.push(
      `Kwaliteitsborger: ${p.kwaliteitsborger}${p.instrument ? ` (${p.instrument})` : ''}`
    );
  }
  if (p.gereedmeldingDatum) regels.push(`Gereedmelding: ${p.gereedmeldingDatum}`);
  regels.push('');

  const c = s.controlepunten;
  regels.push('Controlepunten');
  regels.push(`  Totaal: ${c.totaal}`);
  regels.push(`  Met foto-bewijs: ${c.metFoto}`);
  regels.push(`  Met tijdstempel + locatie: ${c.metTijdstempelLocatie}`);
  regels.push(`  Afgerond: ${c.procentAfgerond}%`);
  regels.push('');

  const a = s.afwijkingen;
  regels.push('Afwijkingen');
  regels.push(`  Geconstateerd: ${a.geconstateerd}`);
  regels.push(`  Opgelost: ${a.opgelost}`);
  regels.push(`  Open: ${a.open}`);
  for (const reden of a.openRedenen) regels.push(`    - ${reden}`);
  regels.push('');

  regels.push('Dekking per bouwfase');
  for (const f of s.fasedekking) {
    regels.push(`  ${f.fase}: ${f.aantal}`);
  }
  regels.push('');

  if (s.ontbrekend.length > 0) {
    regels.push('Aandachtspunten (eerlijk benoemd)');
    for (const o of s.ontbrekend) regels.push(`  - ${o}`);
    regels.push('');
  }

  regels.push('Bewijs-integriteit');
  regels.push(`  ${s.bewijsIntegriteit}`);

  return regels.join('\n');
};
