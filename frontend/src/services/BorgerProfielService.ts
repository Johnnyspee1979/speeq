/**
 * BorgerProfielService — presentatie-/exportlaag die het bestaande projectdossier
 * rendert in de vorm die de gekozen kwaliteitsborger verwacht.
 *
 * Context: het aantal borgers groeit; elke borger/instrument wil een net
 * aangeleverd dossier op zijn manier (eigen volgorde, eigen verplichte rubrieken,
 * eigen bestandsnaam). SpeeQ legt het bewijs al per project vast. Dit is een
 * dunne laag erbovenop: zelfde inhoud en bewijs, andere ordening/labels. De
 * brondata verandert NIET; de standaard-export blijft de fallback.
 *
 * Hergebruikt de compleetheidscheck (DossierCheckService) — niet dupliceren — en
 * past die toe op de door het profiel verplicht gestelde rubrieken.
 */

import {
  computeCompleteness,
  type ChecklistItemState,
  type CategorieStatus,
  type DossierCompleetheid,
} from './DossierCheckService';
import {
  DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN,
  type DossierCategorie,
} from '../config/dossierBevoegdGezag';

export interface BorgerProfiel {
  id: string;
  /** Naam van de borger of het instrument. */
  naam: string;
  instrument?: string | null;
  /** Gewenste volgorde van rubrieken (categorie-ids). Onbekende ids worden genegeerd. */
  rubriekVolgorde: string[];
  /** Categorie-ids die dit profiel verplicht stelt. */
  verplichteCategorieen: string[];
  /** Sjabloon voor de exportbestandsnaam. Tokens: {project} {borger} {datum}. */
  bestandsnaamSjabloon?: string;
}

export const DEFAULT_BESTANDSNAAM_SJABLOON = 'WKB_{project}_{borger}_{datum}';

const statusVoor = (
  states: ChecklistItemState[],
  categorieId: string
): CategorieStatus =>
  states.find((s) => s.categorieId === categorieId)?.status ?? 'ONTBREEKT';

export interface GerenderdeRubriek {
  categorieId: string;
  naam: string;
  status: CategorieStatus;
  verplichtVoorProfiel: boolean;
}

/**
 * Rendert het dossier volgens het profiel: eerst de rubrieken in de profiel-
 * volgorde, daarna de overige categorieën in hun eigen volgorde. Inhoud blijft
 * gelijk; alleen ordening + "verplicht voor dit profiel"-markering verschilt.
 */
export const renderDossierVoorProfiel = (
  profiel: BorgerProfiel,
  states: ChecklistItemState[],
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): GerenderdeRubriek[] => {
  const byId = new Map(categorieen.map((c) => [c.id, c]));
  const verplichtSet = new Set(profiel.verplichteCategorieen);

  const geordendeIds = [
    ...profiel.rubriekVolgorde.filter((id) => byId.has(id)),
    ...categorieen
      .map((c) => c.id)
      .filter((id) => !profiel.rubriekVolgorde.includes(id)),
  ];

  return geordendeIds.map((id) => {
    const cat = byId.get(id)!;
    return {
      categorieId: id,
      naam: cat.naam,
      status: statusVoor(states, id),
      verplichtVoorProfiel: verplichtSet.has(id),
    };
  });
};

/**
 * Compleetheidssignaal voor dit profiel: hergebruikt computeCompleteness, maar
 * alleen op de door het profiel verplicht gestelde categorieën. Zo zie je vóór
 * verzenden welke profiel-rubrieken nog leeg zijn.
 */
export const profielCompleetheid = (
  profiel: BorgerProfiel,
  states: ChecklistItemState[],
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): DossierCompleetheid => {
  const verplichtSet = new Set(profiel.verplichteCategorieen);
  const subset = categorieen.filter((c) => verplichtSet.has(c.id));
  return computeCompleteness(states, subset);
};

/** Vult het bestandsnaam-sjabloon in. Datum als YYYY-MM-DD; tekens opgeschoond. */
export const formatBestandsnaam = (
  profiel: BorgerProfiel,
  vars: { project: string; datumISO: string }
): string => {
  const sjabloon = profiel.bestandsnaamSjabloon ?? DEFAULT_BESTANDSNAAM_SJABLOON;
  const datum = new Date(vars.datumISO).toISOString().slice(0, 10);
  const schoon = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
  return sjabloon
    .replace('{project}', schoon(vars.project))
    .replace('{borger}', schoon(profiel.naam))
    .replace('{datum}', datum);
};
