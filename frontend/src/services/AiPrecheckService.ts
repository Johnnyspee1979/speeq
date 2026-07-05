/**
 * AiPrecheckService — optionele AI-precheck bij een controlepunt-foto. Het model
 * stelt een gebrek-/observatie-omschrijving + categorie voor; de gebruiker
 * accepteert, past aan of negeert. NOOIT automatisch invullen zonder akkoord.
 *
 * Offline-first: zonder netwerk gaat de precheck-taak in een lokale queue
 * (IN_AFWACHTING) en draait later na. De controle zelf blokkeert nooit op de AI.
 * De modelcall loopt via een Supabase Edge Function (sleutel = server-side
 * secret), niet rechtstreeks vanuit de client.
 *
 * Zuiver: een testbare statusmachine + een precheck-aanroep met injecteerbare
 * transport-functie. Zie docs/wkb/ai-precheck-foto.md.
 */

export type PrecheckStatus =
  | 'IN_AFWACHTING'
  | 'BEZIG'
  | 'VOORSTEL_KLAAR'
  | 'MISLUKT';

export type PrecheckCategorie =
  | 'constructie'
  | 'gevel'
  | 'installatie'
  | 'afbouw'
  | 'overig';

export interface PrecheckVoorstel {
  omschrijving: string;
  categorie: PrecheckCategorie;
  /** Modelzekerheid 0–1. */
  zekerheid: number;
}

export interface PrecheckTaak {
  fotoRef: string;
  controlepuntId: string;
  status: PrecheckStatus;
  voorstel?: PrecheckVoorstel;
  foutmelding?: string;
  aangemaaktAt: string;
}

export type ZekerheidsLabel = 'hoog' | 'midden' | 'laag';

/** Vertaalt de modelzekerheid naar een label voor de UI. */
export const zekerheidsLabel = (zekerheid: number): ZekerheidsLabel => {
  if (zekerheid >= 0.8) return 'hoog';
  if (zekerheid >= 0.5) return 'midden';
  return 'laag';
};

/** Maakt een nieuwe precheck-taak. Start altijd in de queue (IN_AFWACHTING). */
export const maakPrecheckTaak = (
  fotoRef: string,
  controlepuntId: string,
  aangemaaktAt: string = new Date().toISOString()
): PrecheckTaak => ({
  fotoRef,
  controlepuntId,
  status: 'IN_AFWACHTING',
  aangemaaktAt,
});

/** Zet een wachtende taak op BEZIG (alleen vanuit IN_AFWACHTING of MISLUKT). */
export const markeerBezig = (taak: PrecheckTaak): PrecheckTaak => {
  if (taak.status !== 'IN_AFWACHTING' && taak.status !== 'MISLUKT') return taak;
  return { ...taak, status: 'BEZIG', foutmelding: undefined };
};

/** Verwerkt een ontvangen voorstel → VOORSTEL_KLAAR. */
export const verwerkVoorstel = (
  taak: PrecheckTaak,
  voorstel: PrecheckVoorstel
): PrecheckTaak => ({
  ...taak,
  status: 'VOORSTEL_KLAAR',
  voorstel,
  foutmelding: undefined,
});

/** Markeert een mislukte precheck (blokkeert de workflow niet). */
export const markeerMislukt = (
  taak: PrecheckTaak,
  foutmelding: string
): PrecheckTaak => ({
  ...taak,
  status: 'MISLUKT',
  foutmelding,
});

/** Zet een mislukte taak terug in de queue om opnieuw te proberen. */
export const opnieuwProberen = (taak: PrecheckTaak): PrecheckTaak => {
  if (taak.status !== 'MISLUKT') return taak;
  return { ...taak, status: 'IN_AFWACHTING', foutmelding: undefined };
};

export interface GeaccepteerdVoorstel {
  omschrijving: string;
  categorie: PrecheckCategorie;
}

/**
 * Accepteert het voorstel, optioneel met aanpassing door de gebruiker. Geeft
 * `null` terug als er (nog) geen voorstel klaarstaat — de service vult nooit
 * iets zelf in. De caller slaat het resultaat daarna bewust op.
 */
export const accepteerVoorstel = (
  taak: PrecheckTaak,
  aanpassing?: Partial<GeaccepteerdVoorstel>
): GeaccepteerdVoorstel | null => {
  if (taak.status !== 'VOORSTEL_KLAAR' || !taak.voorstel) return null;
  return {
    omschrijving: aanpassing?.omschrijving ?? taak.voorstel.omschrijving,
    categorie: aanpassing?.categorie ?? taak.voorstel.categorie,
  };
};

/** Negeert het voorstel: taak afgehandeld, niets opgeslagen. */
export const negeerVoorstel = (taak: PrecheckTaak): PrecheckTaak => ({
  ...taak,
  voorstel: undefined,
});

/** Mag de precheck nu draaien? Alleen online en niet al bezig. */
export const magPrecheckDraaien = (
  taak: PrecheckTaak,
  online: boolean
): boolean => online && (taak.status === 'IN_AFWACHTING' || taak.status === 'MISLUKT');

/** Resultaat van de edge-function-aanroep. */
export type PrecheckResultaat =
  | { ok: true; voorstel: PrecheckVoorstel }
  | { ok: false; error: string };

/** Transport-functie naar de edge function (injecteerbaar voor tests). */
export type PrecheckInvoker = (args: {
  fotoRef: string;
  controlepuntId: string;
}) => Promise<PrecheckResultaat>;

/**
 * Vraagt een precheck aan en geeft de **bijgewerkte taak** terug. Draait alleen
 * als het mag (online + juiste status); markeert BEZIG → VOORSTEL_KLAAR/MISLUKT.
 * Gooit nooit — een fout wordt een MISLUKT-taak.
 */
export const vraagPrecheckAan = async (
  taak: PrecheckTaak,
  online: boolean,
  invoke: PrecheckInvoker
): Promise<PrecheckTaak> => {
  if (!magPrecheckDraaien(taak, online)) return taak;

  const bezig = markeerBezig(taak);
  try {
    const res = await invoke({
      fotoRef: bezig.fotoRef,
      controlepuntId: bezig.controlepuntId,
    });
    return res.ok
      ? verwerkVoorstel(bezig, res.voorstel)
      : markeerMislukt(bezig, res.error);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'onbekende fout';
    return markeerMislukt(bezig, msg);
  }
};
