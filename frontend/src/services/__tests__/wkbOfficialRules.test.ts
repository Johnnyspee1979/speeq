import { evaluateWkbOfficialRules } from '../wkbOfficialRules';

describe('evaluateWkbOfficialRules', () => {
  it('accepts a standaard Wkb nieuwbouwproject in gevolgklasse 1', () => {
    const checks = evaluateWkbOfficialRules({
      gevolgklasse: '1',
      projectKind: 'NIEUWBOUW',
      vergunningplichtig: true,
      illegalExistingBuild: false,
      kwaliteitsborgerAssigned: true,
      kwaliteitsborgerIndependent: true,
    });

    expect(checks.find((item) => item.id === 'scope-gevolgklasse')?.ok).toBe(true);
    expect(checks.find((item) => item.id === 'scope-projectsoort')?.ok).toBe(true);
    expect(checks.find((item) => item.id === 'kwaliteitsborger-aangewezen')?.ok).toBe(
      true
    );
  });

  it('flags verbouw buiten de huidige Wkb toolscope', () => {
    const checks = evaluateWkbOfficialRules({
      gevolgklasse: '1',
      projectKind: 'VERBOUW',
      vergunningplichtig: true,
      illegalExistingBuild: false,
      kwaliteitsborgerAssigned: true,
      kwaliteitsborgerIndependent: true,
    });

    const projectTypeCheck = checks.find((item) => item.id === 'scope-projectsoort');
    expect(projectTypeCheck?.ok).toBe(false);
    expect(projectTypeCheck?.severity).toBe('critical');
  });

  it('flags missing onafhankelijkheidsbevestiging van de kwaliteitsborger', () => {
    const checks = evaluateWkbOfficialRules({
      gevolgklasse: '1',
      projectKind: 'NIEUWBOUW',
      vergunningplichtig: true,
      illegalExistingBuild: false,
      kwaliteitsborgerAssigned: true,
      kwaliteitsborgerIndependent: null,
    });

    const independenceCheck = checks.find(
      (item) => item.id === 'kwaliteitsborger-onafhankelijk'
    );

    expect(independenceCheck?.ok).toBe(false);
    expect(independenceCheck?.severity).toBe('warning');
  });
});
