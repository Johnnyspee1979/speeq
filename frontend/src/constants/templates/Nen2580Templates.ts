import type { AiValidationKey } from '../../types/CaptureTask';

const NEN_2580_CURRENT_EDITION = 'NEN 2580 / Bbl' as const;

export interface Nen2580Task {
  id: string;
  discipline: 'Bouwfysica & Gebruik';
  nenNorm: typeof NEN_2580_CURRENT_EDITION;
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

export const NEN_2580_TEMPLATES: Nen2580Task[] = [
  {
    id: 'NEN-2580-01-GO-LASERMETING',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-go-lasermeting-001',
    normCodes: ['NEN 2580', 'Bbl'],
    component: 'Gebruiksoppervlakte (GO) - Horizontale Lasermeting',
    description:
      'Laserafstandsmeter tussen afgewerkte scheidende wanden met scherp leesbare displaywaarde.',
    builderInstruction:
      'WKB STOPMOMENT: Maak in het verblijfsgebied een detailfoto van de ingeschakelde laserafstandsmeter tussen de afgewerkte wanden. Zorg dat de laserstraal en het afgelezen getal op het display scherp zichtbaar zijn, zodat de netto lengte of breedte van de Gebruiksoppervlakte (GO) as-built onweerlegbaar is vastgelegd.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'NA AFWERKING / VOOR OPLEVERING',
    aiValidationKey: 'OCR_LASER_DISPLAY',
  },
  {
    id: 'NEN-2580-02-1500MM-LIJN',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-1500mm-lijn-001',
    normCodes: ['NEN 2580', 'Bbl'],
    component: '1,5-meter Contourlijn onder Schuine Kap',
    description:
      'Verticale rolmaat vanaf de afgewerkte vloer tot het raakpunt met de schuine kap op 1,5 meter hoogte.',
    builderInstruction:
      'Plaats een rolmaat of lasermeter verticaal op de afgewerkte vloer en fotografeer exact waar de 1,5 meter hoogtegrens de schuine kap raakt. Dit bewijst welke vloerdelen wel en niet meetellen voor de NEN 2580 Gebruiksoppervlakte (GO) onder een schuin dak.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'NA AFWERKING / VOOR OPLEVERING',
    aiValidationKey: 'DETECT_TAPE_MEASURE_HEIGHT',
  },
  {
    id: 'NEN-2580-03-VRIJE-HOOGTE',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-vrije-hoogte-001',
    normCodes: ['NEN 2580', 'Bbl'],
    component: 'Vrije Hoogte Verblijfsgebied',
    description:
      'Netto hoogte van afgewerkte vloer tot plafond in verblijfsgebied met digitaal meetdisplay in beeld.',
    builderInstruction:
      'Toon met een ingeschakelde lasermeter of andere digitale afstandsmeter de netto vrije hoogte van vloer tot plafond in het verblijfsgebied. Het display moet leesbaar zijn, zodat de minimale hoogte-eis conform Bbl en de NEN 2580-meetmethodiek direct aan het dossier kan worden toegevoegd.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'NA AFWERKING / VOOR OPLEVERING',
    aiValidationKey: 'OCR_LASER_DISPLAY',
  },
  {
    id: 'NEN-2580-04-BVO-GEVEL',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-bvo-buitenmaat-001',
    normCodes: ['NEN 2580', 'BAG'],
    component: 'Bruto Vloeroppervlakte (BVO) Buitenwerks',
    description:
      'Meting van de buitenwerkse geveldimensies ter bepaling van de totale Bruto Vloeroppervlakte.',
    builderInstruction:
      'WKB STOPMOMENT: Leg de buitengevel-breedte of uitbouw digitaal of met een (laser)meetlint vast. Deze maatvoering moet inclusief de constructieve scheidingswanden (spouw) worden opgenomen om de BVO of BAG-registratie as-built te verantwoorden.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_LASER_DISPLAY',
  },
  {
    id: 'NEN-2580-05-VIDES-TRAPGAT',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-sparing-groot-001',
    normCodes: ['NEN 2580'],
    component: 'Vides & Trapgaten (> 4m2 Uitzondering)',
    description:
      'Aantonen van de netto oppervlakte van structurele doorgangen / sparingen (groter dan 4 m2) die conform NEN 2580 afgetrokken worden van de GO/VVO.',
    builderInstruction:
      'Trek een meetlint langs de langste of breedste zijde van de sparing ván het trapgat, de lift of de vide. Maak een foto waarop de opening, en indien mogelijk de afgelezen afmeting (bijv. > 2.0x2.0m), duidelijk te zien is, omdat sparingen >4m2 niet in de Gebruiksoppervlakte meetellen.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR AFWERKING',
    aiValidationKey: 'DETECT_FLOOR_OPENING',
  },
  {
    id: 'NEN-2580-06-NISSEN-KLEIN',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-schacht-klein-001',
    normCodes: ['NEN 2580'],
    component: 'Leidingschachten & Nissen (< 0,5m2 Uitzondering)',
    description:
      'Meting van omkokerde technische schachten en nissen die kleiner zijn dan 0,5 m2 en daardoor tó́ch bij de GO of NVO worden opgeteld.',
    builderInstruction:
      'Leg met een duimstok of rolmaat de bruto buitenafmeting van de afgewerkte leidingschacht of koof vast. Het bewijs is nodig om aan te tonen dat deze structuur onder de NEN 2580 normgrens van 0,5m2 blijft en dus niet afgetrokken hoeft te worden van de verhuurbare/gebruiksoppervlakte.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'NA AFWERKING',
    aiValidationKey: 'DETECT_TAPE_MEASURE_HEIGHT', // Herbruikbaar voor rolmaten langs kleine objecten
  },
  {
    id: 'NEN-2580-07-BRUTO-INHOUD',
    discipline: 'Bouwfysica & Gebruik',
    nenNorm: NEN_2580_CURRENT_EDITION,
    inspectionPointId: 'nen2580-bruto-inhoud-001',
    normCodes: ['NEN 2580', 'Bbl'],
    component: 'Bruto Inhoud (BXI) & Daknok Hoogte',
    description:
      'Vastleggen van de afstand tussen de onderkant van de begane grondvloer (peil) en de bovenkant van het dakdak/nok ten behoeve van de gebouwinhoud.',
    builderInstruction:
      'Fotografeer de gevel inclusief een in het veld geplaatste total-station (theodoliet) display of een op peil gerichte digitale (laser)meter. Het bepalen van de werkelijke gebouwhoogte is fundamenteel voor de berekening van de Bruto Inhoud (BXI) as-built.',
    requiresExif: true,
    stopMoment: 'VOOR OPLEVERING',
    aiValidationKey: 'OCR_LASER_DISPLAY',
  },
];
