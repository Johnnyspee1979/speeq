export interface ConstructieTask {
  id: string;
  inspectionPointId: string;
  normCodes: string[];
  component: string;
  description: string;
  builderInstruction: string;
  requiresExif: boolean;
  requiresMeasurementTool?: boolean;
  stopMoment?: string;
}

/**
 * Detailtemplates voor constructie en fundering.
 * Deze set voedt zowel de NEN smart templates als de standaard WKB-selectie.
 */
export const CONSTRUCTIE_TEMPLATES: ConstructieTask[] = [
  {
    id: 'CON-1992-WAPENING',
    inspectionPointId: 'kik-wapening-002',
    normCodes: ['NEN-EN 1990', 'NEN-EN 1992-1-1', 'NEN-EN 1992-1-2'],
    component: 'Betondekking & Wapening',
    description: 'Stopmoment voor wapening, afstandhouders en stortgereed detail.',
    builderInstruction:
      "WKB STOPMOMENT: maak voor de stort detailfoto's van de wapeningskorf. Zorg dat de dekkingsblokjes, afstandhouders en bekisting goed zichtbaar zijn. Dit bewijst de minimale betondekking tegen corrosie en voor de brandwerendheid van de constructie.",
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR STORT',
  },
  {
    id: 'CON-1992-BETONBON',
    inspectionPointId: 'betonbon-constructie-001',
    normCodes: ['NEN-EN 1990', 'NEN-EN 1992-1-1'],
    component: 'Betonkwaliteit (Leveringsbon)',
    description: 'Betonbon met sterkteklasse en milieuklasse voor het constructiedossier.',
    builderInstruction:
      'Fotografeer de betonbon van de betonmixer. Zorg dat sterkteklasse, milieuklasse, stortdatum en volume leesbaar zijn, zodat de constructeur en kwaliteitsborger de toegepaste betonkwaliteit kunnen herleiden.',
    requiresExif: true,
    stopMoment: 'BIJ STORT',
  },
  {
    id: 'CON-1996-LATEI',
    inspectionPointId: 'latei-oplegging-001',
    normCodes: ['NEN-EN 1996-1-1', 'BRL 1330-1'],
    component: 'Oplegging Lateien & Metselwerk',
    description: 'Opleglengte van latei of drager boven gevelopening met rolmaat in beeld.',
    builderInstruction:
      'Houd een rolmaat bij de rand van de latei of drager boven de gevelopening. Fotografeer dit om te bewijzen dat de minimale opleglengte conform de constructietekening is gehaald.',
    requiresExif: true,
    requiresMeasurementTool: true,
    stopMoment: 'VOOR DICHTZETTEN',
  },
  {
    id: 'CON-1995-HOUT',
    inspectionPointId: 'hout-oplegging-001',
    normCodes: ['NEN-EN 1995-1-1'],
    component: 'Oplegging Houtconstructie',
    description: 'Aansluiting van balklaag of prefab kap op bouwmuur, penant of anker.',
    builderInstruction:
      'Maak een detailfoto van de verbinding of oplegging van de houten balklaag of prefab sporenkap op de bouwmuren of penanten. Zorg dat ankers, klossen of verankeringen zichtbaar zijn.',
    requiresExif: true,
    stopMoment: 'VOOR AFWERKEN',
  },
];
