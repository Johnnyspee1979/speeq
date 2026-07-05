/**
 * Verplichte categorieën voor het dossier bevoegd gezag (Gevolgklasse 1).
 *
 * Bij oplevering vraagt de gemeente bij de gereedmelding een dossier met alle
 * relevante technische bouwinformatie + aantoonbaar werken volgens het
 * borgingsplan. Een onvolledig dossier blokkeert de gereedmelding. Deze lijst is
 * de interne checklist — GEEN juridische norm. De aannemer blijft
 * eindverantwoordelijk; de UI formuleert "compleet volgens je eigen checklist".
 *
 * LET OP: deze categorie-lijst is een eerste, redelijke set op basis van de
 * vakpers. Johnny stelt de definitieve lijst vast (vakkennis > wettekst). Pas
 * gerust aan; de service rekent met wat hier staat.
 */

export type DossierAutoBron = 'EVIDENCE' | null;

export interface DossierCategorie {
  /** Stabiele slug — verandert nooit. */
  id: string;
  /** Naam zoals getoond in de checklist. */
  naam: string;
  /** Korte uitleg in mensentaal. */
  omschrijving: string;
  /** Concrete to-do als de categorie nog ontbreekt (geen jargon). */
  todo: string;
  /**
   * Waar SpeeQ deze categorie automatisch uit kan afleiden. `EVIDENCE` = uit
   * vastgelegde bewijscontrolepunten; `null` = alleen handmatig te koppelen.
   */
  autoBron: DossierAutoBron;
  /** Mag deze categorie op n.v.t.? Sommige zijn altijd verplicht. */
  nvtToegestaan: boolean;
}

export const DOSSIER_BEVOEGD_GEZAG_CATEGORIEEN: DossierCategorie[] = [
  {
    id: 'as-built-tekeningen',
    naam: 'As-built tekeningen',
    omschrijving: 'Tekeningen zoals daadwerkelijk gebouwd, inclusief wijzigingen.',
    todo: 'Voeg de definitieve as-built tekeningen toe (zoals daadwerkelijk uitgevoerd).',
    autoBron: null,
    nvtToegestaan: false,
  },
  {
    id: 'constructieberekeningen',
    naam: 'Constructieberekeningen',
    omschrijving: 'Berekeningen van de dragende constructie.',
    todo: 'Koppel de constructieberekeningen van de definitieve constructie.',
    autoBron: null,
    nvtToegestaan: true,
  },
  {
    id: 'keuringsrapporten',
    naam: 'Keuringsrapporten per controlepunt',
    omschrijving: 'Foto- en keuringsbewijs per bewijscontrolepunt uit SpeeQ.',
    todo: 'Leg de ontbrekende controlepunten vast met foto en akkoord.',
    autoBron: 'EVIDENCE',
    nvtToegestaan: false,
  },
  {
    id: 'borgingsplan',
    naam: 'Borgingsplan',
    omschrijving: 'Het plan van de kwaliteitsborger waarop is gecontroleerd.',
    todo: 'Voeg het borgingsplan van de kwaliteitsborger toe.',
    autoBron: null,
    nvtToegestaan: false,
  },
  {
    id: 'afwijkingenregister',
    naam: 'Afwijkingenregister',
    omschrijving: 'Overzicht van afwijkingen en hoe ze zijn hersteld.',
    todo: 'Documenteer de afwijkingen en hun herstel (afwijking-herstel-logboek).',
    autoBron: 'EVIDENCE',
    nvtToegestaan: true,
  },
  {
    id: 'verklaring-kwaliteitsborger',
    naam: 'Verklaring kwaliteitsborger',
    omschrijving: 'De afsluitende verklaring dat gerechtvaardigd vertrouwen bestaat.',
    todo: 'Vraag de afsluitende verklaring bij je kwaliteitsborger op.',
    autoBron: null,
    nvtToegestaan: false,
  },
  {
    id: 'gebruiksfuncties-installaties',
    naam: 'Installaties & gebruiksfuncties',
    omschrijving: 'Bewijs voor installaties (elektra, water, ventilatie, brandveiligheid).',
    todo: 'Leg keuringen van de relevante installaties vast.',
    autoBron: 'EVIDENCE',
    nvtToegestaan: true,
  },
];
