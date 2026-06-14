/**
 * VerzekeringInformatiebladService — genereert het 1-pagina informatieblad
 * "Verzekering & financiële zekerheid" dat de aannemer vóór de start aan de
 * opdrachtgever geeft. Vervult de wettelijke informatieplicht (vooraf informeren
 * over hoe de aansprakelijkheid voor gebreken is gedekt) aantoonbaar.
 *
 * Scope-grens: SpeeQ legt vast wat de aannemer heeft geregeld — geen verzekering
 * verkopen, vergelijken of adviseren, geen oordeel of de dekking "voldoende" is.
 *
 * Zuiver + offline-first: bedrijfsstandaard (eenmalig) + per-project bevestiging.
 * De overhandiging krijgt een tijdstempel, net als de controlepunten, zodat
 * "vooraf geïnformeerd" aantoonbaar is.
 *
 * Zie docs/wkb/verzekering-informatieblad.md.
 */

export type DekkingsVorm =
  | 'verborgen-gebreken-verzekering'
  | 'garantieverzekering'
  | 'bankgarantie'
  | 'waarborgregeling'
  | 'andere-financiele-zekerheid';

export interface DekkingsBlok {
  vorm: DekkingsVorm;
  /** Vrije omschrijving in mensentaal (geen polisjargon). */
  omschrijving: string;
  /** Dekkingsperiode in mensentaal, bijv. "6 jaar na oplevering". */
  periode?: string | null;
  /** Verwijzing naar onderliggend bewijs (bijlage/vindplaats), niet de polis zelf. */
  bewijsVerwijzing?: string | null;
}

/** Bedrijfsstandaard: eenmaal instellen, per project hergebruiken. */
export interface BedrijfsStandaardDekking {
  aannemer: string;
  dekkingen: DekkingsBlok[];
}

export interface InformatiebladProject {
  projectId: string;
  projectnaam: string;
  adres?: string | null;
  gevolgklasse?: string | null;
  opdrachtgever?: string | null;
}

export interface Informatieblad {
  project: InformatiebladProject;
  aannemer: string;
  datum: string;
  dekkingen: DekkingsBlok[];
  /** Eerlijke gaten (lege velden expliciet benoemd). */
  ontbrekend: string[];
  ondertekenregel: string;
}

const VORM_LABEL: Record<DekkingsVorm, string> = {
  'verborgen-gebreken-verzekering': 'Verborgen-gebrekenverzekering',
  'garantieverzekering': 'Garantieverzekering',
  'bankgarantie': 'Bankgarantie',
  'waarborgregeling': 'Waarborgregeling',
  'andere-financiele-zekerheid': 'Andere financiële zekerheid',
};

export const dekkingsVormLabel = (vorm: DekkingsVorm): string => VORM_LABEL[vorm];

/**
 * Stelt het informatieblad samen uit de bedrijfsstandaard + eventuele per-project
 * overrides. Geen extra invoer nodig als de standaard gevuld is; ontbrekende
 * gegevens worden eerlijk benoemd, nooit stilzwijgend leeg gelaten.
 */
export const bouwInformatieblad = (params: {
  project: InformatiebladProject;
  standaard: BedrijfsStandaardDekking;
  /** Optioneel: per-project afwijkende dekkingen (vervangt de standaard). */
  projectDekkingen?: DekkingsBlok[];
  datum?: string;
}): Informatieblad => {
  const datum = params.datum ?? new Date().toISOString().slice(0, 10);
  const dekkingen =
    params.projectDekkingen && params.projectDekkingen.length > 0
      ? params.projectDekkingen
      : params.standaard.dekkingen;

  const ontbrekend: string[] = [];
  if (dekkingen.length === 0) {
    ontbrekend.push('Geen dekkingsvorm vastgelegd.');
  }
  dekkingen.forEach((d, i) => {
    if (!d.omschrijving?.trim()) {
      ontbrekend.push(`Dekking ${i + 1}: omschrijving ontbreekt.`);
    }
    if (!d.bewijsVerwijzing?.trim()) {
      ontbrekend.push(`Dekking ${i + 1} (${dekkingsVormLabel(d.vorm)}): geen verwijzing naar bewijs.`);
    }
  });
  if (!params.project.opdrachtgever?.trim()) {
    ontbrekend.push('Opdrachtgever niet ingevuld.');
  }

  return {
    project: params.project,
    aannemer: params.standaard.aannemer,
    datum,
    dekkingen,
    ontbrekend,
    ondertekenregel:
      'Ontvangen en gelezen vóór start werk — datum en paraaf opdrachtgever: ____________________',
  };
};

export interface OverhandigingBevestiging {
  projectId: string;
  /** Tijdstempel van overhandigen, net als bij controlepunten. */
  overhandigdAt: string;
  /** Vrij veld: aan wie / hoe overhandigd. */
  notitie?: string | null;
}

/**
 * Legt de overhandiging vast met een tijdstempel. Pure helper: produceert het te
 * persisteren record (opslag/tijdlijn zit eromheen). `nu` is injecteerbaar voor
 * deterministische tests.
 */
export const registreerOverhandiging = (
  projectId: string,
  notitie: string | null = null,
  nu: Date = new Date()
): OverhandigingBevestiging => ({
  projectId,
  overhandigdAt: nu.toISOString(),
  notitie,
});

/** Serialiseert het informatieblad naar leesbare 1-pagina-tekst (voor PDF). */
export const formatInformatieblad = (blad: Informatieblad): string => {
  const p = blad.project;
  const r: string[] = [];
  r.push('VERZEKERING & FINANCIËLE ZEKERHEID');
  r.push('');
  r.push(`Project: ${p.projectnaam}`);
  if (p.adres) r.push(`Adres: ${p.adres}`);
  if (p.gevolgklasse) r.push(`Gevolgklasse: ${p.gevolgklasse}`);
  r.push(`Aannemer: ${blad.aannemer}`);
  if (p.opdrachtgever) r.push(`Opdrachtgever: ${p.opdrachtgever}`);
  r.push(`Datum: ${blad.datum}`);
  r.push('');
  r.push('Wijze van dekking');
  for (const d of blad.dekkingen) {
    r.push(`  • ${dekkingsVormLabel(d.vorm)}`);
    if (d.omschrijving?.trim()) r.push(`    ${d.omschrijving.trim()}`);
    if (d.periode) r.push(`    Periode: ${d.periode}`);
    if (d.bewijsVerwijzing) r.push(`    Bewijs: ${d.bewijsVerwijzing}`);
  }
  r.push('');
  if (blad.ontbrekend.length > 0) {
    r.push('Nog aan te vullen');
    for (const o of blad.ontbrekend) r.push(`  - ${o}`);
    r.push('');
  }
  r.push(blad.ondertekenregel);
  return r.join('\n');
};
