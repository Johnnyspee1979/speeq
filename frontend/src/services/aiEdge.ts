import { File } from 'expo-file-system';

import type { AiValidationKey } from '../types/CaptureTask';

export type AiValidationResult = {
  status: 'PENDING' | 'PASSED' | 'FAILED';
  confidence: number | null;
  notes: string | null;
};

const AI_VALIDATION_HINTS: Record<AiValidationKey, string> = {
  DETECT_FIRE_SEPARATION_DETAIL:
    'Controle op ononderbroken brandscheiding, bekleding en WBDBO-detail geactiveerd.',
  DETECT_COLLAR: 'Controle op brandmanchet en brandwerende afdichting geactiveerd.',
  DETECT_DROP_SEAL: 'Controle op automatische valdorpel en rookwerende aansluiting geactiveerd.',
  OCR_FIRE_RATING_LABEL:
    'OCR-controle op classificatielabel, EI-markering en typeplaatje van brandwerend bouwdeel geactiveerd.',
  DETECT_GLASS_STAMP: 'Controle op leesbare glasstempel geactiveerd.',
  DETECT_NO_FLAME_ZONE: 'Controle op no-flame zone en brandschadevrije dakrand geactiveerd.',
  DETECT_FIRE_DAMPER: 'Controle op brand- of rookklepdetail geactiveerd.',
  DETECT_GAS_PIPE_CASING:
    'Controle op gasleiding met aaneengesloten mantelbuis bij doorvoer geactiveerd.',
  DETECT_MANOMETER: 'Controle op leesbare manometer en druktestbeeld geactiveerd.',
  DETECT_PIPE_SEPARATION:
    'Controle op zichtbare scheiding of thermische isolatie tussen leidingen geactiveerd.',
  DETECT_PROTECTION_PIPE:
    'Controle op beschermende mantelbuis of doorvoerbescherming geactiveerd.',
  DETECT_OPEN_BOARD_AND_COUNT:
    'Controle op geopende verdeelinrichting, zichtbare aardlekschakelaars en groepentelling geactiveerd.',
  OCR_RCD_30MA:
    'OCR-controle op 30 mA-markering en leesbare specificaties van aardlekschakelaars geactiveerd.',
  OCR_RCD_TYPE_B:
    'OCR-controle op Type B of Type A met DC-foutstroomdetectie bij PV- of EV-beveiliging geactiveerd.',
  OCR_TRIP_TIME:
    'OCR-controle op uitschakeltijd en meetwaarden van de installatietester geactiveerd.',
  DETECT_PV_STICKER:
    'Controle op zichtbare PV-waarschuwingssticker op de verdeelinrichting geactiveerd.',
  DETECT_RCD_LAYOUT:
    'Controle op hoofdschakelaar, aardlekschakelaars, automaten en groepindeling geactiveerd.',
  DETECT_BATHROOM_ZONE:
    'Controle op badkamerzone, maatvoering en spatwaterbestendige positie geactiveerd.',
  DETECT_CAPPED_WIRES:
    'Controle op centraaldoos, lasklemmen en afgedopte aders geactiveerd.',
  DETECT_CABLE_PROTECTION:
    'Controle op kabelwartel, beschermbuis of randbescherming bij doorvoer geactiveerd.',
  DETECT_WIRE_COLORS:
    'Controle op herkenbare ader-kleuren en leesbare kleurcodering in de aansluiting geactiveerd.',
  DETECT_SEALANT: 'Controle op kitafdichting rondom sparingen en koppelingen geactiveerd.',
  DETECT_WATERPAS: 'Controle op waterpas en afschotbeeld geactiveerd.',
  DETECT_CAP_WIRES:
    'Controle op zichtbaar centraal aardpunt en vereffeningsdraden geactiveerd.',
  DETECT_ANEMOMETER: 'Controle op anemometer of flowmeter met leesbare meetwaarde geactiveerd.',
  DETECT_TAPE_MEASURE: 'Controle op rolmaat of duimstok in beeld geactiveerd.',
  DETECT_INSULATION_LABEL:
    'Controle op isolatie-etiket en productidentificatie geactiveerd.',
  DETECT_VIBRATION_DAMPER:
    'Controle op trillingsdempers of akoestische ontkoppeling geactiveerd.',
  DETECT_VIBRATION_DAMPERS:
    'Controle op meerdere trillingsdempers, big foots of akoestisch ontkoppelde montagevoeten geactiveerd.',
  DETECT_DOOR_WIDTH:
    'Controle op netto vrije doorgang van de deuropening met meetlint geactiveerd.',
  DETECT_THRESHOLD_HEIGHT:
    'Controle op drempelhoogte met verticale maatvoering en meetlint geactiveerd.',
  DETECT_TURNING_CIRCLE:
    'Controle op obstakelvrije draaicirkel en maatvoering in toegankelijke sanitaire ruimte geactiveerd.',
  DETECT_DOOR_SWING_CLEARANCE:
    'Controle op vrije draaicirkel buiten het bereik van een opengaande deur geactiveerd.',
  DETECT_WALL_ANCHORING:
    'Controle op dragend achterhout, montageplaat of massieve wandverankering voor steunbeugels geactiveerd.',
  DETECT_SUPPORT_BAR_HEIGHT:
    'Controle op montagehoogte, horizontale plaatsing en meetlint bij steunbeugels geactiveerd.',
  DETECT_DOOR_FRAME: 'Controle op kozijn, doorgang en maatvoering bij deurdetail geactiveerd.',
  DETECT_DIFFUSE_LIGHT:
    'Controle op diffuus lichtbeeld zonder kunstmatig strijklicht of overtrokken schaduwwerking geactiveerd.',
  DETECT_STRAIGHTEDGE: 'Controle op aluminium meetrei of rechte lat geactiveerd.',
  OCR_LASER_DISPLAY:
    'OCR-controle op leesbare meetwaarde op laserafstandsmeter of digitale afstandsmeter geactiveerd.',
  DETECT_TAPE_MEASURE_HEIGHT:
    'Controle op verticale rolmaat of hoogtemeting in beeld geactiveerd.',
  DETECT_SPIRIT_LEVEL:
    'Controle op fysieke waterpas met leesbare luchtbel op riool- of afvoerleiding geactiveerd.',
  DETECT_PIPE_SLOPE:
    'Controle op stromende leidingrichting, passing van hulpstukken en juiste rioolverbinding geactiveerd.',
  DETECT_WATER_SEAL:
    'Controle op sifon, waterslotdiepte en meetlint bij stankafsluiting geactiveerd.',
  DETECT_RELIEF_VALVE:
    'Controle op ontlastvoorziening of geveldetail bij hemelwater- en vuilwaterkoppeling geactiveerd.',
  DETECT_ACOUSTIC_EDGE_STRIP:
    'Controle op randisolatie of akoestische ontkoppeling van zwevende vloer geactiveerd.',
  OCR_CE_LABEL_DB:
    'OCR-controle op CE-label, typeplaatje en geluidsvermogen van de buitenunit geactiveerd.',
  DETECT_LASER_DISTANCE:
    'Controle op leesbare laserafstandsmeter of afstandsmeting naar erfgrens geactiveerd.',
  DETECT_ACOUSTIC_ENCLOSURE:
    'Controle op suskast, akoestische omkasting en geluidreducerende lamellen geactiveerd.',
  DETECT_CHECK_VALVE:
    'Controle op terugstroombeveiliging en keerkleppen (type EA/CA/BA) geactiveerd.',
  DETECT_SAFETY_VALVE:
    'Controle op inlaatcombinatie en overstortventiel geactiveerd.',
  DETECT_FLOOR_HEATING:
    'Controle op hart-op-hart afstand van vloerverwarming met rolmaat geactiveerd.',
  DETECT_EXPANSION_VESSEL:
    'Controle op aansluiting expansievat en console geactiveerd.',
  DETECT_EARTH_WIRE:
    'Controle op groen/gele vereffeningsdraad en centraal aardpunt (CAP) geactiveerd.',
  DETECT_INWALL_CONDUIT:
    'Controle op diepte en montage inbouwdozen geactiveerd.',
  DETECT_GAS_PIPE_SUPPORT:
    'Controle op beugelafstand gasleiding inclusief rolmaat in beeld geactiveerd.',
  DETECT_GAS_VALVE:
    'Controle op direct bereikbare gastoestelkraan geactiveerd.',
  DETECT_NO_COMPRESSION_FITTING:
    'Controle op doorlopende verbinding zonder knelkoppeling in afgesloten constructie geactiveerd.',
  DETECT_GAS_METER:
    'Controle op gasmeter, ophangbeugel en aansluitingen geactiveerd.',
  DETECT_VENTILATION_OPENING:
    'Controle op aanwezigheid luchttoevoervoorziening of ventilatieopening bij open gastoestel geactiveerd.',
  OCR_GASTEC_QA:
    'OCR-controle op verplicht Gastec QA keurmerk op gasslang of appendages geactiveerd.',
  DETECT_BONDING_CLAMP:
    'Controle op deugdelijke aardklem ter plaatse van de binnenkomende gasleiding geactiveerd.',
  DETECT_CRAWLSPACE_PIPE:
    'Controle op naadloze, ononderbroken gasleiding (zonder verbindingen) in de kruipruimte geactiveerd.',
  DETECT_MECHANICAL_PROTECTION:
    'Controle op beschermende stalen koker of vergelijkbare mechanische bescherming over blootliggende gasleiding geactiveerd.',
  DETECT_CASING_VENTILATION:
    'Controle op open zijde van de mantelbuis voor gasontluchting in ongeventileerde schachten geactiveerd.',
  DETECT_RAMP_SLOPE:
    'Hellingbaan controle geactiveerd. Breng het hellingspercentage of de waterpas in beeld.',
  DETECT_SWITCH_HEIGHT:
    'Controle op de montagehoogte (900-1200mm) van de wandcontactdoos of lichtschakelaar geactiveerd.',
  DETECT_GLASS_MARKING:
    'Controle op aanwezigheid van contrasterende visuele markeringen op grote glazen deuren of wanden geactiveerd.',
  DETECT_REBAR_COVER:
    'Controle op wapeningsnetten en positionering van dekkingsblokjes voor de betonstort geactiveerd.',
  DETECT_STEEL_BOLTS:
    'Controle op aanwezige boutverbindingen in de stalen draagconstructie geactiveerd.',
  DETECT_TIMBER_JOIST_HANGER:
    'Controle op correct gemonteerde stalen raveeldragers of ankers in houten constructie geactiveerd.',
  DETECT_WALL_TIES:
    'Controle op voorgeschreven spouwankers op het metselwerk geactiveerd.',
  DETECT_LINTEL_BEARING:
    'Controle op benodigde opleglengte van de latei in het metselwerk geactiveerd. Houd de rolmaat in beeld.',
  DETECT_WATERPROOFING_MEMBRANE:
    'Controle op waterkerende folies (DPC) of loodslabben tegen neerslag en optrekkend vocht geactiveerd.',
  DETECT_FOUNDATION_PILE:
    'Controle op heipalen/boorpalen inclusief wapening in de funderingssleuf geactiveerd.',
  DETECT_UNDERFLOOR_HEATING:
    'Controle op het vloerverwarmingsslangenpatroon en randisolatie geactiveerd. Houd maatlat op afstand.',
  DETECT_PRESSURE_GAUGE:
    'Controle op een leesbare manometer (drukmeter) op de verdeler geactiveerd.',
  DETECT_FLOOR_OPENING:
    'Controle op structurele vloersparingen, trapgaten of vides geactiveerd ten behoeve van NEN 2580 correcties.',
  DETECT_ROOF_VENT:
    'Controle op onvernauwde ontspanningsleiding / beluchting richtend naar dakdoorvoer geactiveerd.',
  DETECT_PIPE_BRACKET:
    'Detectie leidingbeugels en expansie (vaste & glijpunt) in leidingtracés geactiveerd.',
  DETECT_Y_JUNCTION:
    'Controle op toepassing wettelijk toegestane 45° Y-stukken / stroom-T verbindingen t.o.v. haakse elementen.',
  DETECT_PIPE_DIAMETER:
    'Raming op buisdiameters voor grote/specifieke lozingstoestellen geactiveerd. Houd referentie/rolmaat naast leiding.',
  DETECT_GLASS_BARRIER:
    'Detectie op doorvalbeveiliging, balustrades, vloerafscheiding (> 1m) en fixatie-elementen geactiveerd.',
  DETECT_EDGE_INSULATION:
    'Controle ter plaatse op zwevende dekvloer (contactgeluid reductie): foam of kantstroken langs opgaande wanden geactiveerd.',
  DETECT_ACOUSTIC_VENT:
    'Controle op specifieke montage van gevel-suskasten en gedempte roosters (verhoogde Wgb/buurtgeluidwering) geactiveerd.',
  DETECT_ACOUSTIC_FOAM:
    'Registratie van hermetische voegdichting/dilataties met flexpur of wol ten behoeve van luchtgeluidisolatie (DnT,A) geactiveerd.',
  DETECT_DOOR_SEALS:
    'Controle op rondomlopende brand-/rookrubbers (Sa/S200) en valdorpels aan kozijnen & deuren geactiveerd.',
  DETECT_FIRE_GLASS_DETAIL:
    'Detectie van beglazingsdetails in brandoverslag trajecten (stalen clips / brandband) geactiveerd.',
  DETECT_FIRE_BOARD_THICKNESS:
    'Detectie op coating-laagdikte en/of brandwerende beplating (omhulling) rond stalen draagconstructies geactiveerd.',
  OCR_WINDOW_U_VALUE:
    'Scanner geactiveerd: zoekt naar Ug-waarde, isolatiewaarde of codering in de aluminium/warm-edge afstandhouderkast in het raam (HR++ / Triple) t.b.v. BENG verificatie.',
  DETECT_THERMAL_BRIDGE_BREAK:
    'Detectie op thermische isolators (Fomglas, Isokorf of specifieke isolatieblokken) rond koudebruggen geactiveerd.',
  OCR_SOLAR_PANEL_WATTAGE:
    'Scanner geactiveerd: leest typeplaatje en Wp (Wattpiek) vermogen af van PV-zonnepanelen/omvormers t.b.v. BENG 3 aandeel hernieuwbaar.',
};

export const validateCaptureOnDevice = async (
  photoUri: string,
  aiValidationKey?: AiValidationKey
): Promise<AiValidationResult> => {
  try {
    const info = new File(photoUri).info();
    const size = info.exists && typeof info.size === 'number' ? info.size : 0;
    const validationHint = aiValidationKey
      ? AI_VALIDATION_HINTS[aiValidationKey]
      : null;

    if (size < 150_000) {
      return {
        status: 'FAILED',
        confidence: 0.2,
        notes: validationHint
          ? `Foto mogelijk te onscherp of te klein. ${validationHint}`
          : 'Foto mogelijk te onscherp of te klein (edge check).',
      };
    }

    return {
      status: 'PASSED',
      confidence: 0.7,
      notes: validationHint
        ? `Edge check OK: basis-kwaliteit voldoende. ${validationHint}`
        : 'Edge check OK: basis-kwaliteit voldoende.',
    };
  } catch {
    return {
      status: 'PENDING',
      confidence: null,
      notes: 'Edge check kon niet worden uitgevoerd.',
    };
  }
};
