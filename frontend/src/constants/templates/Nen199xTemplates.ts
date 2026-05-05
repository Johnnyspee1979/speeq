import type { AiValidationKey, CaptureTimerConfig } from '../../types/CaptureTask';

const NEN_1992_CURRENT_EDITION = 'NEN-EN 1992 (Eurocode 2)';
const NEN_1993_CURRENT_EDITION = 'NEN-EN 1993 (Eurocode 3)';
const NEN_1995_CURRENT_EDITION = 'NEN-EN 1995 (Eurocode 5)';
const NEN_1996_CURRENT_EDITION = 'NEN-EN 1996 (Eurocode 6)';
const NEN_1997_CURRENT_EDITION = 'NEN-EN 1997 (Eurocode 7)';

export interface Nen199xTask {
  id: string;
  discipline: 'Constructieve Veiligheid';
  nenNorm: string;
  inspectionPointId: string;
  normCodes: string[];
  component: string;
  description: string;
  builderInstruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  timerConfig?: CaptureTimerConfig;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
}

export const NEN_199X_TEMPLATES: Nen199xTask[] = [
  {
    id: 'NEN-1992-02-VERDICHTING',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1992_CURRENT_EDITION,
    inspectionPointId: 'beton-ontkisting-kwaliteit',
    normCodes: [NEN_1992_CURRENT_EDITION, 'Bbl'],
    component: 'Betonkwaliteit na ontkisting',
    description: 'Visuele controle op grindnesten, scheurvorming en homogeniteit na het storten en ontkisten.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer het betonoppervlak direct na ontkisting. Grote grindnesten of zichtbare wapening door onvoldoende verdichting moeten visueel uitgesloten worden.',
    requiresExif: true,
    stopMoment: 'NA ONTKISTEN',
  },

  // NEN-EN 1993 (Staalconstructies)
  {
    id: 'NEN-1993-01-BOUTEN',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1993_CURRENT_EDITION,
    inspectionPointId: 'staal-boutverbindingen',
    normCodes: [NEN_1993_CURRENT_EDITION, 'Bbl'],
    component: 'Structurele Boutverbindingen',
    description: 'Beoordeling van staal-op-staal verbindingen en hun aandraaimoment of voorspanning.',
    builderInstruction: 'WKB STOPMOMENT: Leg vitale boutverbindingen (bijv. in spanten of kolommen) vast. Toon eventuele markeringen van de momentsleutel aan ter bewijs van het correcte aandraaimoment.',
    requiresExif: true,
    stopMoment: 'VOOR BEKLEDING',
    aiValidationKey: 'DETECT_STEEL_BOLTS',
  },
  {
    id: 'NEN-1993-02-BRANDWEREND',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1993_CURRENT_EDITION,
    inspectionPointId: 'staal-brandwerende-bekleding',
    normCodes: [NEN_1993_CURRENT_EDITION, 'NEN-EN 13381', 'Bbl'],
    component: 'Brandwerende Bekleding / Coating',
    description: 'Aanwezigheid van beschermende coating of ommanteling ter voorkoming van bezwijken bij brand.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer de stalen draagconstructie om te bewijzen dat deze adequaat gemenied is of voorzien van opschuimende brandwerende coating (indien van toepassing voor 60/90/120 min deis).',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
  },

  // NEN-EN 1995 (Houtconstructies)
  {
    id: 'NEN-1995-01-HOUTVERBINDING',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1995_CURRENT_EDITION,
    inspectionPointId: 'hout-raveeldragers',
    normCodes: [NEN_1995_CURRENT_EDITION, 'Bbl'],
    component: 'Balkdragers, Ankers & Houtverbindingen',
    description: 'Correcte bevestiging (vernageling/schroeven) van houten balklagen en raveeldragers.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer de stalen raveeldragers of hoekankers aan de houten balklaag/kapconstructie. Het moet duidelijk zijn dat (ribbel)nagels of schroeven conform opgave constructeur zijn aangebracht, zonder lege gaten.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKING',
    aiValidationKey: 'DETECT_TIMBER_JOIST_HANGER',
  },
  {
    id: 'NEN-1995-02-VERANKERING',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1995_CURRENT_EDITION,
    inspectionPointId: 'hout-windverankering',
    normCodes: [NEN_1995_CURRENT_EDITION, 'Bbl'],
    component: 'Windverankering Kapconstructie',
    description: 'Borging van de muurplaat, kapspanten en windbokken tegen opwaartse / zijwaardse windbelasting.',
    builderInstruction: 'WKB STOPMOMENT: Leg ankers, muurplaatverbindingen of nokgordingen vast met focus op de bevestiging aan de onderliggende dragende structuur ter voorkoming van opwaaien.',
    requiresExif: true,
    stopMoment: 'VOOR PANLAT & AFWERKING',
  },

  // NEN-EN 1996 (Metselwerkconstructies)
  {
    id: 'NEN-1996-01-SPOUWANKERS',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1996_CURRENT_EDITION,
    inspectionPointId: 'metselwerk-spouwankers',
    normCodes: [NEN_1996_CURRENT_EDITION, 'Bbl'],
    component: 'Spouwankers & Aantallen',
    description: 'Controle op de voorgeschreven hoeveelheid en correcte plaatsing van rvs spouwankers.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer het binnenspouwblad in de ruwbouwfase met een breedbeeld of overzichtsopname. Men moet het aantal spouwankers (bijv. 4 of 6 per m2) visueel kunnen controleren, inclusief afwaterende helling.',
    requiresExif: true,
    stopMoment: 'VOOR ISOLATIE',
    aiValidationKey: 'DETECT_WALL_TIES',
  },
  {
    id: 'NEN-1996-02-LATEIEN',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1996_CURRENT_EDITION,
    inspectionPointId: 'metselwerk-latei-oplegging',
    normCodes: [NEN_1996_CURRENT_EDITION, 'Bbl'],
    component: 'Oplegging Lateien',
    description: 'Minimale gecalculeerde en voorgeschreven opleglengte van een latei in de baksteenwand.',
    builderInstruction: 'WKB STOPMOMENT: Leg de oplegging van betonnen of stalen lateien (boven negges/kozijnen) vast. Plaats de rolmaat om te bewijzen dat de minimale opleg (bijv. >100mm of >150mm) gehaald is.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'TIJDENS METSELEN',
    aiValidationKey: 'DETECT_LINTEL_BEARING',
  },
  
  // NEN-EN 1997 (Geotechnisch ontwerp / Fundering)
  {
    id: 'NEN-1997-01-FUNDERING',
    discipline: 'Constructieve Veiligheid',
    nenNorm: NEN_1997_CURRENT_EDITION,
    inspectionPointId: 'fundering-paal-001',
    normCodes: [NEN_1997_CURRENT_EDITION, 'Bbl'],
    component: 'Zichtcontrole Heipalen / Boorpalen',
    description: 'Controle van gesnelde of geboorde palen op positie en paalkoppen voorafgaand aan storten van de balk.',
    builderInstruction: 'WKB STOPMOMENT: Fotografeer de gesnelde/geboorde paal met blootliggende wapening in de ontgraven funderingssleuf. De paalkop moet overzichtelijk in beeld zijn om de positie t.o.v. de mal/bekisting te verifiëren.',
    requiresExif: true,
    stopMoment: 'VOOR STORTEN FUNDERINGSBALK',
    aiValidationKey: 'DETECT_FOUNDATION_PILE',
  },
];
