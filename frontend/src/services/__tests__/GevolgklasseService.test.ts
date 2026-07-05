import {
  type GevolgklasseAntwoorden,
  bepaalGevolgklasse,
  formatGevolgklasseRegel,
} from '../GevolgklasseService';

const intake = (over: Partial<GevolgklasseAntwoorden>): GevolgklasseAntwoorden => ({
  type: 'grondgebonden-woning',
  fase: 'nieuwbouw',
  ...over,
});

describe('GevolgklasseService — enkel bouwwerk', () => {
  it('grondgebonden woning → GK1 (groen, niet waarschuwen)', () => {
    const r = bepaalGevolgklasse(intake({ type: 'grondgebonden-woning' }));
    expect(r.uitkomst).toBe('GK1');
    expect(r.kleur).toBe('groen');
    expect(r.waarschuwen).toBe(false);
  });

  it('klein bedrijfsgebouw → GK1', () => {
    expect(bepaalGevolgklasse(intake({ type: 'klein-bedrijfsgebouw' })).uitkomst).toBe('GK1');
  });

  it('appartementen → BUITEN_GK1 (navy, waarschuwen)', () => {
    const r = bepaalGevolgklasse(intake({ type: 'appartementen' }));
    expect(r.uitkomst).toBe('BUITEN_GK1');
    expect(r.kleur).toBe('navy');
    expect(r.basis).toBe('HOGER');
    expect(r.waarschuwen).toBe(true);
  });

  it('winkel-plus-wonen → TWIJFEL (oranje)', () => {
    const r = bepaalGevolgklasse(intake({ type: 'winkel-plus-wonen' }));
    expect(r.uitkomst).toBe('TWIJFEL');
    expect(r.kleur).toBe('oranje');
    expect(r.waarschuwen).toBe(true);
  });

  it('anders → TWIJFEL (onbekend)', () => {
    const r = bepaalGevolgklasse(intake({ type: 'anders' }));
    expect(r.uitkomst).toBe('TWIJFEL');
    expect(r.basis).toBe('ONBEKEND');
  });
});

describe('GevolgklasseService — combinatie-regel', () => {
  it('losse gebouwen, GK1-deel volgt eigen spoor → GK1', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'grondgebonden-woning', meerdereBouwwerken: true, samenstelling: 'losse-gebouwen' })
    );
    expect(r.uitkomst).toBe('GK1');
    expect(r.uitleg).toContain('eigen spoor');
  });

  it('één bouwkundige eenheid die GK1 blijft → GK1', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'grondgebonden-woning', meerdereBouwwerken: true, samenstelling: 'een-eenheid' })
    );
    expect(r.uitkomst).toBe('GK1');
    expect(r.uitleg).toContain('hoogste klasse blijft GK1');
  });

  it('één eenheid waarin hogere klasse meedoet → BUITEN_GK1', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'appartementen', meerdereBouwwerken: true, samenstelling: 'een-eenheid' })
    );
    expect(r.uitkomst).toBe('BUITEN_GK1');
    expect(r.uitleg).toContain('hoogste klasse telt');
  });

  it('losse gebouwen met een hoger gebouw → BUITEN_GK1 voor dat gebouw', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'appartementen', meerdereBouwwerken: true, samenstelling: 'losse-gebouwen' })
    );
    expect(r.uitkomst).toBe('BUITEN_GK1');
  });

  it('meerdere bouwwerken zonder samenstelling → TWIJFEL', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'grondgebonden-woning', meerdereBouwwerken: true })
    );
    expect(r.uitkomst).toBe('TWIJFEL');
    expect(r.uitleg).toContain('één eenheid of losse gebouwen');
  });

  it('één eenheid met gemengd type → TWIJFEL', () => {
    const r = bepaalGevolgklasse(
      intake({ type: 'winkel-plus-wonen', meerdereBouwwerken: true, samenstelling: 'een-eenheid' })
    );
    expect(r.uitkomst).toBe('TWIJFEL');
  });
});

describe('GevolgklasseService — formatGevolgklasseRegel', () => {
  it('toont label + uitleg voor GK1', () => {
    const regel = formatGevolgklasseRegel(bepaalGevolgklasse(intake({ type: 'grondgebonden-woning' })));
    expect(regel).toContain('Valt onder GK1');
  });

  it('toont navraag-label bij twijfel', () => {
    const regel = formatGevolgklasseRegel(bepaalGevolgklasse(intake({ type: 'anders' })));
    expect(regel).toContain('Twijfel — navragen');
  });
});
