import type { AiValidationKey, CaptureTask } from '../types/CaptureTask';
import { AFBOUW_TEMPLATES } from './templates/AfbouwTemplates';
import { BOUWFYSICA_TEMPLATES } from './templates/BouwfysicaTemplates';
import { BRANDVEILIGHEID_TEMPLATES } from './templates/BrandveiligheidTemplates';
import { CONSTRUCTIE_TEMPLATES } from './templates/ConstructieTemplates';
import { ELEKTROTECHNIEK_TEMPLATES } from './templates/ElektrotechniekTemplates';
import { INSTALLATIE_TEMPLATES } from './templates/InstallatieTemplates';
import { NEN_13914_TEMPLATES } from './templates/Nen13914Templates';
import { NEN_1006_TEMPLATES } from './templates/Nen1006Templates';
import { NEN_1010_TEMPLATES } from './templates/Nen1010Templates';
import { NEN_1814_TEMPLATES } from './templates/Nen1814Templates';
import { NEN_1087_TEMPLATES } from './templates/Nen1087Templates';
import { NEN_1078_TEMPLATES } from './templates/Nen1078Templates';
import { NEN_2580_TEMPLATES } from './templates/Nen2580Templates';
import { NEN_3215_TEMPLATES } from './templates/Nen3215Templates';
import { NEN_3569_TEMPLATES } from './templates/Nen3569Templates';
import { NEN_5077_TEMPLATES } from './templates/Nen5077Templates';
import { NEN_6068_6069_TEMPLATES } from './templates/Nen6068_6069Templates';
import { NEN_9120_TEMPLATES } from './templates/Nen9120Templates';

export type DisciplineId =
  | 'constructie_fundering'
  | 'elektrotechniek'
  | 'installatie_water_gas'
  | 'bouwfysica_gebruik'
  | 'brandveiligheid'
  | 'dak_gevel'
  | 'afbouw';

export type NenIconName =
  | 'Hammer'
  | 'Zap'
  | 'Droplet'
  | 'Flame'
  | 'Home'
  | 'Layout';

export type NenCategory =
  | 'Constructie'
  | 'Brandveiligheid'
  | 'Installatie'
  | 'Bouwfysica'
  | 'Afbouw';

export interface NenTask {
  id: string;
  inspectionPointId?: string;
  title: string;
  instruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  timerConfig?: import('../types/CaptureTask').CaptureTimerConfig;
  stopMoment?: string;
  aiValidationKey?: AiValidationKey;
  normCodes: string[];
}

export interface Discipline {
  id: DisciplineId;
  title: string;
  iconName: NenIconName;
  standards: string;
  description: string;
  accentColor: string;
  summaryNorms: string[];
  tasks: NenTask[];
}

export interface NenNorm {
  code: string;
  title: string;
  category: NenCategory;
  description: string;
  wkbCheck: string;
  keywords: string[];
  disciplineIds: DisciplineId[];
  primaryDisciplineId: DisciplineId;
}

/**
 * Context-aware NEN smart templates voor Wkb bewijsvoering op discipline-niveau.
 * De bouwvakker kiest een vakgebied; de app vertaalt dit naar concrete borgingsopgaven.
 */
export const NEN_DISCIPLINES: Discipline[] = [
  {
    id: 'constructie_fundering',
    title: 'Constructie & Fundering',
    iconName: 'Hammer',
    standards:
      'NEN-EN 1990 / 1991 / 1992 / 1993 / 1995 / 1996 / NEN 8700 / NTA 8790',
    description:
      'Constructieve veiligheid voor nieuwbouw, verbouw en bestaande draagconstructies.',
    accentColor: '#FF6B35',
    summaryNorms: [
      'NEN-EN 1990',
      'NEN-EN 1991-serie',
      'NEN-EN 1992-1-1',
      'NEN-EN 1993',
      'NEN 8700',
    ],
    tasks: [
      ...CONSTRUCTIE_TEMPLATES.map((template) => ({
        id: template.id,
        inspectionPointId: template.inspectionPointId,
        title: template.component,
        instruction: template.builderInstruction,
        requiresExif: template.requiresExif,
        requiresMeasurementTool: template.requiresMeasurementTool,
        stopMoment: template.stopMoment,
        normCodes: template.normCodes,
      })),
      {
        id: 'CON-8700-BESTAAND',
        title: 'Bestaande bouw en verbouwconstructie',
        instruction:
          'Fotografeer bestaande draagconstructies, versterkingen en aansluitdetails bij verbouw. Zorg dat scheurvorming, opleggingen en nieuwe ankers scherp zichtbaar zijn.',
        requiresExif: true,
        normCodes: ['NEN 8700', 'NTA 8790'],
      },
    ],
  },
  {
    id: 'elektrotechniek',
    title: 'Elektrotechniek',
    iconName: 'Zap',
    standards: 'NEN 1010:2020+C1:2024 / NEN 3140',
    description:
      'Laagspanningsveiligheid, verdeelinrichtingen en beheer van bestaande installaties.',
    accentColor: '#F5B700',
    summaryNorms: ['NEN 1010:2020+C1:2024', 'NEN 3140'],
    tasks: [...NEN_1010_TEMPLATES, ...ELEKTROTECHNIEK_TEMPLATES].map((template) => ({
      id: template.id,
      inspectionPointId: template.inspectionPointId,
      title: template.component,
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      normCodes: template.normCodes,
    })),
  },
  {
    id: 'installatie_water_gas',
    title: 'Water, Gas & Klimaat',
    iconName: 'Droplet',
    standards: 'NEN 1006 / NEN 1078:2024 / NEN 3215 / NEN 1087 / NEN 8087',
    description:
      'Drinkwater, gas, riolering en ventilatie met focus op veiligheid, afschot en inregeling.',
    accentColor: '#0A84FF',
    summaryNorms: ['NEN 1006', 'NEN 1078:2024', 'NEN 3215', 'NEN 1087', 'NEN 8087'],
    tasks: [...NEN_1006_TEMPLATES, ...NEN_1078_TEMPLATES, ...NEN_3215_TEMPLATES, ...NEN_1087_TEMPLATES, ...INSTALLATIE_TEMPLATES].map((template) => ({
      id: template.id,
      inspectionPointId: template.inspectionPointId,
      title: template.component,
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      requiresTimer: template.requiresTimer,
      timerConfig: template.timerConfig,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      normCodes: template.normCodes,
    })),
  },
  {
    id: 'bouwfysica_gebruik',
    title: 'Bouwfysica & Gebruik',
    iconName: 'Home',
    standards:
      'NTA 8800 / NEN 5077 / NEN 2580 / NEN 1814 / NEN 9120:2025 / NEN-EN 17037',
    description:
      'Bewijsvoering voor energieprestatie, geluid, maatvoering, toegankelijkheid, steunbeugels en daglicht.',
    accentColor: '#0E7490',
    summaryNorms: [
      'NTA 8800',
      'NEN 5077',
      'NEN 2580',
      'NEN 1814',
      'NEN 9120:2025',
      'NEN-EN 17037',
    ],
    tasks: [...NEN_5077_TEMPLATES, ...NEN_2580_TEMPLATES, ...NEN_1814_TEMPLATES, ...NEN_9120_TEMPLATES, ...BOUWFYSICA_TEMPLATES].map(
      (template) => ({
        id: template.id,
        inspectionPointId: template.inspectionPointId,
        title: template.component,
        instruction: template.builderInstruction,
        requiresExif: template.requiresExif,
        requiresMeasurementTool: template.requiresMeasurementTool,
        stopMoment: template.stopMoment,
        aiValidationKey: template.aiValidationKey,
        normCodes: template.normCodes,
      })
    ),
  },
  {
    id: 'brandveiligheid',
    title: 'Brand- & Rookwerendheid',
    iconName: 'Flame',
    standards: 'NEN 6068 / NEN 6069 / NEN 6075 / NEN-EN 13501',
    description:
      'WBDBO, compartimentering, brandwerendheid van bouwdelen en rookwering per brandscheiding.',
    accentColor: '#FF453A',
    summaryNorms: ['NEN 6068', 'NEN 6069', 'NEN 6075', 'NEN-EN 13501-1', 'NEN-EN 13501-6'],
    tasks: [...NEN_6068_6069_TEMPLATES, ...BRANDVEILIGHEID_TEMPLATES].map((template) => ({
      id: template.id,
      inspectionPointId: template.inspectionPointId,
      title: template.component,
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      normCodes: template.normCodes,
    })),
  },
  {
    id: 'dak_gevel',
    title: 'Dak & Gevel',
    iconName: 'Layout',
    standards: 'NEN 6050 / NEN 6063',
    description:
      'Brandveilig werken op daken en beheersen van brandgevaarlijke dakdetails.',
    accentColor: '#30B0C7',
    summaryNorms: ['NEN 6050', 'NEN 6063'],
    tasks: [
      {
        id: 'dg1',
        title: 'No-flame zone en dakdetail',
        instruction:
          'Toon de 75 cm no-flame zone rondom opstanden, koepels en doorvoeren. Zelfklevende of gefohnde membranen moeten zichtbaar zijn zonder schroeisporen.',
        requiresExif: true,
        normCodes: ['NEN 6050', 'NEN 6063'],
      },
    ],
  },
  {
    id: 'afbouw',
    title: 'Afbouw & Glas',
    iconName: 'Layout',
    standards: 'NEN-EN 13914-1 / NEN-EN 13914-2 / NEN 3569',
    description:
      'Vlakheidstoleranties, strijklichtgevoelige oplevering en letselveilig glas in risicogebieden.',
    accentColor: '#34C759',
    summaryNorms: ['NEN-EN 13914-1', 'NEN-EN 13914-2', 'NEN 3569'],
    tasks: [...NEN_13914_TEMPLATES, ...NEN_3569_TEMPLATES, ...AFBOUW_TEMPLATES].map((template) => ({
      id: template.id,
      inspectionPointId: template.inspectionPointId,
      title: template.component,
      instruction: template.builderInstruction,
      requiresExif: template.requiresExif,
      requiresMeasurementTool: template.requiresMeasurementTool,
      stopMoment: template.stopMoment,
      aiValidationKey: template.aiValidationKey,
      normCodes: template.normCodes,
    })),
  },
];

/**
 * Volledige NEN/Bbl catalogus die de compliance-engine en fuzzy search voedt.
 */
export const NEN_NORM_DATABASE: NenNorm[] = [
  {
    code: 'NEN-EN 1990',
    title: 'Grondslagen van het constructief ontwerp',
    category: 'Constructie',
    description:
      'Bepaalt de uitgangspunten, betrouwbaarheid en gevolgklasse van de constructieve opzet.',
    wkbCheck:
      'Leg het dragende detail vast waarop de gevolgklasse en het as-built ontwerp zijn gebaseerd.',
    keywords: ['constructie', 'gevolgklasse', 'cc1', 'fundering', 'draagconstructie'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1991-serie',
    title: 'Belastingen op constructies',
    category: 'Constructie',
    description:
      'Omvat eigen gewicht, gebruiksbelasting, wind, sneeuw en bijzondere belastingen.',
    wkbCheck:
      'Fotografeer kritieke constructie- en verankeringsdetails die belastingen moeten afdragen.',
    keywords: ['belasting', 'wind', 'sneeuw', 'eigen gewicht', 'verankering'],
    disciplineIds: ['constructie_fundering', 'dak_gevel'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1992-1-1',
    title: 'Ontwerp en berekening van betonconstructies',
    category: 'Constructie',
    description:
      'Toetst betonconstructies, wapening, dekking en uitvoering van betondetails.',
    wkbCheck:
      'Foto van wapening, dekking en afstandhouders voor de betonstort, plus een leesbare betonbon met sterkte- en milieuklasse.',
    keywords: ['beton', 'wapening', 'dekking', 'korf', 'stort', 'betonbon', 'afstandhouder'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1992-1-2',
    title: 'Brandwerendheid van betonconstructies',
    category: 'Constructie',
    description:
      'Voegt brandwerendheidscriteria toe aan betonnen draagconstructies.',
    wkbCheck:
      'Leg dekking, detaillering en brandkritische betondelen vast voor de stort of afwerking.',
    keywords: ['brandwerend', 'beton', 'brand', 'dekking'],
    disciplineIds: ['constructie_fundering', 'brandveiligheid'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1993',
    title: 'Ontwerp en berekening van staalconstructies',
    category: 'Constructie',
    description:
      'Beschrijft de eisen voor stalen kolommen, liggers, knooppunten en verbindingen.',
    wkbCheck:
      'Fotografeer stalen knooppunten, boutverbindingen, lasnaden en opleggingen.',
    keywords: ['staal', 'kolom', 'ligger', 'bout', 'las'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1994',
    title: 'Ontwerp van staal-betonconstructies',
    category: 'Constructie',
    description:
      'Gaat over samengestelde staal-betonconstructies en hun verbindingen.',
    wkbCheck:
      'Leg deuvels, ankers en staal-betonaansluitingen vast in het werk.',
    keywords: ['staal-beton', 'samengesteld', 'deuvel', 'anker'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1995',
    title: 'Ontwerp en berekening van houtconstructies',
    category: 'Constructie',
    description:
      'Bepaalt eisen voor houten draagconstructies, verbindingen en stabiliteit.',
    wkbCheck:
      'Fotografeer houtverbindingen, plaatmaterialen, schoren en bevestigingsmiddelen.',
    keywords: ['hout', 'houtskelet', 'verbinding', 'schroef', 'ankers', 'balklaag', 'sporenkap'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN-EN 1996',
    title: 'Ontwerp en berekening van metselwerkconstructies',
    category: 'Constructie',
    description:
      'Beschrijft stabiliteit, opleggingen en detaillering van metselwerkconstructies.',
    wkbCheck:
      'Leg lateien, kimlagen, wapening en dilataties in metselwerk vast.',
    keywords: ['metselwerk', 'latei', 'kim', 'dilatatie', 'muur', 'oplegging', 'rolmaat'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN 8700',
    title: 'Constructieve veiligheid bestaande bouw',
    category: 'Constructie',
    description:
      'Geeft beoordelingsregels voor bestaande bouwwerken en verbouwsituaties.',
    wkbCheck:
      'Maak bewijsfoto\'s van bestaande draagdelen, versterkingen en aansluitingen.',
    keywords: ['bestaande bouw', 'verbouw', 'versterking', 'constructieve veiligheid'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NTA 8790',
    title: 'Beoordeling constructieve veiligheid bij verbouw',
    category: 'Constructie',
    description:
      'Aanvullende methodiek voor bestaande constructies en verbouwprojecten.',
    wkbCheck:
      'Fotografeer het bestaande detail en de nieuwe ingreep in een duidelijke as-built set.',
    keywords: ['verbouw', 'bestaande bouw', 'beoordeling', 'constructie'],
    disciplineIds: ['constructie_fundering'],
    primaryDisciplineId: 'constructie_fundering',
  },
  {
    code: 'NEN 6068',
    title: 'WBDBO tussen brandcompartimenten',
    category: 'Brandveiligheid',
    description:
      'Bepaalt de weerstand tegen branddoorslag en brandoverslag tussen compartimenten.',
    wkbCheck:
      'Leg de complete brandscheiding vast met ononderbroken aansluiting op vloer, wand en plafond inclusief kritische WBDBO-details.',
    keywords: [
      'brand',
      'wbdbo',
      'brandscheiding',
      'compartiment',
      'schacht',
      'scheidingswand',
      '60 minuten',
    ],
    disciplineIds: ['brandveiligheid'],
    primaryDisciplineId: 'brandveiligheid',
  },
  {
    code: 'NEN 6069',
    title: 'Brandwerendheid van bouwdelen',
    category: 'Brandveiligheid',
    description:
      'Toetst brandwerendheid op criteria zoals draagvermogen, vlamdichtheid en isolatie.',
    wkbCheck:
      'Detailfoto van brandwerende doorvoering, deurset, klep of classificatielabel waarmee de brandwerendheid van het bouwdeel herleidbaar blijft.',
    keywords: [
      'brandwerendheid',
      'doorvoering',
      'manchet',
      'branddeur',
      'ei30',
      'ei60',
      'brandklep',
      'kit',
    ],
    disciplineIds: ['brandveiligheid'],
    primaryDisciplineId: 'brandveiligheid',
  },
  {
    code: 'NEN 6075',
    title: 'Weerstand tegen rookdoorgang',
    category: 'Brandveiligheid',
    description:
      'Beschrijft de eisen voor rookwering, uitgedrukt in Sa en S200.',
    wkbCheck:
      'Fotografeer rookwerende strips, valdorpels en deuraansluitingen zonder kieren.',
    keywords: ['rook', 'rookwerend', 'sa', 's200', 'valdorpel', 'deur'],
    disciplineIds: ['brandveiligheid'],
    primaryDisciplineId: 'brandveiligheid',
  },
  {
    code: 'NEN-EN 13501-1',
    title: 'Brandclassificatie van bouwproducten',
    category: 'Brandveiligheid',
    description:
      'Classificeert bouwproducten op reactie bij brand, rook en brandende druppels.',
    wkbCheck:
      'Leg productlabels en aangebrachte bouwproducten vast met leesbare brandklasse.',
    keywords: ['brandklasse', 'bouwproduct', 'label', 'classificatie'],
    disciplineIds: ['brandveiligheid', 'dak_gevel'],
    primaryDisciplineId: 'brandveiligheid',
  },
  {
    code: 'NEN-EN 13501-6',
    title: 'Brandclassificatie van elektrische kabels',
    category: 'Brandveiligheid',
    description:
      'Classificeert elektrische kabels op brandgedrag en rookproductie.',
    wkbCheck:
      'Foto van kabelcodering en kabelgoten met leesbare classificatie.',
    keywords: ['kabel', 'rookklasse', 'brandklasse', 'kabelgoot'],
    disciplineIds: ['brandveiligheid', 'elektrotechniek'],
    primaryDisciplineId: 'brandveiligheid',
  },
  {
    code: 'NEN 6050',
    title: 'Brandveilig werken op daken',
    category: 'Brandveiligheid',
    description:
      'Regelt veilige uitvoering van brandgevaarlijke werkzaamheden op platte daken.',
    wkbCheck:
      'Toon de no-flame zone en het type aangebrachte dakbedekking rondom opstanden.',
    keywords: ['dak', 'no flame', 'brandveilig', 'koepel', 'opstand'],
    disciplineIds: ['dak_gevel'],
    primaryDisciplineId: 'dak_gevel',
  },
  {
    code: 'NEN 6063',
    title: 'Brandgevaarlijkheid van daken',
    category: 'Brandveiligheid',
    description:
      'Beoordeelt de brandgevaarlijkheid van daken en toegepaste dakopbouw.',
    wkbCheck:
      'Fotografeer de dakopbouw, aansluitingen en toegepaste membranen rond kwetsbare zones.',
    keywords: ['dak', 'brandgevaarlijkheid', 'dakopbouw', 'membraan'],
    disciplineIds: ['dak_gevel'],
    primaryDisciplineId: 'dak_gevel',
  },
  {
    code: 'NEN 1010',
    title: 'Veilige elektrische laagspanningsinstallaties',
    category: 'Installatie',
    description:
      'De hoofdnorm voor veilige laagspanningsinstallaties, meterkasten, aardlekbeveiliging, PV-aansluitingen, badkamers en verborgen leidinginfrastructuur.',
    wkbCheck:
      'Leg geopende meterkast met aardlekverdeling, 30 mA-specificaties, PV-eindgroep, PV-waarschuwingssticker, typekeuze van aardlekbeveiliging, potentiaalvereffening, testresultaten en centraaldozen vast voordat wanden of plafonds worden gesloten.',
    keywords: [
      'elektra',
      'meterkast',
      'groepenkast',
      'aardlek',
      'aardlekschakelaar',
      '30ma',
      'rcd',
      'type a',
      'pv',
      'omvormer',
      'zonnepanelen',
      'laadpaal',
      'rdc-dd',
      'type b',
      'uitschakeltijd',
      'installatietester',
      'sticker',
      'badkamer',
      'aarding',
      'vereffening',
      'cap',
      'kleurcodering',
      'centraaldoos',
      'schakelaar',
      'wandcontactdoos',
      'ip44',
      'buis',
      'beugeling',
    ],
    disciplineIds: ['elektrotechniek'],
    primaryDisciplineId: 'elektrotechniek',
  },
  {
    code: 'NEN 3140',
    title: 'Veilige bedrijfsvoering van bestaande installaties',
    category: 'Installatie',
    description:
      'Gaat over veilig gebruik, beheer en werkzaamheden aan bestaande elektrische installaties.',
    wkbCheck:
      'Leg spanningsloze toestand, veilige afscherming en werkvoorbereiding vast.',
    keywords: ['bestaande installatie', 'spanningsloos', 'renovatie', 'veilig werken'],
    disciplineIds: ['elektrotechniek'],
    primaryDisciplineId: 'elektrotechniek',
  },
  {
    code: 'NEN 1006',
    title: 'Algemene voorschriften voor leidingwaterinstallaties',
    category: 'Installatie',
    description:
      'Richt zich op drinkwaterveiligheid, legionellabeheersing, mantelbuizen en persproeven volgens WB 2.3.',
    wkbCheck:
      'Leg leidingafstand, mantelbuisdoorvoeren en de tijdgestempelde manometerfoto’s van begin- en eindmeting vast.',
    keywords: [
      'water',
      'drinkwater',
      'legionella',
      'persproef',
      'wb 2.3',
      'manometer',
      'druktest',
      'hotspot',
      'koudwater',
      'warmwater',
      'mantelbuis',
      'doorvoer',
      's-koppeling',
      'spoelen',
    ],
    disciplineIds: ['installatie_water_gas'],
    primaryDisciplineId: 'installatie_water_gas',
  },
  {
    code: 'NEN 1078',
    title: 'Voorziening voor gas',
    category: 'Installatie',
    description:
      'Bepaalt eisen voor veilige aanleg, mantelbuisdoorvoeren en dichtheidsbeproeving van gasinstallaties met normatieve testduur.',
    wkbCheck:
      'Leg de gasleiding met ononderbroken mantelbuis bij doorvoeren vast en maak tijdgestempelde manometerfoto’s van begin- en eindmeting van de dichtheidsbeproeving conform Tabel A.1.',
    keywords: [
      'gas',
      'mantelbuis',
      'doorvoer',
      'gele leiding',
      'persproef',
      'dichtheidsbeproeving',
      'manometer',
      'gaslek',
      'tabel a.1',
      'testduur',
      'kruipruimte',
      'waterstof',
    ],
    disciplineIds: ['installatie_water_gas'],
    primaryDisciplineId: 'installatie_water_gas',
  },
  {
    code: 'NEN 3215',
    title: 'Gebouwriolering en hemelwaterafvoer',
    category: 'Installatie',
    description:
      'Regelt capaciteit, aansluitingen en het juiste afschot van riolering.',
    wkbCheck:
      'Leg afschot, waterslot, ontlastvoorziening en verbindingen van de gebouwriolering vast voordat deze verdwijnen.',
    keywords: [
      'riolering',
      'afschot',
      'waterpas',
      'spirit level',
      'waterslot',
      'sifon',
      'stankafsluiter',
      '50 mm',
      'hemelwater',
      'hwa',
      'ontlastvoorziening',
      'riool',
      'mofrichting',
      'beugeling',
      'lijmverbinding',
      'manchet',
      'grondleiding',
      'standleiding',
    ],
    disciplineIds: ['installatie_water_gas'],
    primaryDisciplineId: 'installatie_water_gas',
  },
  {
    code: 'NEN 1087',
    title: 'Ventilatie van gebouwen',
    category: 'Installatie',
    description:
      'Beschrijft ventilatie-eisen, luchtdebieten en inregeling van ventilatiesystemen voor nieuwbouw.',
    wkbCheck:
      'Leg ventilatie-unit, kanaalroute en debietmetingen op toevoer- en afvoerventielen vast met leesbare meetwaarden.',
    keywords: [
      'ventilatie',
      'debiet',
      'wtw',
      'mv',
      'inregelen',
      'anemometer',
      'flowmeter',
      'toevoerventiel',
      'afvoerventiel',
      'kanaalroute',
    ],
    disciplineIds: ['installatie_water_gas'],
    primaryDisciplineId: 'installatie_water_gas',
  },
  {
    code: 'NEN 8087',
    title: 'Ventilatie bestaande bouw',
    category: 'Installatie',
    description:
      'Aanvulling voor ventilatieprestaties, doorstroom en renovatie-aanpassingen in bestaande gebouwen.',
    wkbCheck:
      'Leg de toegepaste ventilatievoorziening, doorstroomopeningen en renovatie-aanpassingen in de bestaande situatie vast.',
    keywords: [
      'ventilatie',
      'bestaande bouw',
      'renovatie',
      'lucht',
      'doorstroom',
      'rooster',
      'onderkier',
      'renovatiekanaal',
    ],
    disciplineIds: ['installatie_water_gas'],
    primaryDisciplineId: 'installatie_water_gas',
  },
  {
    code: 'NTA 8800',
    title: 'Bepalingsmethode energieprestatie',
    category: 'Bouwfysica',
    description:
      'Stuurt de BENG-eisen en Rc-waarden van de thermische schil aan.',
    wkbCheck:
      'Fotografeer isolatiemateriaal, etiket, dikte en kierdichting van de schil.',
    keywords: [
      'energie',
      'beng',
      'isolatie',
      'rc',
      'schil',
      'qv10',
      'luchtdichtheid',
      'rolmaat',
      'etiket',
    ],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN 5077',
    title: 'Geluidwering in gebouwen',
    category: 'Bouwfysica',
    description:
      'Gaat over luchtgeluid, contactgeluid en installatiegeluid, waaronder buitenunits van warmtepompen en airco\'s.',
    wkbCheck:
      'Leg CE-label, afstand tot erfgrens, trillingsdempers en eventuele suskast van de warmtepomp as-built vast conform WPAC-berekening.',
    keywords: [
      'geluid',
      'akoestiek',
      'contactgeluid',
      'luchtgeluid',
      'warmtepomp',
      'airco',
      'trillingsdemper',
      'erfgrens',
      'perceelgrens',
      'wpac',
      'ce-label',
      'geluidsvermogen',
      'suskast',
      '40 db',
    ],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN 2580',
    title: 'Oppervlakten en inhouden van gebouwen',
    category: 'Bouwfysica',
    description:
      'Bepaalt hoe gebruiksoppervlakten, bruto vloeroppervlak en inhoud worden berekend.',
    wkbCheck:
      'Leg lasermaatvoering, 1,5-meter contourlijn onder schuine kap en vrije hoogte in verblijfsgebieden vast.',
    keywords: [
      'oppervlakte',
      'gbo',
      'go',
      'bvo',
      'nvo',
      'vvo',
      'maatvoering',
      'vloeroppervlak',
      'lasermeter',
      'schuine kap',
      '1,5 meter',
      'vrije hoogte',
    ],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN 1814',
    title: 'Toegankelijk bouwen - steunbeugels bij toiletten',
    category: 'Bouwfysica',
    description:
      'Beschrijft de plaatsing, montagehoogte, gripmaat en solide wandverankering van steunbeugels bij toegankelijke toiletten.',
    wkbCheck:
      'Leg in ruwbouw de dragende achterconstructie vast en bewijs bij afmontage met verticale maatvoering dat horizontale steunbeugels stevig en op 700-850 mm zijn gemonteerd.',
    keywords: [
      'toegankelijkheid',
      'nen 1814',
      '1814',
      'steunbeugel',
      'steunbeugels',
      'beugel',
      'rolstoeltoilet',
      'verankering',
      'wandverankering',
      'achterhout',
      'montageplaat',
      'dragende muur',
      '32 mm',
      '700 mm',
      '850 mm',
      '80 cm',
      '85 cm',
      'afmontage',
      'ruwbouw',
    ],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN 9120',
    title: 'Toegankelijkheid en bruikbaarheid van gebouwen',
    category: 'Bouwfysica',
    description:
      'De actuele toegankelijkheidsnorm voor deurbreedtes, drempels, toegangsroute en toegankelijke sanitaire maatvoering, waaronder rolstoeltoiletten en rolstoeltoegankelijke doucheruimten.',
    wkbCheck:
      'Leg netto vrije doorgang, drempelhoogte, toilet- en douche-binnenmaten, draaicirkels, deurzwaai-vrijhouding, wasbakhoogte, douche-gebruiksruimte en drempelloos doucheafschot vast met meetlint of waterpas op de foto.',
    keywords: [
      'toegankelijkheid',
      'nen 9120',
      '9120',
      'bbl',
      'deurbreedte',
      'deur',
      'drempel',
      'drempelhoogte',
      'toilet',
      'rolstoel',
      'rollator',
      'vrije doorgang',
      '900 mm',
      '850 mm',
      '20 mm',
      '750 mm',
      '1050 mm',
      '1200 mm',
      '1800 mm',
      '1650 mm',
      '2200 mm',
      '1500 mm',
      '500 mm',
      '550 mm',
      'draaicirkel',
      'naar buiten draaiende deur',
      'wasbak',
      'onderrijdbaar',
      'hangcloset',
      'zwevend toilet',
      'doucheruimte',
      'douche',
      'douchevloer',
      'douchezitje',
      'gebruiksruimte',
      'hulpverlening',
      'slipvrij',
      'afschot',
      '2%',
      'deurzwaai',
      'droge opstelruimte',
      'closethoogte',
      'rolstoeltoilet',
      'transferruimte',
      'invalidentoilet',
    ],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN-EN 17037',
    title: 'Daglichttoetreding in gebouwen',
    category: 'Bouwfysica',
    description:
      'Beschrijft eisen en beoordeling voor daglichttoetreding in verblijfsruimten.',
    wkbCheck:
      'Fotografeer raamopeningen, glasvlakken en belemmeringen voor daglichttoetreding.',
    keywords: ['daglicht', 'raam', 'kozijn', 'lichttoetreding', 'gevel'],
    disciplineIds: ['bouwfysica_gebruik'],
    primaryDisciplineId: 'bouwfysica_gebruik',
  },
  {
    code: 'NEN-EN 13914-1',
    title: 'Buitenbepleistering en vlakheid',
    category: 'Afbouw',
    description:
      'Beschrijft uitvoering en toleranties van buitenbepleistering.',
    wkbCheck:
      'Foto van een meetrei tegen het buitenstucwerk bij diffuus licht met aandacht voor aansluitingen, hoeken en dilataties.',
    keywords: [
      'stuc',
      'bepleistering',
      'vlakheid',
      'buiten',
      'buitenstuc',
      'gevelstuc',
      'meetrei',
      'strijklicht',
      'dilatatie',
    ],
    disciplineIds: ['afbouw'],
    primaryDisciplineId: 'afbouw',
  },
  {
    code: 'NEN-EN 13914-2',
    title: 'Binnenbepleistering en vlakheid',
    category: 'Afbouw',
    description:
      'Beschrijft uitvoering en toleranties van binnenbepleistering.',
    wkbCheck:
      'Foto van een meetrei tegen de binnenwand en een beoordeling bij diffuus licht zonder kunstmatig strijklicht.',
    keywords: [
      'stuc',
      'bepleistering',
      'vlakheid',
      'binnen',
      'binnenstuc',
      'wand',
      'strijklicht',
      'aluminium meetrei',
      'sausklare wand',
    ],
    disciplineIds: ['afbouw'],
    primaryDisciplineId: 'afbouw',
  },
  {
    code: 'NEN 3569',
    title: 'Letselveilig vlakglas',
    category: 'Afbouw',
    description:
      'Stelt eisen aan veiligheidsbeglazing in risicogebieden onder 0,85 meter.',
    wkbCheck:
      'Leg de veiligheidsstempel vast en toon met maatvoering of het glas in een risicogebied of looproute is geplaatst.',
    keywords: [
      'glas',
      'veiligheidsglas',
      'veiligheidsstempel',
      'glasstempel',
      'stempel',
      'ruit',
      'letselveilig',
      '33.1',
      '2B2',
      '0,85 m',
      '850 mm',
      'risicogebied',
      'zijlicht',
      'doorval',
    ],
    disciplineIds: ['afbouw'],
    primaryDisciplineId: 'afbouw',
  },
];

export const findNenDisciplineById = (disciplineId: DisciplineId) =>
  NEN_DISCIPLINES.find((discipline) => discipline.id === disciplineId);

export const getNenDisciplinesForNorm = (norm: NenNorm) =>
  norm.disciplineIds
    .map((disciplineId) => findNenDisciplineById(disciplineId))
    .filter((discipline): discipline is Discipline => Boolean(discipline));

export const toNenCaptureTask = (
  discipline: Discipline,
  task: NenTask
): CaptureTask => ({
  id: `nen-${discipline.id}-${task.id}`,
  title: task.title,
  description: discipline.description,
  inspectionPointId: task.inspectionPointId ?? task.id,
  instruction: task.instruction,
  standards: task.normCodes.join(' / ') || discipline.standards,
  disciplineTitle: discipline.title,
  requiresExif: task.requiresExif,
  requiresMeasurementTool: task.requiresMeasurementTool,
  requiresTimer: task.requiresTimer,
  timerConfig: task.timerConfig,
  stopMoment: task.stopMoment,
  aiValidationKey: task.aiValidationKey,
  selectionSource: 'NEN',
});

export const nenCaptureTasks: CaptureTask[] = NEN_DISCIPLINES.flatMap((discipline) =>
  discipline.tasks.map((task) => toNenCaptureTask(discipline, task))
);

export const findNenTaskContextByInspectionPointId = (inspectionPointId: string) => {
  for (const discipline of NEN_DISCIPLINES) {
    const task = discipline.tasks.find(
      (candidate) =>
        candidate.id === inspectionPointId ||
        candidate.inspectionPointId === inspectionPointId
    );

    if (task) {
      return {
        discipline,
        task,
      };
    }
  }

  return null;
};

export const findNenCaptureTaskByInspectionPointId = (inspectionPointId: string) =>
  nenCaptureTasks.find((task) => task.inspectionPointId === inspectionPointId);
