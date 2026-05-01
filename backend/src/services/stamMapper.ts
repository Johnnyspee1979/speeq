type WkbProjectData = {
  projectId: string;
  initiatorDetails: {
    name: string;
    address: string;
    email: string;
  };
  location: {
    kadastraleAanduiding: string;
    coordinates: { lat: number; lng: number };
  };
  kwaliteitsborgerId: string;
  instrumentId: string;
};

type WkbGereedmeldingData = WkbProjectData & {
  ingebruiknameDatum: string;
};

const createStamBasis = (project: WkbProjectData) => ({
  StamMelding: {
    Dagtekening: new Date().toISOString(),
    Initiatiefnemer: {
      Naam: project.initiatorDetails.name,
      Adres: project.initiatorDetails.address,
      Email: project.initiatorDetails.email,
    },
    Locatie: {
      KadastraleAanduiding: project.location.kadastraleAanduiding,
      Coordinaten: `${project.location.coordinates.lat},${project.location.coordinates.lng}`,
    },
    Kwaliteitsborging: {
      KwaliteitsborgerKVK: project.kwaliteitsborgerId,
      InstrumentCode: project.instrumentId,
    },
  },
});

const mapToStamBouwmelding = (
  project: WkbProjectData,
  borgingsplanUrl: string,
  risicoUrl: string
) => ({
  StamMelding: {
    ...createStamBasis(project).StamMelding,
    MeldingType: 'Bouwmelding_Wkb_GK1',
    Bijlagen: [
      {
        Bestandsnaam: 'Borgingsplan.pdf',
        InhoudUrl: borgingsplanUrl,
        Type: 'Borgingsplan',
      },
      {
        Bestandsnaam: 'Risicobeoordeling.pdf',
        InhoudUrl: risicoUrl,
        Type: 'Risicobeoordeling',
      },
    ],
  },
});

const mapToStamGereedmelding = (
  project: WkbGereedmeldingData,
  dossierBevoegdGezagUrl: string,
  verklaringKwaliteitsborgerUrl: string
) => ({
  StamMelding: {
    ...createStamBasis(project).StamMelding,
    MeldingType: 'Gereedmelding_Wkb_GK1',
    GeplandeIngebruikname: project.ingebruiknameDatum,
    Bijlagen: [
      {
        Bestandsnaam: `Dossier_Bevoegd_Gezag_${project.projectId}.pdf`,
        InhoudUrl: dossierBevoegdGezagUrl,
        Type: 'DossierBevoegdGezag',
      },
      {
        Bestandsnaam: `Verklaring_Kwaliteitsborger_${project.projectId}.pdf`,
        InhoudUrl: verklaringKwaliteitsborgerUrl,
        Type: 'VerklaringKwaliteitsborger',
      },
    ],
  },
});

module.exports = {
  createStamBasis,
  mapToStamBouwmelding,
  mapToStamGereedmelding,
};
