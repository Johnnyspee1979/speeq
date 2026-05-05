import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_5077_CURRENT_EDITION = 'NEN 5077 / Bbl art. 4.107' as const;

export interface Nen5077Task {
  id: string;
  discipline: 'Installatietechniek & Bouwfysica';
  nenNorm: typeof NEN_5077_CURRENT_EDITION;
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

export const NEN_5077_TEMPLATES: Nen5077Task[] = [
  {
    id: 'NEN-5077-01-AFSTAND-ERFGRENS',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'warmtepomp-erfgrens-afstand-001',
    normCodes: ['NEN 5077', 'Bbl art. 4.107'],
    component: 'Warmtepomp (Afstand tot Perceelgrens)',
    description:
      'Lasermeting of strakke rolmaat van buitenunit tot erfgrens of relevante gevelopening conform WPAC-berekening.',
    builderInstruction:
      'WKB STOPMOMENT: Bepaal de as-built afstand. Plaats een laserafstandsmeter vanaf de buitenunit van de warmtepomp of airco naar de kadastrale perceelgrens of relevante gevelopening. Fotografeer het opgelichte display om aan te tonen dat de opstelling voldoet aan de vooraf goedgekeurde WPAC-berekening en de 40 dB(A)-eis op de erfgrens.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_LASER_DISTANCE',
  },
  {
    id: 'NEN-5077-02-CE-LABEL-VERMOGEN',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'warmtepomp-ce-label-db-001',
    normCodes: ['NEN 5077', 'Bbl art. 4.107', 'CE-markering'],
    component: 'Warmtepomp (Geluidsvermogen CE-Markering)',
    description:
      'Close-up van typeplaatje of CE-label waarop het geluidsvermogen en typeaanduiding objectief leesbaar zijn.',
    builderInstruction:
      'Maak een haarscherpe close-up foto van het CE-label of typeplaatje op de buitenunit. De OCR-scanner valideert direct of het opgegeven dB(A)-geluidsvermogen overeenkomt met de projectspecificaties en de WPAC-berekening.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_CE_LABEL_DB',
  },
  {
    id: 'NEN-5077-03-TRILLINGSDEMPERS',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'warmtepomp-trillingsdempers-001',
    normCodes: ['NEN 5077', 'Bbl art. 4.107'],
    component: 'Warmtepomp (Akoestische Ontkoppeling)',
    description:
      'Detailfoto van big foots, rubberen dempers of trillingsvrije montagevoeten onder de buitenunit.',
    builderInstruction:
      'Maak een detailfoto van de montagepoten onder de warmtepomp. Bewijs visueel dat er deugdelijke rubberen trillingsdempers of akoestisch ontkoppelde montagevoeten zijn toegepast om hinderlijk contactgeluid en resonantie naar de woningconstructie te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_VIBRATION_DAMPERS',
  },
  {
    id: 'NEN-5077-04-SUSKAST',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'warmtepomp-suskast-001',
    normCodes: ['NEN 5077', 'Bbl art. 4.107', 'WPAC'],
    component: 'Warmtepomp (Geluidsisolerende Omkasting)',
    description:
      'Overzichtsfoto van suskast of akoestische omkasting met lamellen en vrije luchttoevoer rondom de buitenunit.',
    builderInstruction:
      'Indien de WPAC-berekening dit vereist wegens beperkte afstand tot buren: maak een overzichtsfoto van de correct gemonteerde geluidsisolerende suskast of omkasting inclusief lamellen aan de voorzijde om de akoestische maatregel as-built vast te leggen.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_ACOUSTIC_ENCLOSURE',
  },
  {
    id: 'NEN-5077-05-ZWEVENDE-DEKVLOER',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'akoestiek-vloer-001',
    normCodes: ['NEN 5077'],
    component: 'Zwevende Dekvloer (Randisolatie L<sub>n,T,A</sub>)',
    description:
      'Waarborgen van contactgeluidsisolatie door ononderbroken scheiding (kantstroken) tussen dekvloer en alle opgaande wanden/leidingen.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer vlak voor of tijdens de stort de randisolatie (foam- of kantstroken) die strak tegen alle wanden en leidingdoorvoeren is aangebracht. Er mag absoluut nergens hard contact (of mortelbruggen) ontstaan tussen de dekvloer en de bouwmuren om flankerend contactgeluid naar buren/onderburen te voorkomen.',
    requiresExif: true,
    stopMoment: 'VOOR STORT / AFWERKING',
    aiValidationKey: 'DETECT_EDGE_INSULATION',
  },
  {
    id: 'NEN-5077-06-WTW-DEMPINGSBEUGELS',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'akoestiek-wtw-beugel-001',
    normCodes: ['NEN 5077'],
    component: 'Installatiegeluid Binnen (WTW / Binnenunit WP)',
    description:
      'Aantonen akoestische ontkoppeling van binnen-installaties om structurele resonantie via draagmuren af te snijden.',
    builderInstruction:
      'Maak een detailfoto van de ophangbeugels van de ventilatie-unit (WTW), afzuigbox of de binnen-warmtepomp. Visueel moet waarneembaar zijn dat er rubbers of trillingsdempers tussen de schroefbevestiging en de muur/het plafond zitten, zodat het installatiegeluid niet resoneert in naastgelegen (slaap)kamers.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_VIBRATION_DAMPERS',
  },
  {
    id: 'NEN-5077-07-GELUIDGEDEMPTE-VENTILATIE',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'akoestiek-gevelroosters-001',
    normCodes: ['NEN 5077'],
    component: 'Geluidwerende Suskasten in Kozijnen (G<sub>A;k</sub>)',
    description:
      'Registratie van verzwaarde akoestische ventilatieroosters indien de gevelgeluidbelasting hoog is.',
    builderInstruction:
      'Wanneer het akoestisch rapport of Bouwbesluit sus-roosters eist in de gevel (wegens weg-, rail- of industrielawaai), fotografeer dan het binnendeel in het raamkozijn en bij voorkeur het typelabel waaruit de dempingswaarde blijkt. Gewone roosters volstaan hier niet.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'DETECT_ACOUSTIC_VENT',
  },
  {
    id: 'NEN-5077-08-KIERDICHTING-SCHACHTEN',
    discipline: 'Installatietechniek & Bouwfysica',
    nenNorm: NEN_5077_CURRENT_EDITION,
    inspectionPointId: 'akoestiek-kierdicht-001',
    normCodes: ['NEN 5077'],
    component: 'Kierdichting Woning-scheidende Cellen (D<sub>nT,A</sub>)',
    description:
      'Zekerstellen van ondoorlatende voegen rond schacht- of bouwmuren d.m.v. minerale wol of akoestische pur ten behoeve van luchtgeluidisolatie.',
    builderInstruction:
      'WKB STOPMOMENT: Fotografeer de dilataties of aansluitvoegen van de (woning-scheidende) bouwmuur of de schacht, vóórdat hier aftimmering en kit overheen gaat. De naad moet visueel aantoonbaar hermetisch gevuld zijn met flexibele (meestal roze/groene) akoestische purschuim of strak geperste wol. Een luchtlek is namelijk de doodsteek voor Dnt,A.',
    requiresExif: true,
    stopMoment: 'VOOR DICHTZETTEN / AFTIMMEREN',
    aiValidationKey: 'DETECT_ACOUSTIC_FOAM',
  },
];
