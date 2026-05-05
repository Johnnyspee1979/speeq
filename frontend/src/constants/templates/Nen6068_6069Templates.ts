import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_6068_6069_CURRENT_EDITION = 'NEN 6068 / NEN 6069' as const;

export interface Nen6068_6069Task {
  id: string;
  discipline: 'Brandveiligheid';
  nenNorm: typeof NEN_6068_6069_CURRENT_EDITION;
  inspectionPointId: string;
  normCodes: string[];
  component: string;
  description: string;
  builderInstruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
}

export const NEN_6068_6069_TEMPLATES: Nen6068_6069Task[] = [
  {
    id: 'NEN-6068-01-WBDBO-SCHEIDING',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'wbdbo-scheidingswand-001',
    normCodes: ['NEN 6068', 'NEN 6069'],
    component: 'WBDBO Brandscheiding',
    description:
      'Overzicht van brandscheidende wand, vloer of schacht met ononderbroken aansluiting op omliggende bouwdelen.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een overzichtsfoto van de brandscheidende wand, vloer of schacht voordat deze wordt dichtgezet. Leg de ononderbroken aansluiting op vloer, wand en plafond vast, inclusief naden, stroken, bekleding en andere detailoplossingen waarmee de vereiste WBDBO in de praktijk wordt geborgd.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_FIRE_SEPARATION_DETAIL',
  },
  {
    id: 'NEN-6069-02-DOORVOERING',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'brand-doorvoering-001',
    normCodes: ['NEN 6069', 'NEN 6068', 'NEN-EN 13501-1'],
    component: 'Brandwerende Doorvoering',
    description:
      'Brandmanchet, brandwerende kitafdichting en productclassificatie bij een sparing in de brandscheiding.',
    builderInstruction:
      'WKB STOPMOMENT: Maak een detailfoto van de leiding- of kabeldoorvoer door de brandscheiding. De brandmanchet, brandwerende kitafdichting en productclassificatie moeten scherp zichtbaar zijn voordat plafond, schacht of voorzetwand wordt gesloten.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_COLLAR',
  },
  {
    id: 'NEN-6069-03-BRANDDEUR-LABEL',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'brandwerende-deur-label-001',
    normCodes: ['NEN 6069', 'NEN 6075', 'NEN-EN 13501-2'],
    component: 'Brandwerende Deur, Label en Zelfsluiter',
    description:
      'Leesbare classificatiesticker of label van brandwerende deur of luik met zichtbaar sluit- en kierdetail.',
    builderInstruction:
      'Maak een detailfoto van het classificatielabel of typeplaatje van de brandwerende deur of het luik en leg in hetzelfde stopmoment ook de zelfsluiter, kierdichting en kozijnaansluiting vast. Het label moet leesbaar zijn zodat de brandwerendheid van het bouwdeel juridisch herleidbaar blijft.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_FIRE_RATING_LABEL',
  },
  {
    id: 'NEN-6069-04-BRAND-ROOKKLEP',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'brand-rookklep-001',
    normCodes: ['NEN 6068', 'NEN 6069', 'NEN 6075'],
    component: 'Brand- en Rookklep bij Brandscheiding',
    description:
      'Klepdetail in ventilatiekanaal ter plaatse van de brandscheiding met label, bevestiging en aansturing zichtbaar.',
    builderInstruction:
      'Fotografeer de brand- of rookklep in het ventilatiekanaal precies ter plaatse van de brandscheiding. Zorg dat de positie, bevestiging, identificatie en aansturing zichtbaar zijn, zodat het compartimentdetail en de rookwerende functie aantoonbaar zijn voordat het plafond wordt gesloten.',
    requiresExif: true,
    stopMoment: 'VOOR PLAFOND DICHT',
    aiValidationKey: 'DETECT_FIRE_DAMPER',
  },
  {
    id: 'NEN-6064-05-BRANDKLASSE-VLUCHTWEG',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'brandklasse-materialen-001',
    normCodes: ['NEN-EN 13501-1', 'Bbl'],
    component: 'Brand- en Rookklasse Materialen (Vluchtwegen)',
    description:
      'Aantonen van de CE-markering, DOP of specifieke brandklasse op verpakkingen van isolatie, plaatmateriaal of gevelbekleding.',
    builderInstruction:
      'Maak een foto van het etiket of de pallet-markering van bouwmaterialen in gemeenschappelijke (vlucht)ruimten of buitengevels om de formele Euro-Brandklasse (bijv. B-s2,d0) vast te leggen. Dit voorkomt civiele claims dat er zeer brandbare isolatie/bekleding (Klasse D of erger) is toegepast waar Klasse B was geëist.',
    requiresExif: true,
    stopMoment: 'TIJDENS BOUW / LEVERING',
    aiValidationKey: 'OCR_FIRE_RATING_LABEL',
  },
  {
    id: 'NEN-6075-06-ROOKDOORGANG-KOUD-WARM',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'rookwerend-valdorpel-001',
    normCodes: ['NEN 6075', 'Bbl'],
    component: 'Rookdoorgang (Sa / S200 Deuren)',
    description:
      'Registratie van rondomlopende kozijnrubbers en valdorpel/onderafdichting op de scheiding van brand- en rookcompartimenten.',
    builderInstruction:
      'WKB STOPMOMENT: Rook is veruit de belangrijkste doodsoorzaak. Maak een detailfoto met een openstaande branddeur in het kozijn, zodat visueel aantoonbaar is dat de beschermrubbers doorlopen (geen onderbreking bij slotplaat of scharnieren). Maak direct daarna een close-up van de vloeraansluiting (valdorpel / borstel) aan de onderkant van de deur.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_DOOR_SEALS',
  },
  {
    id: 'NEN-6068-07-BRANDOVERSLAG-GEVEL',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'brandoverslag-spiegel-001',
    normCodes: ['NEN 6068', 'NEN-EN 1364-1'],
    component: 'Brandoverslag Gevels (Brandwerende Beglazing)',
    description:
      'Aantonen details brandwerende beglazing en kozijnaansluitingen binnen de risicozones voor overslaande brand (spiegelsymmetrie).',
    builderInstruction:
      'Wanneer ramen vallen binnen de spiegelsymmetrie ter preventie van brandoverslag naar buren, vereist dit brandwerende beglazing. Aangeleverd brandglas mag niet in standaard kit of glaslatten. Fotografeer exact het detail hoe deze ruit in het kozijn zit (met stalen glaslatclips en keramisch band zichtbaar) voor het plaatsen van de houten glaslat.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN',
    aiValidationKey: 'DETECT_FIRE_GLASS_DETAIL',
  },
  {
    id: 'NEN-6069-08-STAALBESCHERMING',
    discipline: 'Brandveiligheid',
    nenNorm: NEN_6068_6069_CURRENT_EDITION,
    inspectionPointId: 'staal-brandwerend-001',
    normCodes: ['NEN 6069', 'NEN-EN 13381', 'Bbl'],
    component: 'Brandwerende Bescherming Constructiestaal',
    description:
      'Validatie van opzwellende brandvertragende coatinglaagdikte of plaatafwerking (Promat/Gyproc) om stalen draagbalken/-kolommen.',
    builderInstruction:
      'WKB STOPMOMENT: Onbeschermd staal is na 15 minuten brand faalgevoelig (instorting). Bescherm je dragende stalen liggers in de scheiding! Gebruik je brandwerende verf? Meet met een klok (en meet mee op foto) de "natte/droge" laagdikte op staal. Gebruik je brandbeplating? Fotografeer the kopse naden van de plaat op de stalen flens vóór sausklaar afwerken.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFWERKING / SAUSEN',
    aiValidationKey: 'DETECT_FIRE_BOARD_THICKNESS',
  },
];
