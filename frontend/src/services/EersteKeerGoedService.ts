/**
 * EersteKeerGoedService — leidt het "eerste keer goed"-percentage af uit de
 * review-status van controlepunten.
 *
 * Achtergrond: het TloKB-jaarverslag 2025 meldt dat zónder kwaliteitsborger ~39%
 * van de GK1-projecten in één keer aan de technische bouweisen voldoet, en mét
 * borger ruim 60%. Dat maakt "eerste keer goed" een meetbaar, vergelijkbaar
 * kwaliteitscijfer dat een aannemer naast de landelijke referentie kan tonen.
 *
 * Een controlepunt is "eerste keer goed" als het uiteindelijk akkoord is
 * (APPROVED of FINALIZED) én het nooit is afgekeurd (`everRejected = false`).
 * `everRejected` wordt append-only door de DB-RPC gezet — zie migratie
 * 20260614_eerste_keer_goed.sql.
 *
 * Bewust een zuivere, offline berekening: geen netwerk, geen benchmark-API. De
 * landelijke cijfers staan als vaste, geciteerde context (geen harde norm).
 */

export type ReviewStatusLike =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FINALIZED'
  | null
  | undefined;

export interface ControlepuntReview {
  reviewStatus: ReviewStatusLike;
  /** Append-only vlag: punt is ooit afgekeurd geweest. */
  everRejected?: boolean | null;
}

/** Landelijke referentie uit het TloKB-jaarverslag 2025. Geen norm — context. */
export const TLOKB_REFERENTIE = {
  bron: 'TloKB-jaarverslag 2025',
  zonderBorgerPct: 39,
  metBorgerPct: 60,
  metBorgerOngeveer: true,
} as const;

/** Een punt telt mee in het cijfer zodra het definitief beoordeeld is. */
const isAfgerond = (status: ReviewStatusLike): boolean =>
  status === 'APPROVED' || status === 'FINALIZED';

/**
 * Eerste keer goed voor één controlepunt.
 * - `true`  : akkoord én nooit afgekeurd
 * - `false` : akkoord maar ooit afgekeurd (na herstel)
 * - `null`  : nog niet afgerond (PENDING_REVIEW/REJECTED) → telt niet mee
 */
export const isEersteKeerGoed = (row: ControlepuntReview): boolean | null => {
  if (!isAfgerond(row.reviewStatus)) {
    return null;
  }
  return !row.everRejected;
};

export interface EersteKeerGoedResultaat {
  /** Aantal afgeronde (beoordeelde) controlepunten dat meetelt. */
  afgerond: number;
  /** Daarvan eerste keer goed. */
  eersteKeerGoed: number;
  /** Percentage 0–100, afgerond op heel getal. `null` als er nog niets afgerond is. */
  percentage: number | null;
}

/**
 * Aggregeert over een set controlepunten (één project, of alle projecten van een
 * tenant). Alleen afgeronde punten tellen mee in de noemer.
 */
export const berekenEersteKeerGoed = (
  rows: ControlepuntReview[]
): EersteKeerGoedResultaat => {
  let afgerond = 0;
  let eersteKeerGoed = 0;

  for (const row of rows) {
    const ekg = isEersteKeerGoed(row);
    if (ekg === null) continue;
    afgerond += 1;
    if (ekg) eersteKeerGoed += 1;
  }

  const percentage =
    afgerond === 0 ? null : Math.round((eersteKeerGoed / afgerond) * 100);

  return { afgerond, eersteKeerGoed, percentage };
};

/**
 * Korte, dossier-/samenvatting-klare regel. Geeft `null` als er nog niets
 * afgerond is (dan tonen we geen misleidend cijfer).
 */
export const formatEersteKeerGoedRegel = (
  resultaat: EersteKeerGoedResultaat
): string | null => {
  if (resultaat.percentage === null) {
    return null;
  }
  const { percentage, eersteKeerGoed, afgerond } = resultaat;
  return (
    `Eerste keer goed: ${percentage}% (${eersteKeerGoed}/${afgerond}). ` +
    `Landelijk ${TLOKB_REFERENTIE.zonderBorgerPct}% zonder en ruim ` +
    `${TLOKB_REFERENTIE.metBorgerPct}% mét kwaliteitsborger ` +
    `(bron: ${TLOKB_REFERENTIE.bron}).`
  );
};
