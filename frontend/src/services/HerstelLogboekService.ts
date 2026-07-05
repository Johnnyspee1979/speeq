/**
 * HerstelLogboekService — bouwt de tijdlijn "afgekeurd → hersteld → akkoord" voor
 * één controlepunt uit zijn herstel-record(s), en koppelt dat aan de
 * eerste-keer-goed-indicator.
 *
 * Achtergrond: het review-model bewaart alleen de huidige status (overschrijft
 * bij elke wissel). De keten naar herstel verdwijnt daardoor. Een herstel-record
 * (zie migratie 20260614_herstel_logboek.sql) legt die keten vooruit vast, met
 * eigen tijdstempels per stap zodat de tijdlijn narekenbaar is.
 *
 * Bewust zuiver/offline: geen netwerk. De UI levert de records aan (uit de lokale
 * cache of Supabase) en deze service zet ze om naar een leesbare tijdlijn voor
 * het dossier/de kwaliteitssamenvatting.
 */

import type { ControlepuntReview } from './EersteKeerGoedService';

/** Eén vastgelegd herstel-record, gespiegeld aan public.evidence_herstel. */
export interface HerstelRecord {
  /** Korte omschrijving van de geconstateerde afwijking. */
  afwijking: string;
  /** Moment waarop het punt werd afgekeurd (ISO-tijdstempel). */
  afgekeurdAt: string;
  /** De uitgevoerde herstelactie. */
  herstelactie: string;
  /** Moment waarop het herstel is uitgevoerd (ISO). Optioneel. */
  hersteldAt?: string | null;
  /** Moment van de hercontrole die tot akkoord leidde (ISO). */
  hercontroleAt: string;
  /** Plaats van de hercontrole (vrije tekst of geocode-omschrijving). */
  hercontrolePlaats?: string | null;
  /** Pad naar de hercontrole-foto, indien aanwezig. */
  fotoPath?: string | null;
}

export type HerstelFase = 'AFGEKEURD' | 'HERSTELD' | 'AKKOORD';

export interface TijdlijnStap {
  fase: HerstelFase;
  /** ISO-tijdstempel van deze stap — narekenbaar. */
  tijdstip: string;
  /** Korte, neutrale omschrijving (geen schuldvraag). */
  omschrijving: string;
  /** Plaats, alleen gevuld op de hercontrole-stap. */
  plaats?: string | null;
  fotoPath?: string | null;
}

/**
 * Zet één herstel-record om naar een compacte tijdlijn. De "hersteld"-stap valt
 * weg als er geen `hersteldAt` is vastgelegd (dan blijft afgekeurd → akkoord).
 * Stappen staan chronologisch op tijdstip.
 */
export const buildHerstelTijdlijn = (record: HerstelRecord): TijdlijnStap[] => {
  const stappen: TijdlijnStap[] = [
    {
      fase: 'AFGEKEURD',
      tijdstip: record.afgekeurdAt,
      omschrijving: record.afwijking,
    },
  ];

  if (record.hersteldAt) {
    stappen.push({
      fase: 'HERSTELD',
      tijdstip: record.hersteldAt,
      omschrijving: record.herstelactie,
    });
  }

  stappen.push({
    fase: 'AKKOORD',
    tijdstip: record.hercontroleAt,
    // Zonder aparte "hersteld"-stap dragen we de herstelactie hier mee.
    omschrijving: record.hersteldAt
      ? 'Hercontrole akkoord'
      : `Hersteld en akkoord: ${record.herstelactie}`,
    plaats: record.hercontrolePlaats ?? null,
    fotoPath: record.fotoPath ?? null,
  });

  return stappen.sort(
    (a, b) => new Date(a.tijdstip).getTime() - new Date(b.tijdstip).getTime()
  );
};

/** Bouwt de gecombineerde tijdlijn over meerdere herstel-records (chronologisch). */
export const buildVolledigeHerstelTijdlijn = (
  records: HerstelRecord[]
): TijdlijnStap[] =>
  records
    .flatMap(buildHerstelTijdlijn)
    .sort((a, b) => new Date(a.tijdstip).getTime() - new Date(b.tijdstip).getTime());

/** Heeft dit controlepunt een herstel achter de rug? */
export const heeftHerstel = (records: HerstelRecord[]): boolean =>
  records.length > 0;

/**
 * Koppeling met eerste-keer-goed: een controlepunt met minstens één herstel-record
 * telt nooit als eerste keer goed. Dwingt `everRejected = true` af, consistent met
 * de append-only DB-vlag, zodat de indicator klopt ongeacht hoe de review-rij is
 * meegekomen.
 */
export const koppelEersteKeerGoed = (
  review: ControlepuntReview,
  records: HerstelRecord[]
): ControlepuntReview =>
  heeftHerstel(records)
    ? { ...review, everRejected: true }
    : review;

/** Korte, dossier-klare regel per herstel-record. */
export const formatHerstelRegel = (record: HerstelRecord): string => {
  const datum = new Date(record.hercontroleAt).toLocaleDateString('nl-NL');
  const plaats = record.hercontrolePlaats ? ` (${record.hercontrolePlaats})` : '';
  return (
    `Afwijking: ${record.afwijking}. Herstel: ${record.herstelactie}. ` +
    `Hercontrole akkoord op ${datum}${plaats}.`
  );
};
