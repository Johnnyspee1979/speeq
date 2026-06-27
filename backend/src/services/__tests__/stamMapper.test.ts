/**
 * Unit-tests voor stamMapper — de payload-bouwer voor STAM-meldingen aan het
 * bevoegd gezag (DSO/STAM). Deze mapping is juridisch gevoelig: de velden moeten
 * exact kloppen, want het is de officiële bouw- en gereedmelding onder de Wkb.
 *
 * Borgt:
 *   - createStamBasis: initiatiefnemer, locatie (coördinaten als "lat,lng"),
 *     kwaliteitsborging (KVK + instrumentcode) en een ISO-dagtekening;
 *   - mapToStamBouwmelding: type GK1 + de twee verplichte bijlagen
 *     (borgingsplan + risicobeoordeling) met de meegegeven URL's;
 *   - mapToStamGereedmelding: type GK1, geplande ingebruikname, en de twee
 *     dossier-bijlagen met projectId in de bestandsnaam.
 */

const {
  createStamBasis,
  mapToStamBouwmelding,
  mapToStamGereedmelding,
} = require('../stamMapper');

const project = {
  projectId: 'p-42',
  initiatorDetails: {
    name: 'Bouwgroep BV',
    address: 'Voorbeeldstraat 1, Den Haag',
    email: 'info@bouwgroep.nl',
  },
  location: {
    kadastraleAanduiding: 'DHG00-A-1234',
    coordinates: { lat: 52.07, lng: 4.3 },
  },
  kwaliteitsborgerId: 'KVK-12345678',
  instrumentId: 'INSTR-GK1',
};

describe('createStamBasis', () => {
  it('mapt initiatiefnemer, locatie en kwaliteitsborging', () => {
    const { StamMelding } = createStamBasis(project);
    expect(StamMelding.Initiatiefnemer).toEqual({
      Naam: 'Bouwgroep BV',
      Adres: 'Voorbeeldstraat 1, Den Haag',
      Email: 'info@bouwgroep.nl',
    });
    expect(StamMelding.Locatie).toEqual({
      KadastraleAanduiding: 'DHG00-A-1234',
      Coordinaten: '52.07,4.3',
    });
    expect(StamMelding.Kwaliteitsborging).toEqual({
      KwaliteitsborgerKVK: 'KVK-12345678',
      InstrumentCode: 'INSTR-GK1',
    });
  });

  it('zet een Dagtekening als ISO-8601-tijdstempel', () => {
    const { StamMelding } = createStamBasis(project);
    expect(StamMelding.Dagtekening).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(Number.isNaN(Date.parse(StamMelding.Dagtekening))).toBe(false);
  });
});

describe('mapToStamBouwmelding', () => {
  it('zet het GK1-bouwmeldingtype en behoudt de basisvelden', () => {
    const { StamMelding } = mapToStamBouwmelding(project, 'https://x/borg.pdf', 'https://x/risk.pdf');
    expect(StamMelding.MeldingType).toBe('Bouwmelding_Wkb_GK1');
    expect(StamMelding.Initiatiefnemer.Naam).toBe('Bouwgroep BV');
  });

  it('voegt de borgingsplan- en risicobeoordeling-bijlagen met de juiste URLs toe', () => {
    const { StamMelding } = mapToStamBouwmelding(project, 'https://x/borg.pdf', 'https://x/risk.pdf');
    expect(StamMelding.Bijlagen).toEqual([
      { Bestandsnaam: 'Borgingsplan.pdf', InhoudUrl: 'https://x/borg.pdf', Type: 'Borgingsplan' },
      { Bestandsnaam: 'Risicobeoordeling.pdf', InhoudUrl: 'https://x/risk.pdf', Type: 'Risicobeoordeling' },
    ]);
  });
});

describe('mapToStamGereedmelding', () => {
  const gereed = { ...project, ingebruiknameDatum: '2026-09-01' };

  it('zet het GK1-gereedmeldingtype en de geplande ingebruikname', () => {
    const { StamMelding } = mapToStamGereedmelding(gereed, 'https://x/dossier.pdf', 'https://x/verklaring.pdf');
    expect(StamMelding.MeldingType).toBe('Gereedmelding_Wkb_GK1');
    expect(StamMelding.GeplandeIngebruikname).toBe('2026-09-01');
  });

  it('voegt de dossier-bijlagen toe met het projectId in de bestandsnaam', () => {
    const { StamMelding } = mapToStamGereedmelding(gereed, 'https://x/dossier.pdf', 'https://x/verklaring.pdf');
    expect(StamMelding.Bijlagen).toEqual([
      {
        Bestandsnaam: 'Dossier_Bevoegd_Gezag_p-42.pdf',
        InhoudUrl: 'https://x/dossier.pdf',
        Type: 'DossierBevoegdGezag',
      },
      {
        Bestandsnaam: 'Verklaring_Kwaliteitsborger_p-42.pdf',
        InhoudUrl: 'https://x/verklaring.pdf',
        Type: 'VerklaringKwaliteitsborger',
      },
    ]);
  });
});
