/**
 * GevolgklasseService — lichte, read-only GK1-intake. Geeft een **indicatie** of
 * een project onder gevolgklasse 1 valt (Wkb-spoor: bouwmelding + kwaliteitsborger),
 * geen juridisch bindend advies. Bij twijfel: verwijzen naar gemeente of borger.
 *
 * Zuiver: pure `bepaalGevolgklasse(antwoorden)`. Opslag/UI zit eromheen.
 *
 * Bron (zie docs/wkb/gevolgklasse-intake.md):
 * - Wkb sinds 1-1-2024, nu alleen GK1 (grondgebonden eengezinswoningen, kleine
 *   bedrijfsgebouwen). GK2/GK3 nog niet (evaluatie, uiterlijk 1-1-2027).
 * - Combinatie-regel: GK1 + GK2 die één bouwkundige eenheid vormen → hoogste
 *   klasse telt voor het geheel. Bouwkundig losse gebouwen → elk eigen spoor.
 */

export type BouwwerkType =
  | 'grondgebonden-woning'
  | 'klein-bedrijfsgebouw'
  | 'appartementen'
  | 'winkel-plus-wonen'
  | 'anders';

export type Fase = 'nieuwbouw' | 'verbouw';

/** Hoe meerdere bouwwerken zich tot elkaar verhouden. */
export type Samenstelling = 'een-eenheid' | 'losse-gebouwen';

export type Basisklasse = 'GK1' | 'HOGER' | 'GEMENGD' | 'ONBEKEND';

export type Uitkomst = 'GK1' | 'BUITEN_GK1' | 'TWIJFEL';
export type UitkomstKleur = 'groen' | 'navy' | 'oranje';

export interface GevolgklasseAntwoorden {
  type: BouwwerkType;
  fase?: Fase;
  /** Meerdere bouwwerken op één project? */
  meerdereBouwwerken?: boolean;
  /** Alleen relevant bij meerdereBouwwerken: één eenheid of losse gebouwen. */
  samenstelling?: Samenstelling;
}

export interface GevolgklasseResultaat {
  uitkomst: Uitkomst;
  kleur: UitkomstKleur;
  basis: Basisklasse;
  /** Korte uitleg waarom deze uitkomst. */
  uitleg: string;
  /** Advies / vervolgactie voor de aannemer. */
  advies: string;
  /** Nooit blokkeren — alleen waarschuwen bij niet-groen. */
  waarschuwen: boolean;
}

const BASIS_PER_TYPE: Record<BouwwerkType, Basisklasse> = {
  'grondgebonden-woning': 'GK1',
  'klein-bedrijfsgebouw': 'GK1',
  appartementen: 'HOGER',
  'winkel-plus-wonen': 'GEMENGD',
  anders: 'ONBEKEND',
};

const GK1: GevolgklasseResultaat = {
  uitkomst: 'GK1',
  kleur: 'groen',
  basis: 'GK1',
  uitleg: 'Dit type valt onder gevolgklasse 1.',
  advies: 'Volg het GK1-spoor: bouwmelding + kwaliteitsborger.',
  waarschuwen: false,
};

const buitenGk1 = (uitleg: string): GevolgklasseResultaat => ({
  uitkomst: 'BUITEN_GK1',
  kleur: 'navy',
  basis: 'HOGER',
  uitleg,
  advies:
    'Dit valt (nu nog) buiten gevolgklasse 1 — overleg met gemeente over het juiste spoor.',
  waarschuwen: true,
});

const twijfel = (uitleg: string, basis: Basisklasse): GevolgklasseResultaat => ({
  uitkomst: 'TWIJFEL',
  kleur: 'oranje',
  basis,
  uitleg,
  advies:
    'We kunnen dit niet zelfverzekerd plaatsen — vraag het na bij gemeente of kwaliteitsborger.',
  waarschuwen: true,
});

/**
 * Bepaalt de indicatieve gevolgklasse-uitkomst. Liever een eerlijk TWIJFEL dan
 * een zelfverzekerd verkeerd antwoord. Nooit blokkeren.
 */
export const bepaalGevolgklasse = (
  antwoorden: GevolgklasseAntwoorden
): GevolgklasseResultaat => {
  const basis = BASIS_PER_TYPE[antwoorden.type] ?? 'ONBEKEND';

  // Enkel bouwwerk: basis bepaalt de uitkomst.
  if (!antwoorden.meerdereBouwwerken) {
    if (basis === 'GK1') return GK1;
    if (basis === 'HOGER') {
      return buitenGk1('Dit type heeft een hogere gevolgklasse dan GK1 (bijv. appartementen).');
    }
    if (basis === 'GEMENGD') {
      return twijfel(
        'Gemengd gebruik (winkel + wonen): de gevolgklasse hangt af van de bouwkundige eenheid.',
        basis
      );
    }
    return twijfel('Type onbekend — niet eenduidig in te delen.', basis);
  }

  // Meerdere bouwwerken: combinatie-regel.
  if (antwoorden.samenstelling === 'losse-gebouwen') {
    // Bouwkundig te onderscheiden gebouwen → elk volgt zijn eigen spoor.
    if (basis === 'GK1') {
      return {
        ...GK1,
        uitleg:
          'Losse, bouwkundig te onderscheiden gebouwen — het GK1-deel volgt zijn eigen spoor.',
      };
    }
    if (basis === 'HOGER') {
      return buitenGk1(
        'Losse gebouwen, maar dit gebouw heeft zelf een hogere gevolgklasse dan GK1.'
      );
    }
    return twijfel(
      'Losse gebouwen met gemengd/onbekend type — beoordeel per gebouw met gemeente/borger.',
      basis
    );
  }

  if (antwoorden.samenstelling === 'een-eenheid') {
    // Eén bouwkundige eenheid → hoogste gevolgklasse telt voor het geheel.
    if (basis === 'GK1') {
      return {
        ...GK1,
        uitleg:
          'Eén bouwkundige eenheid die volledig GK1 is — de hoogste klasse blijft GK1.',
      };
    }
    if (basis === 'HOGER') {
      return buitenGk1(
        'Eén bouwkundige eenheid waarin een hogere klasse meedoet — de hoogste klasse telt voor het geheel.'
      );
    }
    return twijfel(
      'Eén bouwkundige eenheid met gemengd/onbekend type — vraag de indeling na bij gemeente/borger.',
      basis
    );
  }

  // Meerdere bouwwerken, maar samenstelling niet opgegeven → kunnen we niet plaatsen.
  return twijfel(
    'Meerdere bouwwerken, maar onbekend of het één eenheid of losse gebouwen zijn.',
    basis
  );
};

/** Korte regel voor in de UI/dossier. */
export const formatGevolgklasseRegel = (r: GevolgklasseResultaat): string => {
  const label =
    r.uitkomst === 'GK1'
      ? 'Valt onder GK1'
      : r.uitkomst === 'BUITEN_GK1'
        ? 'Buiten GK1'
        : 'Twijfel — navragen';
  return `${label} · ${r.uitleg}`;
};
