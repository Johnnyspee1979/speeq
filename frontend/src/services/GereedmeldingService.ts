/**
 * GereedmeldingService — stelt het "dossier bevoegd gezag" samen voor de
 * gereedmelding van een GK1-nieuwbouwproject, bewaakt de compleetheid vóór
 * indienen en rekent de wettelijke tweeweken-klok van het bevoegd gezag uit.
 *
 * Context: bij de gereedmelding dient de aannemer het dossier bevoegd gezag in
 * (incl. de verklaring van de kwaliteitsborger). Vanaf dat moment heeft de
 * gemeente 14 dagen om te beoordelen of de melding compleet is. Ontbreekt er iets,
 * dan mag het bouwwerk formeel niet in gebruik. De klok beweegt niet mee met de
 * politiek — die staat in de wet.
 *
 * Dit pakket staat LOS van het opleverdossier voor de klant. Geen automatische
 * indiening; SpeeQ stelt samen en bewaakt, het indienen blijft een bewuste
 * handeling van de aannemer. Zuiver/offline: geen serverafhankelijkheid.
 */

import type {
  ChecklistItemState,
  DossierCompleetheid,
  OntbrekendItem,
} from './DossierCheckService';

/** Wettelijke reactietermijn van het bevoegd gezag, in dagen. */
export const REACTIETERMIJN_DAGEN = 14;

const MS_PER_DAG = 24 * 60 * 60 * 1000;

/** De borgersverklaring is de meest voorkomende blokker — apart geflagd. */
export const BORGERSVERKLARING_CATEGORIE_ID = 'verklaring-kwaliteitsborger';

/** Uiterste reactiedatum: gereedmelding + 14 dagen (ISO). */
export const berekenUitersteReactiedatum = (gereedmeldAtISO: string): string => {
  const d = new Date(gereedmeldAtISO);
  return new Date(d.getTime() + REACTIETERMIJN_DAGEN * MS_PER_DAG).toISOString();
};

export interface KlokStatus {
  gereedmeldAt: string;
  uiterste: string;
  /** Resterende hele dagen tot de uiterste datum (0 als verstreken). */
  dagenResterend: number;
  /** Is de reactietermijn al voorbij? */
  verstreken: boolean;
}

/**
 * Rekent de tweeweken-klok uit t.o.v. "nu". `dagenResterend` is naar boven
 * afgerond (een halve dag telt nog als een resterende dag) en geklemd op 0.
 */
export const berekenKlok = (
  gereedmeldAtISO: string,
  nuISO: string
): KlokStatus => {
  const uiterste = berekenUitersteReactiedatum(gereedmeldAtISO);
  const msResterend = new Date(uiterste).getTime() - new Date(nuISO).getTime();
  const verstreken = msResterend <= 0;
  const dagenResterend = verstreken ? 0 : Math.ceil(msResterend / MS_PER_DAG);
  return { gereedmeldAt: gereedmeldAtISO, uiterste, dagenResterend, verstreken };
};

export interface GereedmeldOordeel {
  /** Klaar om in te dienen: dossier compleet én borgersverklaring aanwezig. */
  gereed: boolean;
  /** Expliciete vlag: de borgersverklaring ontbreekt (meest voorkomende blokker). */
  borgersverklaringOntbreekt: boolean;
  /** Alles wat nog mist (uit de compleetheidscheck). */
  blokkers: OntbrekendItem[];
}

const statusVoor = (states: ChecklistItemState[], id: string) =>
  states.find((s) => s.categorieId === id)?.status ?? 'ONTBREEKT';

/**
 * Beoordeelt of het gereedmeld-pakket de gereedmelding gaat halen. Combineert de
 * generieke compleetheid met de expliciete borgersverklaring-vlag, zodat de UI
 * die blokker apart en nadrukkelijk kan tonen.
 */
export const beoordeelGereedmeldPakket = (
  completeness: DossierCompleetheid,
  states: ChecklistItemState[]
): GereedmeldOordeel => {
  const borgersverklaringOntbreekt =
    statusVoor(states, BORGERSVERKLARING_CATEGORIE_ID) !== 'AANWEZIG';
  return {
    gereed: completeness.gereed,
    borgersverklaringOntbreekt,
    blokkers: completeness.ontbrekend,
  };
};

/** Korte, dossier-klare regel over de klok-status. */
export const formatKlokRegel = (klok: KlokStatus): string => {
  const datum = new Date(klok.uiterste).toLocaleDateString('nl-NL');
  if (klok.verstreken) {
    return `Reactietermijn bevoegd gezag verstreken (uiterste datum was ${datum}).`;
  }
  return `Bevoegd gezag heeft tot ${datum} om te reageren — nog ${klok.dagenResterend} dag(en).`;
};
