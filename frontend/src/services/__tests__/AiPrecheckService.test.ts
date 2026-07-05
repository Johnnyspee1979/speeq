import {
  type PrecheckTaak,
  type PrecheckVoorstel,
  accepteerVoorstel,
  maakPrecheckTaak,
  magPrecheckDraaien,
  markeerBezig,
  markeerMislukt,
  negeerVoorstel,
  opnieuwProberen,
  verwerkVoorstel,
  vraagPrecheckAan,
  zekerheidsLabel,
} from '../AiPrecheckService';

const voorstel: PrecheckVoorstel = {
  omschrijving: 'Scheurvorming in metselwerk nabij raamdorpel',
  categorie: 'gevel',
  zekerheid: 0.82,
};

const nieuweTaak = (): PrecheckTaak =>
  maakPrecheckTaak('storage://foto/1.jpg', 'cp-1', '2026-06-14T08:00:00.000Z');

describe('AiPrecheckService — zekerheidsLabel', () => {
  it('mapt zekerheid naar label', () => {
    expect(zekerheidsLabel(0.9)).toBe('hoog');
    expect(zekerheidsLabel(0.8)).toBe('hoog');
    expect(zekerheidsLabel(0.6)).toBe('midden');
    expect(zekerheidsLabel(0.3)).toBe('laag');
  });
});

describe('AiPrecheckService — statusmachine', () => {
  it('nieuwe taak start in de queue', () => {
    expect(nieuweTaak().status).toBe('IN_AFWACHTING');
  });

  it('IN_AFWACHTING → BEZIG → VOORSTEL_KLAAR', () => {
    const bezig = markeerBezig(nieuweTaak());
    expect(bezig.status).toBe('BEZIG');
    const klaar = verwerkVoorstel(bezig, voorstel);
    expect(klaar.status).toBe('VOORSTEL_KLAAR');
    expect(klaar.voorstel).toEqual(voorstel);
  });

  it('markeerBezig doet niets vanuit VOORSTEL_KLAAR', () => {
    const klaar = verwerkVoorstel(markeerBezig(nieuweTaak()), voorstel);
    expect(markeerBezig(klaar)).toBe(klaar);
  });

  it('mislukt en opnieuw proberen zet terug in de queue', () => {
    const mislukt = markeerMislukt(markeerBezig(nieuweTaak()), 'timeout');
    expect(mislukt.status).toBe('MISLUKT');
    expect(mislukt.foutmelding).toBe('timeout');
    const opnieuw = opnieuwProberen(mislukt);
    expect(opnieuw.status).toBe('IN_AFWACHTING');
    expect(opnieuw.foutmelding).toBeUndefined();
  });
});

describe('AiPrecheckService — nooit zonder akkoord invullen', () => {
  it('accepteren geeft null zolang er geen voorstel klaarstaat', () => {
    expect(accepteerVoorstel(nieuweTaak())).toBeNull();
    expect(accepteerVoorstel(markeerBezig(nieuweTaak()))).toBeNull();
  });

  it('accepteren geeft het voorstel terug bij VOORSTEL_KLAAR', () => {
    const klaar = verwerkVoorstel(markeerBezig(nieuweTaak()), voorstel);
    expect(accepteerVoorstel(klaar)).toEqual({
      omschrijving: voorstel.omschrijving,
      categorie: 'gevel',
    });
  });

  it('accepteren respecteert handmatige aanpassing', () => {
    const klaar = verwerkVoorstel(markeerBezig(nieuweTaak()), voorstel);
    expect(accepteerVoorstel(klaar, { omschrijving: 'Eigen tekst', categorie: 'constructie' })).toEqual({
      omschrijving: 'Eigen tekst',
      categorie: 'constructie',
    });
  });

  it('negeren wist het voorstel zonder iets op te slaan', () => {
    const klaar = verwerkVoorstel(markeerBezig(nieuweTaak()), voorstel);
    expect(negeerVoorstel(klaar).voorstel).toBeUndefined();
  });
});

describe('AiPrecheckService — magPrecheckDraaien', () => {
  it('alleen online en in queue/mislukt', () => {
    expect(magPrecheckDraaien(nieuweTaak(), true)).toBe(true);
    expect(magPrecheckDraaien(nieuweTaak(), false)).toBe(false);
    expect(magPrecheckDraaien(markeerBezig(nieuweTaak()), true)).toBe(false);
  });
});

describe('AiPrecheckService — vraagPrecheckAan', () => {
  it('offline: taak blijft ongewijzigd in de queue', async () => {
    const invoke = jest.fn();
    const res = await vraagPrecheckAan(nieuweTaak(), false, invoke);
    expect(res.status).toBe('IN_AFWACHTING');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('succes → VOORSTEL_KLAAR met het voorstel', async () => {
    const invoke = jest.fn().mockResolvedValue({ ok: true, voorstel });
    const res = await vraagPrecheckAan(nieuweTaak(), true, invoke);
    expect(res.status).toBe('VOORSTEL_KLAAR');
    expect(res.voorstel).toEqual(voorstel);
    expect(invoke).toHaveBeenCalledWith({ fotoRef: 'storage://foto/1.jpg', controlepuntId: 'cp-1' });
  });

  it('fout-resultaat → MISLUKT met melding', async () => {
    const invoke = jest.fn().mockResolvedValue({ ok: false, error: 'model offline' });
    const res = await vraagPrecheckAan(nieuweTaak(), true, invoke);
    expect(res.status).toBe('MISLUKT');
    expect(res.foutmelding).toBe('model offline');
  });

  it('geworpen fout wordt netjes MISLUKT (gooit nooit)', async () => {
    const invoke = jest.fn().mockRejectedValue(new Error('crash'));
    const res = await vraagPrecheckAan(nieuweTaak(), true, invoke);
    expect(res.status).toBe('MISLUKT');
    expect(res.foutmelding).toBe('crash');
  });
});
