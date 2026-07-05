import {
  type BedrijfsStandaardDekking,
  type InformatiebladProject,
  bouwInformatieblad,
  dekkingsVormLabel,
  formatInformatieblad,
  registreerOverhandiging,
} from '../VerzekeringInformatiebladService';

const project: InformatiebladProject = {
  projectId: 'p-1',
  projectnaam: 'Woning 12',
  adres: 'Dorpsstraat 1',
  gevolgklasse: 'GK1',
  opdrachtgever: 'Fam. Jansen',
};

const standaard: BedrijfsStandaardDekking = {
  aannemer: 'Combivo',
  dekkingen: [
    {
      vorm: 'verborgen-gebreken-verzekering',
      omschrijving: 'Dekt verborgen gebreken aan de constructie.',
      periode: '6 jaar na oplevering',
      bewijsVerwijzing: 'Polis bijlage A',
    },
  ],
};

describe('VerzekeringInformatiebladService — bouwInformatieblad', () => {
  it('gebruikt de bedrijfsstandaard als er geen project-override is', () => {
    const blad = bouwInformatieblad({ project, standaard, datum: '2026-06-14' });
    expect(blad.aannemer).toBe('Combivo');
    expect(blad.dekkingen).toHaveLength(1);
    expect(blad.ontbrekend).toEqual([]);
    expect(blad.datum).toBe('2026-06-14');
  });

  it('project-dekkingen vervangen de standaard', () => {
    const blad = bouwInformatieblad({
      project,
      standaard,
      projectDekkingen: [
        { vorm: 'bankgarantie', omschrijving: 'Bankgarantie van 5%.', bewijsVerwijzing: 'Doc B' },
      ],
    });
    expect(blad.dekkingen[0].vorm).toBe('bankgarantie');
  });

  it('benoemt ontbrekende velden eerlijk', () => {
    const blad = bouwInformatieblad({
      project: { ...project, opdrachtgever: null },
      standaard: {
        aannemer: 'Combivo',
        dekkingen: [{ vorm: 'garantieverzekering', omschrijving: '' }],
      },
    });
    const tekst = blad.ontbrekend.join(' | ');
    expect(tekst).toContain('omschrijving ontbreekt');
    expect(tekst).toContain('geen verwijzing naar bewijs');
    expect(tekst).toContain('Opdrachtgever niet ingevuld');
  });

  it('lege dekkingslijst → expliciet gat', () => {
    const blad = bouwInformatieblad({
      project,
      standaard: { aannemer: 'Combivo', dekkingen: [] },
    });
    expect(blad.ontbrekend).toContain('Geen dekkingsvorm vastgelegd.');
  });
});

describe('VerzekeringInformatiebladService — registreerOverhandiging', () => {
  it('legt een tijdstempel vast', () => {
    const b = registreerOverhandiging('p-1', 'overhandigd bij keukentafel', new Date('2026-06-14T08:00:00Z'));
    expect(b).toEqual({
      projectId: 'p-1',
      overhandigdAt: '2026-06-14T08:00:00.000Z',
      notitie: 'overhandigd bij keukentafel',
    });
  });
});

describe('VerzekeringInformatiebladService — format + label', () => {
  it('label is leesbaar', () => {
    expect(dekkingsVormLabel('waarborgregeling')).toBe('Waarborgregeling');
  });

  it('formatInformatieblad bevat kop, dekking en ondertekenregel', () => {
    const txt = formatInformatieblad(bouwInformatieblad({ project, standaard, datum: '2026-06-14' }));
    expect(txt).toContain('VERZEKERING & FINANCIËLE ZEKERHEID');
    expect(txt).toContain('Verborgen-gebrekenverzekering');
    expect(txt).toContain('paraaf opdrachtgever');
  });
});
