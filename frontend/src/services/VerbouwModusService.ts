/**
 * VerbouwModusService — projecttype-splitsing tussen GK1-nieuwbouw en de
 * vrijwillige verbouw-modus. Pure, testbare logica: filtert de wettelijke
 * dossieronderdelen weg/markeert ze als n.v.t. bij verbouw, en levert een
 * eerlijke disclaimer.
 *
 * Belangrijk: verbouw valt (nu nog) NIET onder de Wkb. Een verbouwdossier is een
 * vrijwillig privaat kwaliteitsdossier, GEEN formeel dossier bevoegd gezag. We
 * tonen wettelijke stappen niet als open taak, maar markeren ze als "nog niet van
 * toepassing". De bestaande GK1-flow blijft volledig ongewijzigd.
 *
 * Zie docs/wkb/verbouw-modus.md voor de afbakening en bronnen.
 */

import {
  type DossierCategorie,
  DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN,
} from '../config/dossierBevoegdGezag';

export type Projecttype = 'gk1' | 'verbouw';

/** Dossiercategorieën die zuiver wettelijk (Wkb-GK1) zijn — n.v.t. bij verbouw. */
export const WETTELIJK_ALLEEN_GK1_CATEGORIEEN: readonly string[] = [
  'borgingsplan',
  'verklaring-kwaliteitsborger',
];

/** Wettelijke Wkb-stappen die voor verbouw (nog) niet gelden. */
export type WettelijkeStap = 'bouwmelding' | 'verklaring-kwaliteitsborger' | 'gereedmelding';

export const WETTELIJKE_STAPPEN: readonly WettelijkeStap[] = [
  'bouwmelding',
  'verklaring-kwaliteitsborger',
  'gereedmelding',
];

export const VERBOUW_DISCLAIMER =
  'Dit is een vrijwillig privaat kwaliteitsdossier voor verbouw/renovatie — ' +
  'geen wettelijk verplicht Wkb-dossier en geen formeel dossier bevoegd gezag. ' +
  'Verbouw valt op dit moment nog niet onder de Wet kwaliteitsborging voor het bouwen.';

export type ToepasselijkheidStatus = 'VAN_TOEPASSING' | 'NIET_VAN_TOEPASSING';

export interface DossierOnderdeelView extends DossierCategorie {
  status: ToepasselijkheidStatus;
  /** Reden bij NIET_VAN_TOEPASSING. */
  reden?: string;
}

export interface WettelijkeStapView {
  stap: WettelijkeStap;
  status: ToepasselijkheidStatus;
  reden?: string;
}

const NVT_REDEN_VERBOUW = 'Valt nog niet onder de Wkb — niet van toepassing bij verbouw.';

/** Is dit projecttype een vrijwillig (privaat) dossier? */
export const isVrijwilligDossier = (type: Projecttype): boolean => type === 'verbouw';

/**
 * Filtert/markeert de dossiercategorieën op basis van projecttype. GK1 → alles
 * van toepassing; verbouw → wettelijke onderdelen gemarkeerd als n.v.t. (nooit
 * verwijderd, zodat het dossier eerlijk laat zien wát niet geldt).
 */
export const filterDossierVoorProjecttype = (
  type: Projecttype,
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): DossierOnderdeelView[] =>
  categorieen.map((cat) => {
    if (type === 'verbouw' && WETTELIJK_ALLEEN_GK1_CATEGORIEEN.includes(cat.id)) {
      return { ...cat, status: 'NIET_VAN_TOEPASSING', reden: NVT_REDEN_VERBOUW };
    }
    return { ...cat, status: 'VAN_TOEPASSING' };
  });

/** Alleen de dossieronderdelen die voor dit projecttype daadwerkelijk gelden. */
export const actieveCategorieen = (
  type: Projecttype,
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): DossierOnderdeelView[] =>
  filterDossierVoorProjecttype(type, categorieen).filter(
    (c) => c.status === 'VAN_TOEPASSING'
  );

/** Status van de wettelijke Wkb-stappen per projecttype. */
export const wettelijkeStappenStatus = (type: Projecttype): WettelijkeStapView[] =>
  WETTELIJKE_STAPPEN.map((stap) =>
    type === 'verbouw'
      ? { stap, status: 'NIET_VAN_TOEPASSING', reden: NVT_REDEN_VERBOUW }
      : { stap, status: 'VAN_TOEPASSING' }
  );

/** Disclaimer-regel voor project/export; leeg voor GK1 (geen disclaimer nodig). */
export const disclaimerVoorProjecttype = (type: Projecttype): string =>
  isVrijwilligDossier(type) ? VERBOUW_DISCLAIMER : '';

/** Kort label voor in de UI. */
export const projecttypeLabel = (type: Projecttype): string =>
  type === 'verbouw'
    ? 'Verbouw / renovatie (vrijwillig dossier)'
    : 'Nieuwbouw GK1 (Wkb)';
