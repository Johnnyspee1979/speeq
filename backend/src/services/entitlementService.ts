// ─────────────────────────────────────────────────────────────────────────────
// entitlementService (backend) — toegangsbeslissing voor abonnementen.
// ─────────────────────────────────────────────────────────────────────────────
// Server-side spiegel van frontend/src/services/EntitlementService.ts. De
// backend dwingt hiermee af (requireActiveSubscription); de frontend gebruikt de
// eigen kopie voor de UI. Houd beide in sync. Fail-closed: onbekend → geen toegang.
//
// CommonJS-module (verbatimModuleSyntax): types via `export`, waarden via
// `module.exports`.

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
  plan?: string | null;
  geldigTot?: string | null;
}

export interface ToegangsBesluit {
  toegang: boolean;
  status: AbonnementStatus;
  inProefperiode: boolean;
  dagenResterend: number;
  reden: string;
}

// Mapt een ruwe Lemon-Squeezy-status naar de interne status. Onbekend → 'geen'.
const mapLemonSqueezyStatus = (raw: string | null | undefined): AbonnementStatus => {
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

// Neemt de toegangsbeslissing. Actief → toegang; proef → tot proef-einde;
// opgezegd/betaling-te-laat → tot einde betaalde periode; rest → geen toegang.
const bepaalToegang = (
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

module.exports = {
  mapLemonSqueezyStatus,
  bepaalToegang,
};
