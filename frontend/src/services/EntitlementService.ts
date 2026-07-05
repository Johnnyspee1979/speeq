/**
 * EntitlementService — beslist of een tenant toegang heeft op basis van zijn
 * abonnementstatus. Zuiver en provider-neutraal: de betaalprovider (Lemon
 * Squeezy) levert ruwe statussen aan via een webhook; deze service normaliseert
 * die en neemt één heldere toegangsbeslissing.
 *
 * Belangrijk: dit is de *beslissing*, niet de afdwinging. De backend/edge-laag
 * roept `bepaalToegang` aan en blokkeert pas écht (geen actief abonnement → geen
 * exporteren/melden). Fail-closed: bij een onbekende of ontbrekende status is er
 * géén toegang.
 *
 * Zie docs/commerce/abonnementen-entitlement.md.
 */

/** Provider-neutrale abonnementstatus die SpeeQ intern hanteert. */
export type AbonnementStatus =
  | 'op_proef'
  | 'actief'
  | 'betaling_te_laat'
  | 'gepauzeerd'
  | 'opgezegd'
  | 'verlopen'
  | 'geen';

export interface TenantAbonnement {
  status: AbonnementStatus;
  /** Plan-sleutel, bijv. 'solo' | 'team'. Puur informatief voor de gate. */
  plan?: string | null;
  /**
   * Tot wanneer de huidige (betaalde of proef-)periode loopt, ISO-datum. Voor
   * 'opgezegd' en 'betaling_te_laat' bepaalt dit tot wanneer toegang doorloopt.
   */
  geldigTot?: string | null;
}

export interface ToegangsBesluit {
  toegang: boolean;
  status: AbonnementStatus;
  inProefperiode: boolean;
  /** Hele dagen tot `geldigTot` (0 als verlopen of geen datum). */
  dagenResterend: number;
  reden: string;
}

/**
 * Mapt een ruwe Lemon-Squeezy-subscriptionstatus naar de interne status.
 * LS-statussen: on_trial, active, paused, past_due, unpaid, cancelled, expired.
 * Onbekend → 'geen' (fail-closed).
 */
export const mapLemonSqueezyStatus = (raw: string | null | undefined): AbonnementStatus => {
  switch (String(raw ?? '').toLowerCase()) {
    case 'on_trial':
      return 'op_proef';
    case 'active':
      return 'actief';
    case 'past_due':
    case 'unpaid':
      return 'betaling_te_laat';
    case 'paused':
      return 'gepauzeerd';
    case 'cancelled':
      return 'opgezegd';
    case 'expired':
      return 'verlopen';
    default:
      return 'geen';
  }
};

const dagenTot = (geldigTot: string | null | undefined, nu: Date): number => {
  if (!geldigTot) return 0;
  const eind = new Date(geldigTot).getTime();
  if (Number.isNaN(eind)) return 0;
  const ms = eind - nu.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
};

const nogGeldig = (geldigTot: string | null | undefined, nu: Date): boolean => {
  if (!geldigTot) return false;
  const eind = new Date(geldigTot).getTime();
  return !Number.isNaN(eind) && nu.getTime() <= eind;
};

/**
 * Neemt de toegangsbeslissing voor een tenant. Toegang bij actief abonnement of
 * een lopende proefperiode; bij opgezegd of betaling-te-laat blijft toegang tot
 * het einde van de al betaalde periode (`geldigTot`). Alles daarbuiten → geen
 * toegang. Fail-closed bij onbekende status.
 */
export const bepaalToegang = (
  ab: TenantAbonnement | null | undefined,
  nu: Date = new Date()
): ToegangsBesluit => {
  const status: AbonnementStatus = ab?.status ?? 'geen';
  const geldigTot = ab?.geldigTot ?? null;
  const dagenResterend = dagenTot(geldigTot, nu);
  const basis = { status, dagenResterend };

  switch (status) {
    case 'actief':
      return { ...basis, toegang: true, inProefperiode: false, reden: 'Actief abonnement.' };

    case 'op_proef': {
      const geldig = !geldigTot || nogGeldig(geldigTot, nu);
      return {
        ...basis,
        toegang: geldig,
        inProefperiode: geldig,
        reden: geldig
          ? `Proefperiode loopt nog (${dagenResterend} dag(en)).`
          : 'Proefperiode verlopen.',
      };
    }

    case 'opgezegd': {
      const geldig = nogGeldig(geldigTot, nu);
      return {
        ...basis,
        toegang: geldig,
        inProefperiode: false,
        reden: geldig
          ? `Opgezegd; toegang nog tot einde periode (${dagenResterend} dag(en)).`
          : 'Abonnement opgezegd en periode verstreken.',
      };
    }

    case 'betaling_te_laat': {
      const geldig = nogGeldig(geldigTot, nu);
      return {
        ...basis,
        toegang: geldig,
        inProefperiode: false,
        reden: geldig
          ? 'Betaling te laat; toegang tijdelijk behouden tot einde periode.'
          : 'Betaling te laat en periode verstreken.',
      };
    }

    case 'gepauzeerd':
      return { ...basis, toegang: false, inProefperiode: false, reden: 'Abonnement gepauzeerd.' };

    case 'verlopen':
      return { ...basis, toegang: false, inProefperiode: false, reden: 'Abonnement verlopen.' };

    case 'geen':
    default:
      return {
        ...basis,
        status: 'geen',
        toegang: false,
        inProefperiode: false,
        reden: 'Geen actief abonnement.',
      };
  }
};

/** Korte UI-regel: wat moet de tenant zien/doen? */
export const formatToegangsRegel = (besluit: ToegangsBesluit): string => {
  if (besluit.toegang && besluit.inProefperiode) {
    return `Proef actief — nog ${besluit.dagenResterend} dag(en). Kies een abonnement om door te gaan.`;
  }
  if (besluit.toegang) return 'Abonnement actief.';
  return `Geen toegang: ${besluit.reden} Sluit een abonnement af om verder te gaan.`;
};
