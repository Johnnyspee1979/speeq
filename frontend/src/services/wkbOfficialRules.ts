export type WkbRegulatorySeverity = 'critical' | 'warning' | 'info';

export type WkbOfficialSource = {
  label: string;
  url: string;
};

export type WkbOfficialCheck = {
  id: string;
  severity: WkbRegulatorySeverity;
  title: string;
  detail: string;
  ok: boolean;
  source: WkbOfficialSource;
};

export type WkbProjectRegulatoryContext = {
  gevolgklasse: string;
  projectKind: 'NIEUWBOUW' | 'VERBOUW' | 'ONBEKEND';
  vergunningplichtig: boolean | null;
  illegalExistingBuild: boolean | null;
  kwaliteitsborgerAssigned: boolean;
  kwaliteitsborgerIndependent: boolean | null;
};

export const WKB_OFFICIAL_SOURCES = {
  gevolgklasse: {
    label: 'IPLO gevolgklasse 1',
    url: 'https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/',
  },
  bouwmelding: {
    label: 'IPLO bouwmelding',
    url: 'https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/bouwmelding/',
  },
  gereedmelding: {
    label: 'IPLO gereedmelding',
    url: 'https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/gereedmelding/',
  },
  kwaliteitsborger: {
    label: 'IPLO kwaliteitsborger',
    url: 'https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborger/',
  },
  consumentendossier: {
    label: 'Wetten.nl art. 7:757a BW',
    url: 'https://wetten.overheid.nl/BWBR0005290/2024-01-01/#Boek7_Titeldeel12_Afdeling1_Artikel757a',
  },
} as const;

export const evaluateWkbOfficialRules = (
  context: WkbProjectRegulatoryContext
): WkbOfficialCheck[] => {
  const checks: WkbOfficialCheck[] = [];

  const isGK1 = String(context.gevolgklasse).trim() === '1';
  checks.push({
    id: 'scope-gevolgklasse',
    severity: isGK1 ? 'info' : 'critical',
    title: 'Wkb-scope: alleen gevolgklasse 1',
    detail: isGK1
      ? 'Project staat op gevolgklasse 1, passend bij de huidige Wkb-flow voor technische bouwactiviteiten.'
      : `Project staat op gevolgklasse ${context.gevolgklasse || 'onbekend'}. Deze toolflow is inhoudelijk ingericht op gevolgklasse 1.`,
    ok: isGK1,
    source: WKB_OFFICIAL_SOURCES.gevolgklasse,
  });

  const isNieuwbouw = context.projectKind === 'NIEUWBOUW';
  checks.push({
    id: 'scope-projectsoort',
    severity: isNieuwbouw ? 'info' : 'critical',
    title: 'Wkb-scope: nieuwbouw, geen verbouw',
    detail: isNieuwbouw
      ? 'Project is als nieuwbouw geconfigureerd, wat aansluit op de huidige Wkb-scope voor kwaliteitsborging.'
      : context.projectKind === 'VERBOUW'
        ? 'Project staat als verbouw/renovatie. De huidige toolflow en officiële Wkb-randvoorwaarden zijn hier niet op ingericht.'
        : 'Projectsoort is niet expliciet vastgelegd. Zet vast of dit nieuwbouw of verbouw is.',
    ok: isNieuwbouw,
    source: WKB_OFFICIAL_SOURCES.gevolgklasse,
  });

  const vergunningOk = context.vergunningplichtig !== false;
  checks.push({
    id: 'scope-vergunningplicht',
    severity: vergunningOk ? 'info' : 'critical',
    title: 'Technische bouwactiviteit is vergunningplichtig',
    detail: context.vergunningplichtig === false
      ? 'Project staat als vergunningvrij. Dan hoort deze Wkb-bouwmelding/gereedmelding-flow niet bij dit werk.'
      : context.vergunningplichtig === true
        ? 'Project staat als vergunningplichtig, passend bij bouwmelding en gereedmelding onder de Wkb.'
        : 'Vergunningplicht is niet expliciet vastgelegd. Controleer of deze technische bouwactiviteit meldings-/vergunningplichtig is.',
    ok: vergunningOk,
    source: WKB_OFFICIAL_SOURCES.bouwmelding,
  });

  const legalBuildOk = context.illegalExistingBuild !== true;
  checks.push({
    id: 'scope-legale-basis',
    severity: legalBuildOk ? 'info' : 'critical',
    title: 'Geen illegaal bestaand bouwwerk als uitgangspunt',
    detail: context.illegalExistingBuild === true
      ? 'Project wijst op een illegale bestaande situatie. Volgens IPLO hoort dit niet thuis in de gewone kwaliteitsborgingsroute.'
      : 'Geen aanwijzing dat het project op een illegale bestaande situatie rust.',
    ok: legalBuildOk,
    source: WKB_OFFICIAL_SOURCES.gevolgklasse,
  });

  checks.push({
    id: 'kwaliteitsborger-aangewezen',
    severity: context.kwaliteitsborgerAssigned ? 'info' : 'critical',
    title: 'Kwaliteitsborger is aangewezen',
    detail: context.kwaliteitsborgerAssigned
      ? 'Er is een kwaliteitsborger geconfigureerd voor bouwmelding, borgingsplan en gereedmelding.'
      : 'Er is nog geen kwaliteitsborger geconfigureerd. Zonder kwaliteitsborger past dit project niet in de Wkb-keten.',
    ok: context.kwaliteitsborgerAssigned,
    source: WKB_OFFICIAL_SOURCES.kwaliteitsborger,
  });

  checks.push({
    id: 'kwaliteitsborger-onafhankelijk',
    severity:
      context.kwaliteitsborgerIndependent === false ? 'critical' : 'warning',
    title: 'Kwaliteitsborger is onafhankelijk',
    detail:
      context.kwaliteitsborgerIndependent === true
        ? 'Onafhankelijkheid van de kwaliteitsborger is bevestigd.'
        : context.kwaliteitsborgerIndependent === false
          ? 'Onafhankelijkheid staat expliciet op nee. Dat past niet bij de officiële Wkb-rol van de kwaliteitsborger.'
          : 'Onafhankelijkheid is nog niet expliciet vastgelegd. Leg dit vast voor dossierzuiverheid.',
    ok: context.kwaliteitsborgerIndependent === true,
    source: WKB_OFFICIAL_SOURCES.kwaliteitsborger,
  });

  checks.push({
    id: 'bouwmelding-termijn',
    severity: 'info',
    title: 'Bouwmelding uiterlijk 4 weken voor start',
    detail:
      'Voor Wkb-werk in gevolgklasse 1 moet de bouwmelding uiterlijk 4 weken voor de start van de bouwactiviteit zijn gedaan.',
    ok: true,
    source: WKB_OFFICIAL_SOURCES.bouwmelding,
  });

  checks.push({
    id: 'gereedmelding-termijn',
    severity: 'info',
    title: 'Gereedmelding uiterlijk 2 weken voor gebruik',
    detail:
      'De gereedmelding moet uiterlijk 2 weken voor ingebruikname zijn ingediend, inclusief verklaring kwaliteitsborger en dossier bevoegd gezag.',
    ok: true,
    source: WKB_OFFICIAL_SOURCES.gereedmelding,
  });

  checks.push({
    id: 'consumentendossier-privaat',
    severity: 'info',
    title: 'Consumentendossier is een aparte privaatrechtelijke plicht',
    detail:
      'Het consumentendossier uit art. 7:757a BW staat los van het dossier bevoegd gezag en hoort as-built informatie, materialen, installaties, gebruiksfuncties, handleidingen, onderhoud en garanties te dekken.',
    ok: true,
    source: WKB_OFFICIAL_SOURCES.consumentendossier,
  });

  checks.push({
    id: 'consumentendossier-regelend-recht',
    severity: 'info',
    title: 'Afwijkingen op dossierinhoud expliciet contractueel vastleggen',
    detail:
      'Art. 7:757a BW is regelend recht. Als partijen willen afwijken van de standaardinhoud uit NPR 8092, of geen consumentendossier willen afspreken, moet dat expliciet in de aannemingsovereenkomst zijn vastgelegd.',
    ok: true,
    source: WKB_OFFICIAL_SOURCES.consumentendossier,
  });

  return checks;
};
