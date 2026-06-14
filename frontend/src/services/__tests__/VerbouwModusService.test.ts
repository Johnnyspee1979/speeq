import {
  VERBOUW_DISCLAIMER,
  WETTELIJK_ALLEEN_GK1_CATEGORIEEN,
  actieveCategorieen,
  disclaimerVoorProjecttype,
  filterDossierVoorProjecttype,
  isVrijwilligDossier,
  projecttypeLabel,
  wettelijkeStappenStatus,
} from '../VerbouwModusService';

describe('VerbouwModusService — projecttype', () => {
  it('verbouw is een vrijwillig dossier, gk1 niet', () => {
    expect(isVrijwilligDossier('verbouw')).toBe(true);
    expect(isVrijwilligDossier('gk1')).toBe(false);
  });

  it('labels zijn eerlijk', () => {
    expect(projecttypeLabel('gk1')).toContain('Wkb');
    expect(projecttypeLabel('verbouw')).toContain('vrijwillig');
  });
});

describe('VerbouwModusService — filterDossierVoorProjecttype', () => {
  it('gk1: alle onderdelen van toepassing', () => {
    const view = filterDossierVoorProjecttype('gk1');
    expect(view.every((v) => v.status === 'VAN_TOEPASSING')).toBe(true);
  });

  it('verbouw: wettelijke onderdelen op niet-van-toepassing, rest blijft', () => {
    const view = filterDossierVoorProjecttype('verbouw');
    for (const cat of view) {
      if (WETTELIJK_ALLEEN_GK1_CATEGORIEEN.includes(cat.id)) {
        expect(cat.status).toBe('NIET_VAN_TOEPASSING');
        expect(cat.reden).toContain('nog niet onder de Wkb');
      } else {
        expect(cat.status).toBe('VAN_TOEPASSING');
      }
    }
  });

  it('verbouw: keuringsrapporten (foto-vastlegging) blijven van toepassing', () => {
    const view = filterDossierVoorProjecttype('verbouw');
    const keuring = view.find((v) => v.id === 'keuringsrapporten');
    expect(keuring?.status).toBe('VAN_TOEPASSING');
  });

  it('verbouw: borgingsplan en verklaring-kwaliteitsborger zijn n.v.t.', () => {
    const view = filterDossierVoorProjecttype('verbouw');
    expect(view.find((v) => v.id === 'borgingsplan')?.status).toBe('NIET_VAN_TOEPASSING');
    expect(view.find((v) => v.id === 'verklaring-kwaliteitsborger')?.status).toBe(
      'NIET_VAN_TOEPASSING'
    );
  });

  it('actieveCategorieen sluit de wettelijke n.v.t.-onderdelen uit bij verbouw', () => {
    const actief = actieveCategorieen('verbouw');
    expect(actief.some((c) => c.id === 'borgingsplan')).toBe(false);
    expect(actief.some((c) => c.id === 'keuringsrapporten')).toBe(true);
    // GK1 houdt alles
    expect(actieveCategorieen('gk1').length).toBeGreaterThan(actief.length);
  });
});

describe('VerbouwModusService — wettelijke stappen', () => {
  it('gk1: alle stappen van toepassing', () => {
    const stappen = wettelijkeStappenStatus('gk1');
    expect(stappen.every((s) => s.status === 'VAN_TOEPASSING')).toBe(true);
  });

  it('verbouw: bouwmelding/verklaring/gereedmelding niet van toepassing', () => {
    const stappen = wettelijkeStappenStatus('verbouw');
    expect(stappen.every((s) => s.status === 'NIET_VAN_TOEPASSING')).toBe(true);
    expect(stappen.map((s) => s.stap)).toEqual([
      'bouwmelding',
      'verklaring-kwaliteitsborger',
      'gereedmelding',
    ]);
  });
});

describe('VerbouwModusService — disclaimer', () => {
  it('verbouw toont de vrijwillig-dossier-disclaimer', () => {
    expect(disclaimerVoorProjecttype('verbouw')).toBe(VERBOUW_DISCLAIMER);
    expect(disclaimerVoorProjecttype('verbouw')).toContain('vrijwillig privaat kwaliteitsdossier');
  });

  it('gk1 toont geen disclaimer', () => {
    expect(disclaimerVoorProjecttype('gk1')).toBe('');
  });
});
