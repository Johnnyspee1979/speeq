/**
 * DossierCheckService — rekent de compleetheid van het dossier bevoegd gezag uit.
 *
 * Doel: de aannemer in één oogopslag laten zien of het dossier klaar is voor de
 * gereedmelding. Een onvolledig dossier blokkeert in de praktijk de
 * gereedmelding bij de gemeente. De check is intern ("compleet volgens je eigen
 * checklist") — geen juridische claim, geen automatische melding.
 *
 * Zuiver en offline: de UI/sync levert de status per categorie aan (handmatig +
 * automatisch gedekt uit bewijscontrolepunten), deze service aggregeert tot
 * score, status-kleur en een "wat ontbreekt nog"-lijst in mensentaal.
 */

import {
  DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN,
  type DossierCategorie,
} from '../config/dossierBevoegdGezag';

export type CategorieStatus = 'AANWEZIG' | 'ONTBREEKT' | 'NVT';

/** Status per categorie zoals vastgelegd (handmatig of automatisch). */
export interface ChecklistItemState {
  categorieId: string;
  status: CategorieStatus;
  /** Verplicht bij NVT: waarom niet van toepassing. */
  nvtReden?: string | null;
}

export type DossierStatusKleur = 'rood' | 'oranje' | 'groen';

export interface OntbrekendItem {
  categorieId: string;
  naam: string;
  todo: string;
}

export interface DossierCompleetheid {
  /** 0–100, afgerond. Noemer = verplichte categorieën die niet n.v.t. zijn. */
  score: number;
  statusKleur: DossierStatusKleur;
  /** Klaar voor gereedmelding: alle niet-n.v.t. categorieën aanwezig. */
  gereed: boolean;
  aanwezig: number;
  /** Aantal categorieën dat meetelt (totaal − n.v.t.). */
  verplicht: number;
  ontbrekend: OntbrekendItem[];
}

const statusVoor = (
  states: ChecklistItemState[],
  categorieId: string
): CategorieStatus => {
  const match = states.find((s) => s.categorieId === categorieId);
  return match?.status ?? 'ONTBREEKT';
};

/**
 * Past automatische dekking toe: categorieën met `autoBron: 'EVIDENCE'` worden op
 * AANWEZIG gezet als hun id in `automatischGedekt` zit — tenzij de aannemer ze
 * handmatig al op NVT heeft gezet (handmatig wint, behalve dat bewijs nooit
 * "ontbreekt" mag blijven als het er aantoonbaar is).
 */
export const pasAutomatischeDekkingToe = (
  states: ChecklistItemState[],
  automatischGedekt: string[],
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): ChecklistItemState[] => {
  const gedekt = new Set(automatischGedekt);
  const result: ChecklistItemState[] = categorieen.map((cat) => {
    const bestaand = states.find((s) => s.categorieId === cat.id);
    if (bestaand?.status === 'NVT') return bestaand;
    if (cat.autoBron === 'EVIDENCE' && gedekt.has(cat.id)) {
      return { categorieId: cat.id, status: 'AANWEZIG' };
    }
    return bestaand ?? { categorieId: cat.id, status: 'ONTBREEKT' };
  });
  return result;
};

/**
 * Aggregeert naar score + status + ontbreeklijst. Status wordt pas groen als
 * álle niet-n.v.t. categorieën aanwezig zijn.
 */
export const computeCompleteness = (
  states: ChecklistItemState[],
  categorieen: DossierCategorie[] = DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN
): DossierCompleetheid => {
  let aanwezig = 0;
  let verplicht = 0;
  const ontbrekend: OntbrekendItem[] = [];

  for (const cat of categorieen) {
    const status = statusVoor(states, cat.id);
    if (status === 'NVT') continue; // telt niet mee in de noemer
    verplicht += 1;
    if (status === 'AANWEZIG') {
      aanwezig += 1;
    } else {
      ontbrekend.push({ categorieId: cat.id, naam: cat.naam, todo: cat.todo });
    }
  }

  const score = verplicht === 0 ? 100 : Math.round((aanwezig / verplicht) * 100);
  const gereed = verplicht > 0 ? aanwezig === verplicht : true;

  let statusKleur: DossierStatusKleur;
  if (gereed) {
    statusKleur = 'groen';
  } else if (score >= 50) {
    statusKleur = 'oranje';
  } else {
    statusKleur = 'rood';
  }

  return { score, statusKleur, gereed, aanwezig, verplicht, ontbrekend };
};
