import {
  CHECKLIST_BRON,
  WKB_CHECKLIST,
  checklistVoortgang,
  valideerLeadAanmelding,
} from '../GratisChecklistService';

describe('GratisChecklistService — checklist-inhoud', () => {
  it('heeft drie blokken met unieke item-id\'s', () => {
    expect(WKB_CHECKLIST).toHaveLength(3);
    const ids = WKB_CHECKLIST.flatMap((b) => b.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('GratisChecklistService — checklistVoortgang', () => {
  it('telt afgevinkte items en negeert onbekende id\'s', () => {
    const v = checklistVoortgang(['vb-1', 'uv-2', 'onbekend']);
    expect(v.gedaan).toBe(2);
    expect(v.totaal).toBe(15);
    expect(v.procent).toBe(13);
  });

  it('100% als alles is afgevinkt', () => {
    const alle = WKB_CHECKLIST.flatMap((b) => b.items.map((i) => i.id));
    expect(checklistVoortgang(alle).procent).toBe(100);
  });
});

describe('GratisChecklistService — valideerLeadAanmelding', () => {
  it('normaliseert e-mail en zet default bron', () => {
    const r = valideerLeadAanmelding({ email: '  Jan@Voorbeeld.NL ', optIn: true });
    expect(r.geldig).toBe(true);
    expect(r.genormaliseerd).toEqual({ email: 'jan@voorbeeld.nl', bron: CHECKLIST_BRON });
  });

  it('weigert zonder expliciete opt-in', () => {
    const r = valideerLeadAanmelding({ email: 'jan@voorbeeld.nl', optIn: false });
    expect(r.geldig).toBe(false);
    expect(r.fouten).toContain('Expliciete opt-in ontbreekt.');
  });

  it('weigert ongeldig e-mailadres', () => {
    expect(valideerLeadAanmelding({ email: 'geen-email', optIn: true }).geldig).toBe(false);
    expect(valideerLeadAanmelding({ email: '', optIn: true }).fouten).toContain(
      'E-mailadres is leeg.'
    );
  });

  it('respecteert een meegegeven bron', () => {
    const r = valideerLeadAanmelding({ email: 'a@b.nl', optIn: true, bron: 'campagne-x' });
    expect(r.genormaliseerd?.bron).toBe('campagne-x');
  });
});
