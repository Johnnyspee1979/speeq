/**
 * GratisChecklistService — functionele kern achter de gratis WKB-checklist
 * (lead-magnet). De checklist-inhoud (vendor-neutraal, mensentaal) + de validatie
 * van de zachte e-mail-capture. De publieke landingspagina + PDF-export zitten
 * eromheen (visuele laag).
 *
 * Zuiver: geen netwerk, geen opslag. De checklist-state leeft in de UI (useState,
 * géén browser-storage). Lead-capture is optioneel en alleen met expliciete
 * opt-in; deze service valideert/normaliseert vóór insert in `leads_checklist`
 * (master-DB, insert-only).
 *
 * Zie docs/marketing/wkb-checklist-content.md.
 */

export const CHECKLIST_BRON = 'gratis-wkb-checklist';

export interface ChecklistItem {
  id: string;
  tekst: string;
}

export interface ChecklistBlok {
  id: string;
  titel: string;
  items: ChecklistItem[];
}

/** De checklist zelf — drie logische blokken, in mensentaal, vendor-neutraal. */
export const WKB_CHECKLIST: ChecklistBlok[] = [
  {
    id: 'voorbereiding',
    titel: 'Voorbereiding & bouwmelding',
    items: [
      { id: 'vb-1', tekst: 'Gevolgklasse bepaald (valt het werk onder GK1?)' },
      { id: 'vb-2', tekst: 'Kwaliteitsborger gekozen en aangesteld' },
      { id: 'vb-3', tekst: 'Risicobeoordeling en borgingsplan ontvangen' },
      { id: 'vb-4', tekst: 'Bouwmelding minimaal 4 weken vóór start ingediend' },
      { id: 'vb-5', tekst: 'Opdrachtgever vooraf geïnformeerd over verzekering/financiële zekerheid' },
    ],
  },
  {
    id: 'uitvoering',
    titel: 'Uitvoering & controlepunten',
    items: [
      { id: 'uv-1', tekst: 'Controlepunten uit het borgingsplan in beeld' },
      { id: 'uv-2', tekst: 'Foto bij elk controlepunt, met tijdstempel en locatie' },
      { id: 'uv-3', tekst: 'Afwijkingen vastgelegd én herstel gedocumenteerd' },
      { id: 'uv-4', tekst: 'Keuringsrapporten en as-built tekeningen verzameld' },
      { id: 'uv-5', tekst: 'Borger heeft tussentijds kunnen meekijken' },
    ],
  },
  {
    id: 'oplevering',
    titel: 'Oplevering & consumentendossier',
    items: [
      { id: 'op-1', tekst: 'Verklaring van de kwaliteitsborger compleet' },
      { id: 'op-2', tekst: 'Opleverdossier voor bevoegd gezag samengesteld' },
      { id: 'op-3', tekst: 'Consumentendossier aan de opdrachtgever overhandigd' },
      { id: 'op-4', tekst: 'Gereedmelding minimaal 2 weken vóór ingebruikname' },
      { id: 'op-5', tekst: 'Alle bewijslast in één overdraagbaar dossier (PDF + bestanden)' },
    ],
  },
];

/** Telt totaal aantal items en hoeveel ervan zijn afgevinkt. */
export const checklistVoortgang = (
  afgevinkt: string[],
  checklist: ChecklistBlok[] = WKB_CHECKLIST
): { totaal: number; gedaan: number; procent: number } => {
  const alleIds = new Set(checklist.flatMap((b) => b.items.map((i) => i.id)));
  const gedaan = afgevinkt.filter((id) => alleIds.has(id)).length;
  const totaal = alleIds.size;
  const procent = totaal === 0 ? 0 : Math.round((gedaan / totaal) * 100);
  return { totaal, gedaan, procent };
};

// ── Lead-capture (optioneel, expliciete opt-in) ──────────────────────────────

export interface LeadAanmelding {
  email: string;
  optIn: boolean;
  bron?: string;
}

export interface LeadValidatie {
  geldig: boolean;
  fouten: string[];
  genormaliseerd?: { email: string; bron: string };
}

// Bewust simpel: één @ met iets ervoor en een domein met een punt erna.
const EMAIL_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valideert + normaliseert een lead-aanmelding. E-mail moet geldig zijn en de
 * opt-in moet expliciet `true` zijn (geen vooraangevinkt vakje). Zonder geldige
 * aanmelding blijft de checklist gewoon bruikbaar — dit is geen muur.
 */
export const valideerLeadAanmelding = (input: LeadAanmelding): LeadValidatie => {
  const fouten: string[] = [];
  const email = String(input.email ?? '').trim().toLowerCase();

  if (!email) {
    fouten.push('E-mailadres is leeg.');
  } else if (!EMAIL_PATROON.test(email)) {
    fouten.push('E-mailadres lijkt ongeldig.');
  }
  if (input.optIn !== true) {
    fouten.push('Expliciete opt-in ontbreekt.');
  }

  if (fouten.length > 0) return { geldig: false, fouten };
  return {
    geldig: true,
    fouten: [],
    genormaliseerd: { email, bron: input.bron?.trim() || CHECKLIST_BRON },
  };
};
